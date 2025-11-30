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

func TestHandleUpdateRole_CannotModifySuperAdmin(t *testing.T) {
	db := setupTestDB(t)
	r := store.NewUserRepository(db)
	h := &users.Handler{Repo: r}

	admin := seedUser(t, r, "admin@x.com", "auth0|admin", "Admin")
	super := seedUser(t, r, "devanshukejriwal24@gmail.com", "auth0|super", "Member")

	body, _ := json.Marshal(map[string]interface{}{
		"user_id": super.ID,
		"role":    "Admin",
	})

	req := httptest.NewRequest("POST", "/update-role", bytes.NewBuffer(body))
	req = injectClaims(req, admin.OIDCID)
	w := httptest.NewRecorder()

	h.HandleUpdateRole(w, req)

	if w.Code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d", w.Code)
	}
}

func TestHandleToggleActive_CannotModifySuperAdmin(t *testing.T) {
	db := setupTestDB(t)
	r := store.NewUserRepository(db)
	h := &users.Handler{Repo: r}

	admin := seedUser(t, r, "admin@x.com", "auth0|admin", "Admin")
	super := seedUser(t, r, "devanshukejriwal24@gmail.com", "auth0|super", "Member")

	body, _ := json.Marshal(map[string]interface{}{
		"user_id":   super.ID,
		"is_active": false,
	})

	req := httptest.NewRequest("POST", "/toggle", bytes.NewBuffer(body))
	req = injectClaims(req, admin.OIDCID)
	w := httptest.NewRecorder()

	h.HandleToggleActive(w, req)

	if w.Code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d", w.Code)
	}
}
