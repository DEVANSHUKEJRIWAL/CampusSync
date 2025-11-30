package tests

import (
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"

	"github.com/DEVANSHUKEJRIWAL/CampusSync/internal/notifications"
	"github.com/DEVANSHUKEJRIWAL/CampusSync/internal/registration"
	"github.com/DEVANSHUKEJRIWAL/CampusSync/internal/store"
)

func TestRegister_PrivateEventNotInvited(t *testing.T) {
	db := setupTestDB(t)

	userRepo := store.NewUserRepository(db)
	eventRepo := store.NewEventRepository(db)
	svc := &registration.Service{DB: db, Notifications: notifications.NewService()}

	handler := &registration.Handler{
		Service:   svc,
		UserRepo:  userRepo,
		EventRepo: eventRepo,
	}

	// seed user
	user := seedUser(t, userRepo, "user@x.com", "auth0|u1", "Member")
	// seed private event with no invitations
	ev := seedEvent(t, eventRepo, user.ID, "Private X", "PRIVATE")

	req := httptest.NewRequest("POST", "/reg?event_id="+strconv.FormatInt(ev.ID, 10), nil)
	req = injectClaims(req, user.OIDCID)
	w := httptest.NewRecorder()

	handler.HandleRegister(w, req)
	handler.HandleRegister(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d (%s)", w.Code, w.Body.String())
	}
}

func TestCancelRegistration_NotFound(t *testing.T) {
	db := setupTestDB(t)

	userRepo := store.NewUserRepository(db)
	eventRepo := store.NewEventRepository(db)
	svc := &registration.Service{DB: db, Notifications: notifications.NewService()}

	handler := &registration.Handler{
		Service:   svc,
		UserRepo:  userRepo,
		EventRepo: eventRepo,
	}

	user := seedUser(t, userRepo, "user@x.com", "auth0|u99", "Member")
	ev := seedEvent(t, eventRepo, user.ID, "E1", "PUBLIC")
	// cancel without registering
	req := httptest.NewRequest("POST", "/cancel?event_id="+strconv.FormatInt(ev.ID, 10), nil)
	req = injectClaims(req, user.OIDCID)
	w := httptest.NewRecorder()

	handler.HandleCancel(w, req)
	handler.HandleCancel(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", w.Code)
	}
}

func TestRegister_EventNotFound(t *testing.T) {
	db := setupTestDB(t)

	userRepo := store.NewUserRepository(db)
	eventRepo := store.NewEventRepository(db)
	svc := &registration.Service{DB: db, Notifications: notifications.NewService()}
	handler := &registration.Handler{
		Service:   svc,
		UserRepo:  userRepo,
		EventRepo: eventRepo,
	}

	user := seedUser(t, userRepo, "user@xyz.com", "auth0|uu", "Member")

	// nonexisting event id
	req := httptest.NewRequest("POST", "/reg?event_id=9999999", nil)
	req = injectClaims(req, user.OIDCID)
	w := httptest.NewRecorder()

	handler.HandleRegister(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", w.Code)
	}
}
