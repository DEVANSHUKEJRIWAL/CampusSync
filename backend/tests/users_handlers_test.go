package tests

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/DEVANSHUKEJRIWAL/CampusSync/internal/store"
	"github.com/DEVANSHUKEJRIWAL/CampusSync/internal/users"
)

func TestHandleListUsers_AdminOnly(t *testing.T) {
	db := setupTestDB(t)

	userRepo := store.NewUserRepository(db)
	h := &users.Handler{Repo: userRepo}

	admin := seedUser(t, userRepo, "admin@x.com", "auth0|admin", "Admin")
	seedUser(t, userRepo, "user1@x.com", "auth0|u1", "Member")

	req := httptest.NewRequest("GET", "/users", nil)
	req = injectClaims(req, admin.OIDCID)

	w := httptest.NewRecorder()
	h.HandleListUsers(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}

	var list []*store.User
	json.Unmarshal(w.Body.Bytes(), &list)

	if len(list) != 2 {
		t.Fatalf("expected 2 users, got %d", len(list))
	}
}

func TestHandleUpdateRole_AdminCanChangeRole(t *testing.T) {
	db := setupTestDB(t)

	userRepo := store.NewUserRepository(db)
	h := &users.Handler{Repo: userRepo}

	admin := seedUser(t, userRepo, "a@x.com", "auth0|a", "Admin")
	member := seedUser(t, userRepo, "m@x.com", "auth0|m", "Member")

	body, _ := json.Marshal(map[string]interface{}{
		"user_id": member.ID,
		"role":    "Organizer",
	})

	req := httptest.NewRequest("POST", "/users/update-role", bytes.NewBuffer(body))
	req = injectClaims(req, admin.OIDCID)

	w := httptest.NewRecorder()
	h.HandleUpdateRole(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}

	var role string
	db.QueryRow("SELECT role FROM users WHERE id=$1", member.ID).Scan(&role)

	if role != "Organizer" {
		t.Fatalf("expected Organizer, got %s", role)
	}
}

func TestHandleToggleActive(t *testing.T) {
	db := setupTestDB(t)

	userRepo := store.NewUserRepository(db)
	h := &users.Handler{Repo: userRepo}

	admin := seedUser(t, userRepo, "a@x.com", "auth0|a", "Admin")
	user := seedUser(t, userRepo, "u@x.com", "auth0|u", "Member")

	body, _ := json.Marshal(map[string]interface{}{
		"user_id": user.ID,
	})

	req := httptest.NewRequest("POST", "/users/toggle-active", bytes.NewBuffer(body))
	req = injectClaims(req, admin.OIDCID)

	w := httptest.NewRecorder()
	h.HandleToggleActive(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}

	var active bool
	db.QueryRow("SELECT is_active FROM users WHERE id=$1", user.ID).Scan(&active)

	if active != false {
		t.Fatalf("expected inactive user")
	}
}
