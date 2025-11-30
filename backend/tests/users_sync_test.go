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

func TestHandleSyncUser_InvalidJSON(t *testing.T) {
	db := setupTestDB(t)
	repo := store.NewUserRepository(db)
	h := &users.Handler{Repo: repo}

	req := httptest.NewRequest("POST", "/sync", bytes.NewBuffer([]byte("{bad json")))
	req = injectClaims(req, "auth0|abc")
	w := httptest.NewRecorder()

	h.HandleSyncUser(w, req)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", w.Code)
	}
}

func TestHandleSyncUser_MissingFields(t *testing.T) {
	db := setupTestDB(t)
	repo := store.NewUserRepository(db)
	h := &users.Handler{Repo: repo}

	body, _ := json.Marshal(map[string]interface{}{
		"name": "Only Name",
		// missing: email, oidc_id
	})

	req := httptest.NewRequest("POST", "/sync", bytes.NewBuffer(body))
	req = injectClaims(req, "auth0|abc")
	w := httptest.NewRecorder()

	h.HandleSyncUser(w, req)

	// TODO : Should this be a 400?
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 (backend does not enforce required fields), got %d", w.Code)
	}
}

func TestHandleSyncUser_CreatesNewUser(t *testing.T) {
	db := setupTestDB(t)
	repo := store.NewUserRepository(db)
	h := &users.Handler{Repo: repo}

	body, _ := json.Marshal(map[string]interface{}{
		"email":   "jane@x.com",
		"oidc_id": "auth0|jane1",
		"role":    "Member",
	})

	req := httptest.NewRequest("POST", "/sync", bytes.NewBuffer(body))
	req = injectClaims(req, "auth0|jane1")
	w := httptest.NewRecorder()

	h.HandleSyncUser(w, req)

	// TODO : Should this be a 201?
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 (backend returns OK for create), got %d (%s)", w.Code, w.Body.String())
	}

	var u store.User
	err := db.QueryRow(`SELECT email, role FROM users WHERE oidc_id='auth0|jane1'`).Scan(
		&u.Email, &u.Role)
	if err != nil {
		t.Fatalf("user not created: %v", err)
	}

	if u.Role != "Member" {
		t.Fatalf("expected role Member, got %s", u.Role)
	}
}

func TestHandleSyncUser_UpdatesExistingUser(t *testing.T) {
	db := setupTestDB(t)
	repo := store.NewUserRepository(db)
	h := &users.Handler{Repo: repo}

	existing := seedUser(t, repo, "old@x.com", "auth0|old", "Member")

	body, _ := json.Marshal(map[string]interface{}{
		"name":    "New Name",
		"email":   "old@x.com",
		"oidc_id": existing.OIDCID,
		"role":    "Organizer",
	})

	req := httptest.NewRequest("POST", "/sync", bytes.NewBuffer(body))
	req = injectClaims(req, existing.OIDCID)
	w := httptest.NewRecorder()

	h.HandleSyncUser(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}

	var role string
	db.QueryRow(`SELECT role FROM users WHERE id=$1`, existing.ID).Scan(&role)

	// TODO: SyncUser does NOT update roles of existing users, should it?
	if role != "Member" {
		t.Fatalf("expected role to remain Member (SyncUser does NOT update roles), got %s", role)
	}

}

func TestHandleSyncUser_DuplicateOIDCID(t *testing.T) {
	db := setupTestDB(t)
	repo := store.NewUserRepository(db)
	h := &users.Handler{Repo: repo}

	seedUser(t, repo, "a@x.com", "auth0|dup", "Member")

	body, _ := json.Marshal(map[string]interface{}{
		"name":    "A",
		"email":   "a@x.com",
		"oidc_id": "auth0|dup",
	})

	req := httptest.NewRequest("POST", "/sync", bytes.NewBuffer(body))
	req = injectClaims(req, "auth0|dup")
	w := httptest.NewRecorder()

	h.HandleSyncUser(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 (existing updated), got %d", w.Code)
	}
}
