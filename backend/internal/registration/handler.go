package registration

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/DEVANSHUKEJRIWAL/CampusSync/internal/store"
	jwtmiddleware "github.com/auth0/go-jwt-middleware/v2"
	"github.com/auth0/go-jwt-middleware/v2/validator"
)

type Handler struct {
	Service   *Service
	UserRepo  *store.UserRepository
	EventRepo *store.EventRepository
}

func (h *Handler) HandleRegister(w http.ResponseWriter, r *http.Request) {
	// 1. Get Event ID from URL query (e.g., ?event_id=1)
	// Ideally we use a router with params like /events/{id}/register, but query params are easier with stdlib
	eventIDStr := r.URL.Query().Get("event_id")
	eventID, err := strconv.ParseInt(eventIDStr, 10, 64)
	if err != nil {
		http.Error(w, "Invalid event ID", http.StatusBadRequest)
		return
	}

	// 2. Get User ID from Token
	claims := r.Context().Value(jwtmiddleware.ContextKey{}).(*validator.ValidatedClaims)
	auth0ID := claims.RegisteredClaims.Subject

	user, err := h.UserRepo.GetByOIDCID(r.Context(), auth0ID)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(map[string]string{
			"message": "User not found. Please click 'Sync User' button first.",
		})
		return
	}

	// 3. Call the Business Logic
	result, err := h.Service.RegisterUserForEvent(r.Context(), user.ID, eventID)
	if err != nil {
		// 👇 FIX: Send JSON error instead of plain text
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"message": err.Error()})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
}

func (h *Handler) HandleCancel(w http.ResponseWriter, r *http.Request) {
	// 1. Get Event ID
	eventIDStr := r.URL.Query().Get("event_id")
	eventID, _ := strconv.ParseInt(eventIDStr, 10, 64)

	// 2. Get User ID
	claims := r.Context().Value(jwtmiddleware.ContextKey{}).(*validator.ValidatedClaims)
	auth0ID := claims.RegisteredClaims.Subject

	user, err := h.UserRepo.GetByOIDCID(r.Context(), auth0ID)
	if err != nil {
		http.Error(w, "User not found", http.StatusUnauthorized)
		return
	}

	// 3. Call Service
	err = h.Service.CancelRegistration(r.Context(), user.ID, eventID)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"message": err.Error()})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "Registration cancelled"})
}

func (h *Handler) HandleListMyRegistrations(w http.ResponseWriter, r *http.Request) {
	// 1. Get User ID from Token
	claims := r.Context().Value(jwtmiddleware.ContextKey{}).(*validator.ValidatedClaims)
	user, err := h.UserRepo.GetByOIDCID(r.Context(), claims.RegisteredClaims.Subject)
	if err != nil {
		http.Error(w, "User not found", http.StatusUnauthorized)
		return
	}

	// 2. Fetch their events
	events, err := h.EventRepo.GetUserEvents(r.Context(), user.ID)
	if err != nil {
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(events)
}
