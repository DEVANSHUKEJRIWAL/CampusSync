package tests

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"

	"github.com/DEVANSHUKEJRIWAL/CampusSync/internal/events"
	"github.com/DEVANSHUKEJRIWAL/CampusSync/internal/notifications"
	"github.com/DEVANSHUKEJRIWAL/CampusSync/internal/store"
)

// Covers: HandleListAttendees + GetAttendees
func TestHandleListAttendees_ReturnsAllStatuses(t *testing.T) {
	db := setupTestDB(t)

	userRepo := store.NewUserRepository(db)
	eventRepo := store.NewEventRepository(db)
	h := &events.Handler{
		Repo:          eventRepo,
		UserRepo:      userRepo,
		Notifications: notifications.NewService(),
	}

	org := seedUser(t, userRepo, "org-att@x.com", "auth0|org-att", "Organizer")
	ev := seedEvent(t, eventRepo, org.ID, "Attendees Event", "PUBLIC")

	registered := seedUser(t, userRepo, "reg@x.com", "auth0|reg", "Member")
	waitlisted := seedUser(t, userRepo, "wait@x.com", "auth0|wait", "Member")

	// Seed registration
	_, err := db.Exec(`
		INSERT INTO registrations (user_id, event_id, status, created_at, updated_at)
		VALUES ($1, $2, 'REGISTERED', NOW(), NOW())`,
		registered.ID, ev.ID,
	)
	if err != nil {
		t.Fatalf("seed registration: %v", err)
	}

	// Seed waitlist
	_, err = db.Exec(`
		INSERT INTO waitlist (user_id, event_id, created_at)
		VALUES ($1, $2, NOW())`,
		waitlisted.ID, ev.ID,
	)
	if err != nil {
		t.Fatalf("seed waitlist: %v", err)
	}

	// Seed invitation
	_, err = db.Exec(`
		INSERT INTO invitations (event_id, email, created_at)
		VALUES ($1, $2, NOW())`,
		ev.ID, "invited@x.com",
	)
	if err != nil {
		t.Fatalf("seed invitation: %v", err)
	}

	req := httptest.NewRequest(
		"GET",
		"/attendees?event_id="+strconv.FormatInt(ev.ID, 10),
		nil,
	)
	w := httptest.NewRecorder()

	h.HandleListAttendees(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d (%s)", w.Code, w.Body.String())
	}

	var attendees []*store.Attendee
	if err := json.NewDecoder(w.Body).Decode(&attendees); err != nil {
		t.Fatalf("decode attendees: %v", err)
	}

	if len(attendees) < 3 {
		t.Fatalf("expected at least 3 attendees, got %d", len(attendees))
	}

	seen := map[string]bool{}
	for _, a := range attendees {
		seen[a.Status] = true
	}

	if !seen["REGISTERED"] || !seen["WAITLISTED"] || !seen["INVITED"] {
		t.Fatalf("expected REGISTERED, WAITLISTED, INVITED; got statuses: %+v", seen)
	}
}

