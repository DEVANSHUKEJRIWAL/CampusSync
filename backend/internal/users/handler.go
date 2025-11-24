package users

import (
	"encoding/json"
	"log"
	"net/http"

	jwtmiddleware "github.com/auth0/go-jwt-middleware/v2"

	"github.com/DEVANSHUKEJRIWAL/CampusSync/internal/store"
	"github.com/auth0/go-jwt-middleware/v2/validator"
)

type Handler struct {
	Repo *store.UserRepository
}

func (h *Handler) HandleSyncUser(w http.ResponseWriter, r *http.Request) {
	// 1. Get the claims from the context
	// Now "jwtmiddleware" is defined because of the import above
	claims := r.Context().Value(jwtmiddleware.ContextKey{})
	if claims == nil {
		http.Error(w, "No token found", http.StatusUnauthorized)
		return
	}

	validatedClaims, ok := claims.(*validator.ValidatedClaims)
	if !ok {
		http.Error(w, "Invalid token claims", http.StatusInternalServerError)
		return
	}

	auth0ID := validatedClaims.RegisteredClaims.Subject

	// 2. Parse Request Body
	var req struct {
		Email string `json:"email"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Bad Request", http.StatusBadRequest)
		return
	}

	// 3. Check if user exists
	existing, err := h.Repo.GetByOIDCID(r.Context(), auth0ID)
	if err == nil {
		json.NewEncoder(w).Encode(existing)
		return
	}

	// 4. Create User
	newUser := &store.User{
		Email:  req.Email,
		OIDCID: auth0ID,
		Role:   "Member",
	}

	if err := h.Repo.Create(r.Context(), newUser); err != nil {
		log.Println("Create user error:", err)
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(newUser)
}

// HandleUpdateRole allows Admins to promote/demote users
// Update in backend/internal/users/handler.go

// HandleUpdateRole allows Admins to promote/demote users
func (h *Handler) HandleUpdateRole(w http.ResponseWriter, r *http.Request) {
	// 1. Identify the REQUESTER (Who is trying to do this?)
	claims := r.Context().Value(jwtmiddleware.ContextKey{}).(*validator.ValidatedClaims)
	requesterID := claims.RegisteredClaims.Subject

	requester, err := h.Repo.GetByOIDCID(r.Context(), requesterID)
	if err != nil {
		http.Error(w, "Requester not found", http.StatusUnauthorized)
		return
	}

	// 🔒 SECURITY CHECK: Are they an Admin?
	if requester.Role != "Admin" {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusForbidden)
		json.NewEncoder(w).Encode(map[string]string{
			"message": "Forbidden: Only Admins can change roles.",
		})
		return
	}

	// 2. Parse Request
	var req struct {
		UserID int64  `json:"user_id"`
		Role   string `json:"role"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid body", http.StatusBadRequest)
		return
	}

	// 3. Validate Input
	if req.Role != "Admin" && req.Role != "Organizer" && req.Role != "Member" {
		http.Error(w, "Invalid role", http.StatusBadRequest)
		return
	}

	// 4. Perform Update
	if err := h.Repo.UpdateRole(r.Context(), req.UserID, req.Role); err != nil {
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(map[string]string{"message": "Role updated successfully"})
}

// HandleListUsers returns all users for the admin panel
func (h *Handler) HandleListUsers(w http.ResponseWriter, r *http.Request) {
	users, err := h.Repo.ListAll(r.Context())
	if err != nil {
		http.Error(w, "Failed to fetch users", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(users)
}
