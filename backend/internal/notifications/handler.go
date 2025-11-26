package notifications

import (
	"encoding/json"
	"net/http"

	"github.com/DEVANSHUKEJRIWAL/CampusSync/internal/store"
	jwtmiddleware "github.com/auth0/go-jwt-middleware/v2"
	"github.com/auth0/go-jwt-middleware/v2/validator"
)

type Handler struct {
	Repo     *store.EventRepository // reusing EventRepo since we attached methods there
	UserRepo *store.UserRepository
}

func (h *Handler) HandleListNotifications(w http.ResponseWriter, r *http.Request) {
	claims := r.Context().Value(jwtmiddleware.ContextKey{}).(*validator.ValidatedClaims)
	user, err := h.UserRepo.GetByOIDCID(r.Context(), claims.RegisteredClaims.Subject)
	if err != nil {
		http.Error(w, "User not found", http.StatusUnauthorized)
		return
	}

	notes, err := h.Repo.GetNotifications(r.Context(), user.ID)
	if err != nil {
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(notes)
}

func (h *Handler) HandleMarkRead(w http.ResponseWriter, r *http.Request) {
	claims := r.Context().Value(jwtmiddleware.ContextKey{}).(*validator.ValidatedClaims)
	user, err := h.UserRepo.GetByOIDCID(r.Context(), claims.RegisteredClaims.Subject)
	if err != nil {
		http.Error(w, "User not found", http.StatusUnauthorized)
		return
	}

	h.Repo.MarkNotificationsRead(r.Context(), user.ID)
	w.WriteHeader(http.StatusOK)
}
