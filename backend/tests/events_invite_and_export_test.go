package tests

import (
	"bytes"
	"context"
	"encoding/csv"
	"encoding/json"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/DEVANSHUKEJRIWAL/CampusSync/internal/events"
	"github.com/DEVANSHUKEJRIWAL/CampusSync/internal/notifications"
	"github.com/DEVANSHUKEJRIWAL/CampusSync/internal/store"
)

func seedUser(t *testing.T, db *store.UserRepository, email, oidcID, role string) *store.User {
	t.Helper()
	u := &store.User{
		Email:    email,
		OIDCID:   oidcID,
		Role:     role,
		IsActive: true,
	}
	if err := db.Create(context.Background(), u); err != nil {
		t.Fatalf("failed to seed user %s: %v", email, err)
	}
	return u
}

func seedEvent(t *testing.T, repo *store.EventRepository, organizerID int64, title, visibility string) *store.Event {
	t.Helper()
	now := time.Now()
	ev := &store.Event{
		Title:       title,
		Description: "Test event",
		Location:    "Test Location",
		StartTime:   now.Add(1 * time.Hour),
		EndTime:     now.Add(2 * time.Hour),
		Capacity:    10,
		OrganizerID: organizerID,
		Status:      "UPCOMING",
		Visibility:  visibility,
		Category:    "Test",
	}
	if err := repo.Create(context.Background(), ev); err != nil {
		t.Fatalf("failed to seed event: %v", err)
	}
	return ev
}

func TestHandleInviteUser_RBACAndInsert(t *testing.T) {
	db := setupTestDB(t)

	userRepo := store.NewUserRepository(db)
	eventRepo := store.NewEventRepository(db)
	nsvc := notifications.NewService()

	h := &events.Handler{
		Repo:          eventRepo,
		UserRepo:      userRepo,
		Notifications: nsvc,
	}

	ctx := context.Background()
	org := seedUser(t, userRepo, "org@example.com", "auth0|org", "Organizer")
	member := seedUser(t, userRepo, "member@example.com", "auth0|member", "Member")
	ev := seedEvent(t, eventRepo, org.ID, "Private Event", "PRIVATE")

	t.Run("Organizer can invite user", func(t *testing.T) {
		body, _ := json.Marshal(map[string]interface{}{
			"event_id": ev.ID,
			"email":    "invited@example.com",
		})

		req := httptest.NewRequest(http.MethodPost, "/events/invite", bytes.NewReader(body))
		req = injectClaims(req, org.OIDCID)
		w := httptest.NewRecorder()

		h.HandleInviteUser(w, req)

		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
		}

		var email string
		err := db.QueryRowContext(ctx,
			"SELECT email FROM invitations WHERE event_id=$1 AND email=$2",
			ev.ID, "invited@example.com",
		).Scan(&email)
		if err != nil {
			t.Fatalf("expected invitation row, got error: %v", err)
		}
		if email != "invited@example.com" {
			t.Fatalf("expected email invited@example.com, got %s", email)
		}
	})

	t.Run("Member cannot invite user", func(t *testing.T) {
		body, _ := json.Marshal(map[string]interface{}{
			"event_id": ev.ID,
			"email":    "another@example.com",
		})

		req := httptest.NewRequest(http.MethodPost, "/events/invite", bytes.NewReader(body))
		req = injectClaims(req, member.OIDCID)
		w := httptest.NewRecorder()

		h.HandleInviteUser(w, req)

		if w.Code != http.StatusForbidden {
			t.Fatalf("expected 403, got %d", w.Code)
		}
	})
}

func TestHandleBulkInvite_CreatesInvitations(t *testing.T) {
	db := setupTestDB(t)

	userRepo := store.NewUserRepository(db)
	eventRepo := store.NewEventRepository(db)
	nsvc := notifications.NewService()

	h := &events.Handler{
		Repo:          eventRepo,
		UserRepo:      userRepo,
		Notifications: nsvc,
	}

	ctx := context.Background()
	org := seedUser(t, userRepo, "org2@example.com", "auth0|org2", "Organizer")
	ev := seedEvent(t, eventRepo, org.ID, "Bulk Private Event", "PRIVATE")

	// Build CSV in memory
	var csvBuf bytes.Buffer
	cw := csv.NewWriter(&csvBuf)
	_ = cw.Write([]string{"bulk1@example.com"})
	_ = cw.Write([]string{"bulk2@example.com"})
	cw.Flush()

	var body bytes.Buffer
	writer := multipart.NewWriter(&body)

	// event_id field
	if err := writer.WriteField("event_id", strconv.FormatInt(ev.ID, 10)); err != nil {
		t.Fatalf("failed to write event_id field: %v", err)
	}

	// file field
	part, err := writer.CreateFormFile("file", "invites.csv")
	if err != nil {
		t.Fatalf("failed to create form file: %v", err)
	}
	if _, err := io.Copy(part, &csvBuf); err != nil {
		t.Fatalf("failed to copy csv into form: %v", err)
	}

	writer.Close()

	req := httptest.NewRequest(http.MethodPost, "/events/invite/bulk", &body)
	req.Header.Set("Content-Type", writer.FormDataContentType())
	req = injectClaims(req, org.OIDCID)

	w := httptest.NewRecorder()
	h.HandleBulkInvite(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	// Ensure invitations were written
	var count int
	err = db.QueryRowContext(ctx, "SELECT COUNT(*) FROM invitations WHERE event_id=$1", ev.ID).Scan(&count)
	if err != nil {
		t.Fatalf("count invitations error: %v", err)
	}
	if count != 2 {
		t.Fatalf("expected 2 invitations, got %d", count)
	}
}

func TestHandleExportAttendees_ReturnsCSV(t *testing.T) {
	db := setupTestDB(t)
	userRepo := store.NewUserRepository(db)
	eventRepo := store.NewEventRepository(db)
	nsvc := notifications.NewService()

	h := &events.Handler{
		Repo:          eventRepo,
		UserRepo:      userRepo,
		Notifications: nsvc,
	}

	ctx := context.Background()
	org := seedUser(t, userRepo, "orgcsv@example.com", "auth0|orgcsv", "Organizer")
	u := seedUser(t, userRepo, "attendee@example.com", "auth0|attendee", "Member")
	ev := seedEvent(t, eventRepo, org.ID, "CSV Event", "PUBLIC")

	// Seed a registration row
	_, err := db.ExecContext(ctx,
		"INSERT INTO registrations (user_id, event_id, status, created_at, updated_at) VALUES ($1, $2, 'REGISTERED', NOW(), NOW())",
		u.ID, ev.ID,
	)
	if err != nil {
		t.Fatalf("failed to seed registration: %v", err)
	}

	req := httptest.NewRequest(http.MethodGet, "/events/export?event_id="+strconv.FormatInt(ev.ID, 10), nil)
	w := httptest.NewRecorder()

	h.HandleExportAttendees(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	if !strings.Contains(w.Header().Get("Content-Type"), "text/csv") {
		t.Fatalf("expected Content-Type text/csv, got %s", w.Header().Get("Content-Type"))
	}

	r := csv.NewReader(strings.NewReader(w.Body.String()))
	rows, err := r.ReadAll()
	if err != nil {
		t.Fatalf("failed to parse csv: %v", err)
	}
	if len(rows) < 2 {
		t.Fatalf("expected header + at least 1 attendee row, got %d rows", len(rows))
	}
}
