package tests

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/DEVANSHUKEJRIWAL/CampusSync/internal/events"
	"github.com/DEVANSHUKEJRIWAL/CampusSync/internal/notifications"
	"github.com/DEVANSHUKEJRIWAL/CampusSync/internal/store"
)

func TestHandleUpdateEvent_ForbiddenForNonOrganizers(t *testing.T) {
	db := setupTestDB(t)
	userRepo := store.NewUserRepository(db)
	eventRepo := store.NewEventRepository(db)
	h := &events.Handler{Repo: eventRepo, UserRepo: userRepo, Notifications: notifications.NewService()}

	// seed a normal member
	member := seedUser(t, userRepo, "member@x.com", "auth0|member", "Member")

	body, _ := json.Marshal(map[string]interface{}{
		"id":         123,
		"title":      "New Title",
		"location":   "Loc",
		"start_time": time.Now(),
		"end_time":   time.Now().Add(time.Hour),
		"capacity":   10,
		"visibility": "PUBLIC",
		"category":   "Cat",
	})

	req := httptest.NewRequest("POST", "/events/update", bytes.NewBuffer(body))
	req = injectClaims(req, member.OIDCID)
	w := httptest.NewRecorder()

	h.HandleUpdateEvent(w, req)

	if w.Code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d", w.Code)
	}
}

func TestHandleUpdateEvent_InvalidJSON(t *testing.T) {
	db := setupTestDB(t)
	userRepo := store.NewUserRepository(db)
	eventRepo := store.NewEventRepository(db)
	h := &events.Handler{Repo: eventRepo, UserRepo: userRepo, Notifications: notifications.NewService()}

	org := seedUser(t, userRepo, "org@x.com", "auth0|org", "Organizer")

	req := httptest.NewRequest("POST", "/events/update", bytes.NewBuffer([]byte("not-json")))
	req = injectClaims(req, org.OIDCID)
	w := httptest.NewRecorder()

	h.HandleUpdateEvent(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", w.Code)
	}
}

func TestHandleUpdateEvent_EndBeforeStart(t *testing.T) {
	db := setupTestDB(t)
	userRepo := store.NewUserRepository(db)
	eventRepo := store.NewEventRepository(db)
	h := &events.Handler{Repo: eventRepo, UserRepo: userRepo, Notifications: notifications.NewService()}

	org := seedUser(t, userRepo, "org2@x.com", "auth0|org2", "Organizer")

	body, _ := json.Marshal(map[string]interface{}{
		"id":         1,
		"title":      "Bad Time",
		"location":   "Loc",
		"start_time": time.Now().Add(2 * time.Hour),
		"end_time":   time.Now().Add(1 * time.Hour),
		"capacity":   50,
		"visibility": "PUBLIC",
		"category":   "General",
	})

	req := httptest.NewRequest("POST", "/events/update", bytes.NewBuffer(body))
	req = injectClaims(req, org.OIDCID)
	w := httptest.NewRecorder()

	h.HandleUpdateEvent(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", w.Code)
	}
}

func TestHandleUpdateEvent_EventNotFound(t *testing.T) {
	db := setupTestDB(t)
	userRepo := store.NewUserRepository(db)
	eventRepo := store.NewEventRepository(db)
	h := &events.Handler{Repo: eventRepo, UserRepo: userRepo, Notifications: notifications.NewService()}

	org := seedUser(t, userRepo, "org3@x.com", "auth0|org3", "Organizer")

	body, _ := json.Marshal(map[string]interface{}{
		"id":         999999, // non-existent
		"title":      "X",
		"location":   "Y",
		"start_time": time.Now(),
		"end_time":   time.Now().Add(time.Hour),
		"capacity":   10,
		"visibility": "PUBLIC",
		"category":   "General",
	})

	req := httptest.NewRequest("POST", "/events/update", bytes.NewBuffer(body))
	req = injectClaims(req, org.OIDCID)
	w := httptest.NewRecorder()

	h.HandleUpdateEvent(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
}