// Covers: HandleAddFeedback + AddFeedback
func TestHandleAddFeedback_ValidAndInvalidRating(t *testing.T) {
	db := setupTestDB(t)

	userRepo := store.NewUserRepository(db)
	eventRepo := store.NewEventRepository(db)
	h := &events.Handler{
		Repo:          eventRepo,
		UserRepo:      userRepo,
		Notifications: notifications.NewService(),
	}

	member := seedUser(t, userRepo, "fb@x.com", "auth0|fb", "Member")
	org := seedUser(t, userRepo, "org-fb@x.com", "auth0|org-fb", "Organizer")
	ev := seedEvent(t, eventRepo, org.ID, "Feedback Event", "PUBLIC")

	// --- valid rating 4 ---
	validBody, _ := json.Marshal(map[string]interface{}{
		"event_id": ev.ID,
		"rating":   4,
		"comment":  "Nice event",
	})

	req := httptest.NewRequest("POST", "/feedback", bytes.NewBuffer(validBody))
	req = injectClaims(req, member.OIDCID)
	w := httptest.NewRecorder()

	h.HandleAddFeedback(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 for valid rating, got %d (%s)", w.Code, w.Body.String())
	}

	// check row exists
	var rating int
	err := db.QueryRow(`
		SELECT rating FROM event_feedback WHERE event_id=$1 AND user_id=$2`,
		ev.ID, member.ID,
	).Scan(&rating)
	if err != nil {
		t.Fatalf("fetch feedback: %v", err)
	}
	if rating != 4 {
		t.Fatalf("expected rating 4, got %d", rating)
	}

	// --- invalid rating 0 (too low) ---
	invalidBody, _ := json.Marshal(map[string]interface{}{
		"event_id": ev.ID,
		"rating":   0,
		"comment":  "bad rating",
	})

	req2 := httptest.NewRequest("POST", "/feedback", bytes.NewBuffer(invalidBody))
	req2 = injectClaims(req2, member.OIDCID)
	w2 := httptest.NewRecorder()

	h.HandleAddFeedback(w2, req2)

	if w2.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for invalid rating, got %d", w2.Code)
	}
}

// Covers: HandleGetAnalytics + GetSystemStats
func TestHandleGetAnalytics_AdminAndForbidden(t *testing.T) {
	db := setupTestDB(t)

	userRepo := store.NewUserRepository(db)
	eventRepo := store.NewEventRepository(db)
	h := &events.Handler{
		Repo:          eventRepo,
		UserRepo:      userRepo,
		Notifications: notifications.NewService(),
	}

	admin := seedUser(t, userRepo, "admin@stats.com", "auth0|admin-stats", "Admin")
	member := seedUser(t, userRepo, "member@stats.com", "auth0|member-stats", "Member")

	// Seed event
	ev := seedEvent(t, eventRepo, admin.ID, "Stats Event", "PUBLIC")

	// Seed one registration + one feedback to make stats non-trivial
	_, err := db.Exec(`
		INSERT INTO registrations (user_id, event_id, status, created_at, updated_at)
		VALUES ($1, $2, 'REGISTERED', NOW(), NOW())`,
		member.ID, ev.ID,
	)
	if err != nil {
		t.Fatalf("seed registration: %v", err)
	}
	_, err = db.Exec(`
		INSERT INTO event_feedback (event_id, user_id, rating, comment, created_at)
		VALUES ($1, $2, 5, 'Great', NOW())`,
		ev.ID, member.ID,
	)
	if err != nil {
		t.Fatalf("seed feedback: %v", err)
	}

	// --- Admin allowed ---
	req := httptest.NewRequest("GET", "/analytics", nil)
	req = injectClaims(req, admin.OIDCID)
	w := httptest.NewRecorder()

	h.HandleGetAnalytics(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 for admin, got %d (%s)", w.Code, w.Body.String())
	}

	var stats store.SystemStats
	if err := json.NewDecoder(w.Body).Decode(&stats); err != nil {
		t.Fatalf("decode stats: %v", err)
	}

	if stats.TotalUsers != 2 {
		t.Fatalf("expected TotalUsers=2, got %d", stats.TotalUsers)
	}
	if stats.TotalEvents != 1 {
		t.Fatalf("expected TotalEvents=1, got %d", stats.TotalEvents)
	}
	if stats.TotalRegistrations != 1 {
		t.Fatalf("expected TotalRegistrations=1, got %d", stats.TotalRegistrations)
	}
	if stats.AvgRating < 4.9 || stats.AvgRating > 5.1 {
		t.Fatalf("expected AvgRating around 5, got %f", stats.AvgRating)
	}

	// --- Non-admin forbidden ---
	req2 := httptest.NewRequest("GET", "/analytics", nil)
	req2 = injectClaims(req2, member.OIDCID)
	w2 := httptest.NewRecorder()

	h.HandleGetAnalytics(w2, req2)

	if w2.Code != http.StatusForbidden {
		t.Fatalf("expected 403 for non-admin, got %d", w2.Code)
	}
}
