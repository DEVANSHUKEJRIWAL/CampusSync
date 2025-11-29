package events

import (
	"context"
	"encoding/csv"
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/DEVANSHUKEJRIWAL/CampusSync/internal/store"
	jwtmiddleware "github.com/auth0/go-jwt-middleware/v2"
	"github.com/auth0/go-jwt-middleware/v2/validator"
)

type Handler struct {
	Repo     *store.EventRepository
	UserRepo *store.UserRepository
}

type CreateEventRequest struct {
	Title       string    `json:"title"`
	Description string    `json:"description"`
	Location    string    `json:"location"`
	StartTime   time.Time `json:"start_time"`
	EndTime     time.Time `json:"end_time"`
	Capacity    int       `json:"capacity"`
	Visibility  string    `json:"visibility"`
	Category    string    `json:"category"`
}

func (req *CreateEventRequest) Validate() error {
	if strings.TrimSpace(req.Title) == "" {
		return errors.New("event title is required")
	}
	if strings.TrimSpace(req.Location) == "" {
		return errors.New("location is required")
	}
	if req.Capacity <= 0 {
		return errors.New("capacity must be greater than zero")
	}
	if req.EndTime.Before(req.StartTime) {
		return errors.New("end time must be after start time")
	}
	if req.Visibility != "PUBLIC" && req.Visibility != "PRIVATE" {
		return errors.New("invalid visibility (must be PUBLIC or PRIVATE)")
	}
	return nil
}

func (h *Handler) HandleCreateEvent(w http.ResponseWriter, r *http.Request) {
	claims := r.Context().Value(jwtmiddleware.ContextKey{}).(*validator.ValidatedClaims)
	auth0ID := claims.RegisteredClaims.Subject

	user, err := h.UserRepo.GetByOIDCID(r.Context(), auth0ID)
	if err != nil {
		http.Error(w, "User not found", http.StatusUnauthorized)
		return
	}

	if user.Role != "Organizer" && user.Role != "Admin" {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusForbidden)
		json.NewEncoder(w).Encode(map[string]string{"message": "Forbidden: Only Organizers can create events."})
		return
	}

	var req CreateEventRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid body format", http.StatusBadRequest)
		return
	}

	if err := req.Validate(); err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"message": err.Error()})
		return
	}

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
		Category:    req.Category,
	}

	if err := h.Repo.Create(r.Context(), event); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(event)
}

func (h *Handler) HandleUpdateEvent(w http.ResponseWriter, r *http.Request) {
	var req struct {
		CreateEventRequest
		ID int64 `json:"id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid body", http.StatusBadRequest)
		return
	}

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

	if err := req.Validate(); err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"message": err.Error()})
		return
	}

	event := &store.Event{
		ID:          req.ID,
		Title:       req.Title,
		Description: req.Description,
		Location:    req.Location,
		StartTime:   req.StartTime,
		EndTime:     req.EndTime,
		Capacity:    req.Capacity,
		Visibility:  req.Visibility,
		Category:    req.Category,
	}

	if err := h.Repo.Update(r.Context(), event); err != nil {
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}

	go func() {
		msg := "Update: Details for '" + event.Title + "' have changed."
		h.Repo.NotifyAllAttendees(context.Background(), event.ID, msg)
	}()

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "Event updated"})
}

func (h *Handler) HandleListEvents(w http.ResponseWriter, r *http.Request) {
	query := r.URL.Query().Get("q")
	location := r.URL.Query().Get("location")
	category := r.URL.Query().Get("category")

	events, err := h.Repo.Search(r.Context(), query, location, category)
	if err != nil {
		http.Error(w, "Failed to fetch events", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(events)
}

func (h *Handler) HandleListAttendees(w http.ResponseWriter, r *http.Request) {
	eventIDStr := r.URL.Query().Get("event_id")
	eventID, _ := strconv.ParseInt(eventIDStr, 10, 64)

	attendees, err := h.Repo.GetAttendees(r.Context(), eventID)
	if err != nil {
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(attendees)
}

func (h *Handler) HandleExportAttendees(w http.ResponseWriter, r *http.Request) {
	eventIDStr := r.URL.Query().Get("event_id")
	eventID, _ := strconv.ParseInt(eventIDStr, 10, 64)

	attendees, err := h.Repo.GetAttendees(r.Context(), eventID)
	if err != nil {
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "text/csv")
	w.Header().Set("Content-Disposition", "attachment; filename=attendees.csv")

	writer := csv.NewWriter(w)
	writer.Write([]string{"User ID", "Email", "Status", "Registered At"})
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

func (h *Handler) HandleInviteUser(w http.ResponseWriter, r *http.Request) {
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

	var req struct {
		EventID int64  `json:"event_id"`
		Email   string `json:"email"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid body", http.StatusBadRequest)
		return
	}
	if err := h.Repo.InviteUser(r.Context(), req.EventID, req.Email); err != nil {
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"message": "User invited"})
}

func (h *Handler) HandleBulkInvite(w http.ResponseWriter, r *http.Request) {
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

	if err := r.ParseMultipartForm(10 << 20); err != nil {
		http.Error(w, "File too large", http.StatusBadRequest)
		return
	}
	eventIDStr := r.FormValue("event_id")
	eventID, err := strconv.ParseInt(eventIDStr, 10, 64)
	if err != nil {
		http.Error(w, "Invalid event ID", http.StatusBadRequest)
		return
	}
	file, _, err := r.FormFile("file")
	if err != nil {
		http.Error(w, "Missing file", http.StatusBadRequest)
		return
	}
	defer file.Close()

	reader := csv.NewReader(file)
	records, err := reader.ReadAll()
	if err != nil {
		http.Error(w, "Invalid CSV format", http.StatusBadRequest)
		return
	}
	var emails []string
	for _, row := range records {
		if len(row) > 0 {
			emails = append(emails, row[0])
		}
	}
	count, err := h.Repo.BulkInvite(r.Context(), eventID, emails)
	if err != nil {
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"message": "Bulk invite processed",
		"count":   count,
	})
}

func (h *Handler) HandleAddFeedback(w http.ResponseWriter, r *http.Request) {
	claims := r.Context().Value(jwtmiddleware.ContextKey{}).(*validator.ValidatedClaims)
	user, err := h.UserRepo.GetByOIDCID(r.Context(), claims.RegisteredClaims.Subject)
	if err != nil {
		http.Error(w, "User not found", http.StatusUnauthorized)
		return
	}

	var req struct {
		EventID int64  `json:"event_id"`
		Rating  int    `json:"rating"`
		Comment string `json:"comment"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid body", http.StatusBadRequest)
		return
	}

	if req.Rating < 1 || req.Rating > 5 {
		http.Error(w, "Rating must be between 1 and 5", http.StatusBadRequest)
		return
	}

	feedback := &store.Feedback{
		EventID: req.EventID,
		UserID:  user.ID,
		Rating:  req.Rating,
		Comment: req.Comment,
	}

	if err := h.Repo.AddFeedback(r.Context(), feedback); err != nil {
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "Feedback submitted successfully"})
}

func (h *Handler) HandleGetAnalytics(w http.ResponseWriter, r *http.Request) {
	claims := r.Context().Value(jwtmiddleware.ContextKey{}).(*validator.ValidatedClaims)
	user, err := h.UserRepo.GetByOIDCID(r.Context(), claims.RegisteredClaims.Subject)
	if err != nil {
		http.Error(w, "User not found", http.StatusUnauthorized)
		return
	}
	if user.Role != "Admin" {
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}

	stats, err := h.Repo.GetSystemStats(r.Context())
	if err != nil {
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(stats)
}
