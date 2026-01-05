package users

import (
	"encoding/json"
	"log"
	"net/http"
	"time"

	jwtmiddleware "github.com/auth0/go-jwt-middleware/v2"

	"github.com/DEVANSHUKEJRIWAL/CampusSync/internal/store"
	"github.com/auth0/go-jwt-middleware/v2/validator"
)

type Handler struct {
	Repo *store.UserRepository
}

type Badge struct {
	ID       int       `json:"id"`
	Name     string    `json:"name"`
	Icon     string    `json:"icon"`
	EarnedAt time.Time `json:"earned_at"`
}

func (h *Handler) HandleSyncUser(w http.ResponseWriter, r *http.Request) {
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

	var req struct {
		Email string `json:"email"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Bad Request", http.StatusBadRequest)
		return
	}

	// 1. Check if user already exists
	existing, err := h.Repo.GetByOIDCID(r.Context(), auth0ID)
	if err == nil {
		// User exists -> Return them immediately
		json.NewEncoder(w).Encode(existing)
		return
	}

	// 2. NEW USER DETECTED -> Initialize with Points
	newUser := &store.User{
		Email:  req.Email,
		OIDCID: auth0ID,
		Role:   "Member",
		Points: 50, // 👈 Initialize with 50 points
	}

	// 3. Create User in DB
	// IMPORTANT: Ensure your store/users.go Create() method actually saves 'Points' to the DB!
	if err := h.Repo.Create(r.Context(), newUser); err != nil {
		log.Println("Create user error:", err)
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}

	// 4. Award "Welcome" Badge
	// Using "Newcomer" as the badge name to match your SQL logic
	err = h.Repo.AddBadge(r.Context(), newUser.ID, "Newcomer", "👋")
	if err != nil {
		// Log the error but do NOT fail the request. The user account is already created.
		log.Printf("Failed to award welcome badge: %v", err)
	}

	// 5. Return the new user object
	json.NewEncoder(w).Encode(newUser)
}

func (h *Handler) HandleUpdateRole(w http.ResponseWriter, r *http.Request) {
	claims := r.Context().Value(jwtmiddleware.ContextKey{}).(*validator.ValidatedClaims)
	requesterID := claims.RegisteredClaims.Subject

	requester, err := h.Repo.GetByOIDCID(r.Context(), requesterID)
	if err != nil {
		http.Error(w, "Requester not found", http.StatusUnauthorized)
		return
	}

	if requester.Role != "Admin" {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusForbidden)
		json.NewEncoder(w).Encode(map[string]string{
			"message": "Forbidden: Only Admins can change roles.",
		})
		return
	}

	var req struct {
		UserID int64  `json:"user_id"`
		Role   string `json:"role"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid body", http.StatusBadRequest)
		return
	}

	const SuperAdminEmail = "devanshukejriwal24@gmail.com"

	targetUser, err := h.Repo.GetByID(r.Context(), req.UserID)
	if err != nil {
		http.Error(w, "Target user not found", http.StatusNotFound)
		return
	}

	if targetUser.Email == SuperAdminEmail {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusForbidden)
		json.NewEncoder(w).Encode(map[string]string{
			"message": "Forbidden: Cannot modify the Super Admin account.",
		})
		return
	}

	if req.Role != "Admin" && req.Role != "Organizer" && req.Role != "Member" {
		http.Error(w, "Invalid role", http.StatusBadRequest)
		return
	}

	if err := h.Repo.UpdateRole(r.Context(), req.UserID, req.Role); err != nil {
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(map[string]string{"message": "Role updated successfully"})
}

func (h *Handler) HandleListUsers(w http.ResponseWriter, r *http.Request) {
	users, err := h.Repo.ListAll(r.Context())
	if err != nil {
		http.Error(w, "Failed to fetch users", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(users)
}

func (h *Handler) HandleToggleActive(w http.ResponseWriter, r *http.Request) {
	claims := r.Context().Value(jwtmiddleware.ContextKey{}).(*validator.ValidatedClaims)
	requesterID := claims.RegisteredClaims.Subject

	requester, err := h.Repo.GetByOIDCID(r.Context(), requesterID)
	if err != nil {
		http.Error(w, "Requester not found", http.StatusUnauthorized)
		return
	}

	if requester.Role != "Admin" {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusForbidden)
		json.NewEncoder(w).Encode(map[string]string{
			"message": "Forbidden: Only Admins can change user status.",
		})
		return
	}

	var req struct {
		UserID   int64 `json:"user_id"`
		IsActive bool  `json:"is_active"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid body", http.StatusBadRequest)
		return
	}
	const SuperAdminEmail = "devanshukejriwal24@gmail.com"

	targetUser, err := h.Repo.GetByID(r.Context(), req.UserID)
	if err != nil {
		http.Error(w, "Target user not found", http.StatusNotFound)
		return
	}

	if targetUser.Email == SuperAdminEmail {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusForbidden)
		json.NewEncoder(w).Encode(map[string]string{
			"message": "Forbidden: Cannot deactivate the Super Admin account.",
		})
		return
	}

	if err := h.Repo.ToggleActive(r.Context(), req.UserID, req.IsActive); err != nil {
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "User status updated successfully"})
}

func (h *Handler) HandleGetLeaderboard(w http.ResponseWriter, r *http.Request) {
	users, err := h.Repo.GetLeaderboard(r.Context())
	if err != nil {
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(users)
}

func (h *Handler) HandleGetMyBadges(w http.ResponseWriter, r *http.Request) {
	claims := r.Context().Value(jwtmiddleware.ContextKey{}).(*validator.ValidatedClaims)
	user, err := h.Repo.GetByOIDCID(r.Context(), claims.RegisteredClaims.Subject)
	if err != nil {
		http.Error(w, "User not found", http.StatusUnauthorized)
		return
	}

	badges, err := h.Repo.GetUserBadges(r.Context(), user.ID)
	if err != nil {
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(badges)
}
