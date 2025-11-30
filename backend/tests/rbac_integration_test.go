// tests/rbac_integration_test.go
package tests

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	jwtmiddleware "github.com/auth0/go-jwt-middleware/v2"
	"github.com/auth0/go-jwt-middleware/v2/validator"

	"github.com/DEVANSHUKEJRIWAL/CampusSync/internal/events"
	"github.com/DEVANSHUKEJRIWAL/CampusSync/internal/store"
	"github.com/DEVANSHUKEJRIWAL/CampusSync/internal/users"
)

func injectClaims(req *http.Request, subject string) *http.Request {
	claims := &validator.ValidatedClaims{
		RegisteredClaims: validator.RegisteredClaims{
			Subject: subject,
		},
	}
	ctx := context.WithValue(req.Context(), jwtmiddleware.ContextKey{}, claims)
	return req.WithContext(ctx)
}

func TestHandleUpdateRole_AdminCanPromoteMemberToOrganizer(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()

	userRepo := store.NewUserRepository(db)
	handler := &users.Handler{Repo: userRepo}

	ctx := context.Background()

	// Seed admin and member
	var adminID, memberID int64
	if err := db.QueryRowContext(ctx,
		`INSERT INTO users (email, oidc_id, role) VALUES ('admin@example.com', 'auth0|admin', 'Admin') RETURNING id`,
	).Scan(&adminID); err != nil {
		t.Fatalf("create admin: %v", err)
	}
	if err := db.QueryRowContext(ctx,
		`INSERT INTO users (email, oidc_id, role) VALUES ('member@example.com', 'auth0|member', 'Member') RETURNING id`,
	).Scan(&memberID); err != nil {
		t.Fatalf("create member: %v", err)
	}

	body, _ := json.Marshal(map[string]any{
		"user_id": memberID,
		"role":    "Organizer",
	})

	req := httptest.NewRequest(http.MethodPatch, "/admin/users/role", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")

	// Auth context: requester is admin (subject = admin's oidc_id)
	req = injectClaims(req, "auth0|admin")

	rr := httptest.NewRecorder()
	handler.HandleUpdateRole(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d, body=%s", rr.Code, rr.Body.String())
	}

	// Verify DB role changed
	user, err := userRepo.GetByID(ctx, memberID)
	if err != nil {
		t.Fatalf("GetByID member: %v", err)
	}
	if user.Role != "Organizer" {
		t.Fatalf("expected member role to be 'Organizer', got '%s'", user.Role)
	}
}

func TestHandleUpdateRole_NonAdminForbidden(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()

	userRepo := store.NewUserRepository(db)
	handler := &users.Handler{Repo: userRepo}

	ctx := context.Background()

	// Seed a non-admin and a target user
	var requesterID, targetID int64
	if err := db.QueryRowContext(ctx,
		`INSERT INTO users (email, oidc_id, role) VALUES ('user@example.com', 'auth0|user', 'Member') RETURNING id`,
	).Scan(&requesterID); err != nil {
		t.Fatalf("create requester: %v", err)
	}
	if err := db.QueryRowContext(ctx,
		`INSERT INTO users (email, oidc_id, role) VALUES ('target@example.com', 'auth0|target', 'Member') RETURNING id`,
	).Scan(&targetID); err != nil {
		t.Fatalf("create target: %v", err)
	}

	body, _ := json.Marshal(map[string]any{
		"user_id": targetID,
		"role":    "Organizer",
	})

	req := httptest.NewRequest(http.MethodPatch, "/admin/users/role", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	// Subject = requester's oidc_id (Member)
	req = injectClaims(req, "auth0|user")

	rr := httptest.NewRecorder()
	handler.HandleUpdateRole(rr, req)

	if rr.Code != http.StatusForbidden {
		t.Fatalf("expected 403 Forbidden, got %d, body=%s", rr.Code, rr.Body.String())
	}
}

func TestHandleCreateEvent_OnlyOrganizerOrAdminAllowed(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()

	userRepo := store.NewUserRepository(db)
	eventRepo := store.NewEventRepository(db)

	handler := &events.Handler{
		Repo:     eventRepo,
		UserRepo: userRepo,
	}

	ctx := context.Background()

	// Seed one Member and one Organizer
	var memberID, orgID int64
	if err := db.QueryRowContext(ctx,
		`INSERT INTO users (email, oidc_id, role) VALUES ('member2@example.com', 'auth0|member2', 'Member') RETURNING id`,
	).Scan(&memberID); err != nil {
		t.Fatalf("create member: %v", err)
	}
	if err := db.QueryRowContext(ctx,
		`INSERT INTO users (email, oidc_id, role) VALUES ('org@example.com', 'auth0|org', 'Organizer') RETURNING id`,
	).Scan(&orgID); err != nil {
		t.Fatalf("create organizer: %v", err)
	}

	// Common event payload
	start := time.Now().Add(2 * time.Hour)
	end := start.Add(1 * time.Hour)
	payload := events.CreateEventRequest{
		Title:       "RBAC Test Event",
		Description: "desc",
		Location:    "Hall",
		StartTime:   start,
		EndTime:     end,
		Capacity:    50,
		Visibility:  "PUBLIC",
		Category:    "General",
	}

	// 1) Member tries to create event → Forbidden
	bodyMember, _ := json.Marshal(payload)
	req1 := httptest.NewRequest(http.MethodPost, "/events", bytes.NewReader(bodyMember))
	req1.Header.Set("Content-Type", "application/json")
	req1 = injectClaims(req1, "auth0|member2") // Member

	rr1 := httptest.NewRecorder()
	handler.HandleCreateEvent(rr1, req1)

	if rr1.Code != http.StatusForbidden {
		t.Fatalf("expected 403 for Member create event, got %d, body=%s", rr1.Code, rr1.Body.String())
	}

	// 2) Organizer creates event → Created
	bodyOrg, _ := json.Marshal(payload)
	req2 := httptest.NewRequest(http.MethodPost, "/events", bytes.NewReader(bodyOrg))
	req2.Header.Set("Content-Type", "application/json")
	req2 = injectClaims(req2, "auth0|org") // Organizer

	rr2 := httptest.NewRecorder()
	handler.HandleCreateEvent(rr2, req2)

	if rr2.Code != http.StatusCreated {
		t.Fatalf("expected 201 for Organizer create event, got %d, body=%s", rr2.Code, rr2.Body.String())
	}
}
