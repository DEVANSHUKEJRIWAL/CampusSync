package tests

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
	"time"

	"github.com/DEVANSHUKEJRIWAL/CampusSync/internal/events"
	"github.com/DEVANSHUKEJRIWAL/CampusSync/internal/store"
	"github.com/DEVANSHUKEJRIWAL/CampusSync/internal/users"
)

//
// ------------------------------------------------------------
// PERFORMANCE TEST SUITE — SECTION 1 REQUIREMENTS
// ------------------------------------------------------------
//

//
// 1) Export up to 500 attendees ≤ 5 seconds
//

func TestPerformance_Export500AttendeesUnder5s(t *testing.T) {
	db := setupTestDB(t)
	repo := store.NewEventRepository(db)
	userRepo := store.NewUserRepository(db)

	h := &events.Handler{
		Repo:     repo,
		UserRepo: userRepo,
	}

	// Organizer + event
	org := seedUser(t, userRepo, "org@perf.com", "auth0|orgperf", "Organizer")
	ev := seedEvent(t, repo, org.ID, "Perf Export", "PUBLIC")

	// Insert 500 attendees
	for i := 0; i < 500; i++ {
		u := seedUser(t, userRepo, fmt.Sprintf("u%d@x.com", i), fmt.Sprintf("auth0|u%d", i), "Member")
		db.Exec(`
            INSERT INTO registrations (user_id, event_id, status, created_at, updated_at)
            VALUES ($1,$2,'REGISTERED',NOW(),NOW())
        `, u.ID, ev.ID)
	}

	req := httptest.NewRequest("GET", fmt.Sprintf("/export?event_id=%d", ev.ID), nil)
	w := httptest.NewRecorder()

	start := time.Now()
	h.HandleExportAttendees(w, req)
	duration := time.Since(start)

	if w.Code != http.StatusOK {
		t.Fatalf("unexpected status %d (%s)", w.Code, w.Body.String())
	}
	if duration > 5*time.Second {
		t.Fatalf("export took too long: %v", duration)
	}
}

//
// 2) Search/filter results for 500 events ≤ 2 seconds
//

func TestPerformance_Search500EventsUnder2s(t *testing.T) {
	db := setupTestDB(t)
	repo := store.NewEventRepository(db)
	userRepo := store.NewUserRepository(db)
	h := &events.Handler{
		Repo:     repo,
		UserRepo: userRepo,
	}

	org := seedUser(t, userRepo, "org@search.com", "auth0|orgsearch", "Organizer")

	// Seed 500 events
	for i := 0; i < 500; i++ {
		seedEvent(t, repo, org.ID, fmt.Sprintf("Searchable Event %d", i), "PUBLIC")
	}

	req := httptest.NewRequest("GET", "/events?search=Event", nil)
	w := httptest.NewRecorder()

	start := time.Now()
	h.HandleListEvents(w, req)
	duration := time.Since(start)

	if w.Code != http.StatusOK {
		t.Fatalf("unexpected status %d", w.Code)
	}
	if duration > 2*time.Second {
		t.Fatalf("search took too long: %v", duration)
	}
}

//
// 3) Account creation (SyncUser) ≤ 3 seconds
//

func TestPerformance_AccountCreationUnder3s(t *testing.T) {
	db := setupTestDB(t)
	repo := store.NewUserRepository(db)
	h := &users.Handler{
		Repo: repo,
	}

	payload := map[string]interface{}{
		"name":    "Perf User",
		"email":   "perf@x.com",
		"oidc_id": "auth0|perf",
		"role":    "Member",
	}
	body, _ := json.Marshal(payload)

	req := httptest.NewRequest("POST", "/sync", bytes.NewBuffer(body))
	req = injectClaims(req, "auth0|perf")
	w := httptest.NewRecorder()

	start := time.Now()
	h.HandleSyncUser(w, req)
	duration := time.Since(start)

	if w.Code != http.StatusOK {
		t.Fatalf("unexpected status %d (%s)", w.Code, w.Body.String())
	}
	if duration > 3*time.Second {
		t.Fatalf("account creation too slow: %v", duration)
	}
}

//
// 4) Login flow (SyncUser + claims) ≤ 3 seconds
//

func TestPerformance_LoginFlowUnder3s(t *testing.T) {
	db := setupTestDB(t)
	repo := store.NewUserRepository(db)
	h := &users.Handler{
		Repo: repo,
	}

	seedUser(t, repo, "login@x.com", "auth0|login1", "Member")

	payload := map[string]interface{}{
		"name":    "Login User",
		"email":   "login@x.com",
		"oidc_id": "auth0|login1",
	}
	body, _ := json.Marshal(payload)

	req := httptest.NewRequest("POST", "/sync", bytes.NewBuffer(body))
	req = injectClaims(req, "auth0|login1")
	w := httptest.NewRecorder()

	start := time.Now()
	h.HandleSyncUser(w, req)
	duration := time.Since(start)

	if w.Code != http.StatusOK {
		t.Fatalf("unexpected status %d", w.Code)
	}
	if duration > 3*time.Second {
		t.Fatalf("login flow took too long: %v", duration)
	}
}

//
// 5) Handle 100 concurrent login requests without errors
//

func TestPerformance_Concurrent100Logins(t *testing.T) {
	db := setupTestDB(t)
	repo := store.NewUserRepository(db)
	h := &users.Handler{
		Repo: repo,
	}

	seedUser(t, repo, "user@concurrent.com", "auth0|conc", "Member")

	payload := map[string]interface{}{
		"name":    "Concurrent User",
		"email":   "user@concurrent.com",
		"oidc_id": "auth0|conc",
	}
	body, _ := json.Marshal(payload)

	var wg sync.WaitGroup
	for i := 0; i < 100; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			req := httptest.NewRequest("POST", "/sync", bytes.NewBuffer(body))
			req = injectClaims(req, "auth0|conc")
			w := httptest.NewRecorder()

			h.HandleSyncUser(w, req)

			if w.Code != http.StatusOK {
				t.Errorf("unexpected status %d", w.Code)
			}
		}()
	}

	wg.Wait()
}
