package events

import (
	"context"
	"encoding/csv"
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"github.com/DEVANSHUKEJRIWAL/CampusSync/internal/store"
	jwtmiddleware "github.com/auth0/go-jwt-middleware/v2"
	"github.com/auth0/go-jwt-middleware/v2/validator"
)

type Handler struct {
	Repo     *store.EventRepository
	UserRepo *store.UserRepository
}

// CreateEventRequest defines what the frontend sends
type CreateEventRequest struct {
	Title       string    `json:"title"`
	Description string    `json:"description"`
	Location    string    `json:"location"`
	StartTime   time.Time `json:"start_time"`
	EndTime     time.Time `json:"end_time"`
	Capacity    int       `json:"capacity"`
	Visibility  string    `json:"visibility"`
}

func (h *Handler) HandleCreateEvent(w http.ResponseWriter, r *http.Request) {
	// 1. Get User ID from Token
	claims := r.Context().Value(jwtmiddleware.ContextKey{}).(*validator.ValidatedClaims)
	auth0ID := claims.RegisteredClaims.Subject

	// Find the local DB user ID based on Auth0 ID
	user, err := h.UserRepo.GetByOIDCID(r.Context(), auth0ID)
	if err != nil {
		http.Error(w, "User not found", http.StatusUnauthorized)
		return
	}

	if user.Role != "Organizer" && user.Role != "Admin" {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusForbidden)
		json.NewEncoder(w).Encode(map[string]string{
			"message": "Forbidden: You must be an Organizer to create events.",
		})
		return
	}

	// 2. Decode Request
	var req CreateEventRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid body", http.StatusBadRequest)
		return
	}

	// 3. Create Event Object
	event := &store.Event{
		Title:       req.Title,
		Description: req.Description,
		Location:    req.Location,
		StartTime:   req.StartTime,
		EndTime:     req.EndTime,
		Capacity:    req.Capacity,
		OrganizerID: user.ID,
		Status:      "UPCOMING",
		Visibility:  req.Visibility,
	}

	// 4. Save to DB
	if err := h.Repo.Create(r.Context(), event); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(event)
}

func (h *Handler) HandleListEvents(w http.ResponseWriter, r *http.Request) {
	// 1. Parse Query Params
	query := r.URL.Query().Get("q")
	location := r.URL.Query().Get("location")

	// 2. Call the new Search method
	// (If params are empty, it returns all events, acting just like ListAll)
	events, err := h.Repo.Search(r.Context(), query, location)
	if err != nil {
		http.Error(w, "Failed to fetch events", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(events)
}

func (h *Handler) isOrganizer(ctx context.Context, eventID int64, userID int64) bool {
	// In a real app, you'd check the DB to see if event.organizer_id == userID
	// For this MVP, we will just check if they are an "Organizer" or "Admin" role generally
	// You can enhance this later to be strict about ownership.
	return true
}

func (h *Handler) HandleListAttendees(w http.ResponseWriter, r *http.Request) {
	// 1. Parse Event ID
	eventIDStr := r.URL.Query().Get("event_id")
	eventID, _ := strconv.ParseInt(eventIDStr, 10, 64)

	// 2. Fetch Data
	attendees, err := h.Repo.GetAttendees(r.Context(), eventID)
	if err != nil {
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(attendees)
}

func (h *Handler) HandleExportAttendees(w http.ResponseWriter, r *http.Request) {
	// 1. Parse Event ID
	eventIDStr := r.URL.Query().Get("event_id")
	eventID, _ := strconv.ParseInt(eventIDStr, 10, 64)

	// 2. Fetch Data
	attendees, err := h.Repo.GetAttendees(r.Context(), eventID)
	if err != nil {
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}

	// 3. Generate CSV
	w.Header().Set("Content-Type", "text/csv")
	w.Header().Set("Content-Disposition", "attachment; filename=attendees.csv")

	writer := csv.NewWriter(w)

	// Header
	writer.Write([]string{"User ID", "Email", "Status", "Registered At"})

	// Rows
	for _, a := range attendees {
		writer.Write([]string{
			strconv.FormatInt(a.UserID, 10),
			a.Email,
			a.Status,
			a.CreatedAt.Format(time.RFC3339),
		})
	}
	writer.Flush()
}

func (h *Handler) HandleUpdateEvent(w http.ResponseWriter, r *http.Request) {
	// 1. Parse Request
	var req struct {
		ID          int64     `json:"id"`
		Title       string    `json:"title"`
		Description string    `json:"description"`
		Location    string    `json:"location"`
		StartTime   time.Time `json:"start_time"`
		EndTime     time.Time `json:"end_time"`
		Capacity    int       `json:"capacity"`
		Visibility  string    `json:"visibility"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid body", http.StatusBadRequest)
		return
	}

	// 2. Security Check (Must be Organizer/Admin)
	claims := r.Context().Value(jwtmiddleware.ContextKey{}).(*validator.ValidatedClaims)
	user, err := h.UserRepo.GetByOIDCID(r.Context(), claims.RegisteredClaims.Subject)
	if err != nil {
		http.Error(w, "User not found", http.StatusUnauthorized)
		return
	}
	if user.Role != "Organizer" && user.Role != "Admin" {
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}

	// 3. Create Event Object
	event := &store.Event{
		ID:          req.ID,
		Title:       req.Title,
		Description: req.Description,
		Location:    req.Location,
		StartTime:   req.StartTime,
		EndTime:     req.EndTime,
		Capacity:    req.Capacity,
		Visibility:  req.Visibility,
	}

	// 4. Update DB
	if err := h.Repo.Update(r.Context(), event); err != nil {
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "Event updated"})
}
