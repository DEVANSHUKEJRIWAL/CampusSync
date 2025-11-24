package events

import (
	"encoding/json"
	"net/http"
)

func (h *Handler) HandleInviteUser(w http.ResponseWriter, r *http.Request) {
	// 1. Parse Request
	var req struct {
		EventID int64  `json:"event_id"`
		Email   string `json:"email"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid body", http.StatusBadRequest)
		return
	}

	// 2. Call the Repository (The Fix!)
	if err := h.Repo.InviteUser(r.Context(), req.EventID, req.Email); err != nil {
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"message": "User invited"})
}
