// tests/registration_integration_test.go
package tests

import (
	"context"
	"testing"
	"time"

	"github.com/DEVANSHUKEJRIWAL/CampusSync/internal/notifications"
	"github.com/DEVANSHUKEJRIWAL/CampusSync/internal/registration"
)

func TestRegistration_CapacityAndWaitlistAndPromotion(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()

	ctx := context.Background()
	notifySvc := notifications.NewService()
	svc := &registration.Service{
		DB:            db,
		Notifications: notifySvc,
	}

	// Seed two users
	var u1, u2 int64
	if err := db.QueryRowContext(ctx,
		`INSERT INTO users (email, oidc_id, role) VALUES ($1, $2, 'Member') RETURNING id`,
		"user1@example.com", "auth0|user1",
	).Scan(&u1); err != nil {
		t.Fatalf("create user1: %v", err)
	}
	if err := db.QueryRowContext(ctx,
		`INSERT INTO users (email, oidc_id, role) VALUES ($1, $2, 'Member') RETURNING id`,
		"user2@example.com", "auth0|user2",
	).Scan(&u2); err != nil {
		t.Fatalf("create user2: %v", err)
	}

	// Event with capacity 1
	var eventID int64
	start := time.Now().Add(2 * time.Hour)
	end := start.Add(1 * time.Hour)
	if err := db.QueryRowContext(ctx, `
		INSERT INTO events (title, description, location, start_time, end_time, capacity, organizer_id, status, visibility, category)
		VALUES ('TEST_Capacity', 'desc', 'Room', $1, $2, 1, $3, 'UPCOMING', 'PUBLIC', 'General')
		RETURNING id
	`, start, end, u1).Scan(&eventID); err != nil {
		t.Fatalf("create event: %v", err)
	}

	// First user registers → REGISTERED
	res1, err := svc.RegisterUserForEvent(ctx, u1, eventID)
	if err != nil {
		t.Fatalf("RegisterUserForEvent u1: %v", err)
	}
	if res1.Status != "REGISTERED" {
		t.Fatalf("expected REGISTERED for user1, got %s", res1.Status)
	}

	// Second user registers → WAITLISTED
	res2, err := svc.RegisterUserForEvent(ctx, u2, eventID)
	if err != nil {
		t.Fatalf("RegisterUserForEvent u2: %v", err)
	}
	if res2.Status != "WAITLISTED" {
		t.Fatalf("expected WAITLISTED for user2, got %s", res2.Status)
	}

	// Ensure DB state matches expectations
	var countReg, countWL int
	if err := db.QueryRowContext(ctx,
		`SELECT COUNT(*) FROM registrations WHERE event_id=$1 AND status='REGISTERED'`, eventID,
	).Scan(&countReg); err != nil {
		t.Fatalf("count registrations: %v", err)
	}
	if err := db.QueryRowContext(ctx,
		`SELECT COUNT(*) FROM waitlist WHERE event_id=$1`, eventID,
	).Scan(&countWL); err != nil {
		t.Fatalf("count waitlist: %v", err)
	}
	if countReg != 1 || countWL != 1 {
		t.Fatalf("expected 1 registered, 1 waitlisted; got %d registered, %d waitlisted", countReg, countWL)
	}

	// Cancel user1 → user2 should be promoted off waitlist
	if err := svc.CancelRegistration(ctx, u1, eventID); err != nil {
		t.Fatalf("CancelRegistration u1: %v", err)
	}

	// After cancellation, user1 removed; user2 REGISTERED; waitlist empty
	if err := db.QueryRowContext(ctx,
		`SELECT COUNT(*) FROM registrations WHERE event_id=$1 AND user_id=$2`,
		eventID, u1,
	).Scan(&countReg); err != nil {
		t.Fatalf("count u1 registrations: %v", err)
	}
	if countReg != 0 {
		t.Fatalf("expected user1 to have 0 registrations after cancel, got %d", countReg)
	}

	if err := db.QueryRowContext(ctx,
		`SELECT COUNT(*) FROM registrations WHERE event_id=$1 AND user_id=$2 AND status='REGISTERED'`,
		eventID, u2,
	).Scan(&countReg); err != nil {
		t.Fatalf("count u2 registrations: %v", err)
	}
	if countReg != 1 {
		t.Fatalf("expected user2 to be REGISTERED after promotion, got %d rows", countReg)
	}

	if err := db.QueryRowContext(ctx,
		`SELECT COUNT(*) FROM waitlist WHERE event_id=$1`,
		eventID,
	).Scan(&countWL); err != nil {
		t.Fatalf("count waitlist after promotion: %v", err)
	}
	if countWL != 0 {
		t.Fatalf("expected empty waitlist after promotion, got %d rows", countWL)
	}
}

func TestRegistration_PrivateEventRequiresInvitation(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()

	ctx := context.Background()
	notifySvc := notifications.NewService()
	svc := &registration.Service{
		DB:            db,
		Notifications: notifySvc,
	}

	// Seed user
	var userID int64
	email := "private-user@example.com"
	if err := db.QueryRowContext(ctx,
		`INSERT INTO users (email, oidc_id, role) VALUES ($1, $2, 'Member') RETURNING id`,
		email, "auth0|privuser",
	).Scan(&userID); err != nil {
		t.Fatalf("create user: %v", err)
	}

	// PRIVATE event with capacity 10
	var eventID int64
	start := time.Now().Add(24 * time.Hour)
	end := start.Add(2 * time.Hour)
	if err := db.QueryRowContext(ctx, `
		INSERT INTO events (title, description, location, start_time, end_time, capacity, organizer_id, status, visibility, category)
		VALUES ('TEST_Private', 'desc', 'Lab', $1, $2, 10, $3, 'UPCOMING', 'PRIVATE', 'General')
		RETURNING id
	`, start, end, userID).Scan(&eventID); err != nil {
		t.Fatalf("create private event: %v", err)
	}

	// Attempt to register without invitation → should fail
	if _, err := svc.RegisterUserForEvent(ctx, userID, eventID); err == nil {
		t.Fatalf("expected error for non-invited user on PRIVATE event, got nil")
	}

	// Insert invitation
	if _, err := db.ExecContext(ctx,
		`INSERT INTO invitations (event_id, email) VALUES ($1, $2)`,
		eventID, email,
	); err != nil {
		t.Fatalf("insert invitation: %v", err)
	}

	// Now registration should succeed
	res, err := svc.RegisterUserForEvent(ctx, userID, eventID)
	if err != nil {
		t.Fatalf("RegisterUserForEvent (invited) failed: %v", err)
	}
	if res.Status != "REGISTERED" {
		t.Fatalf("expected REGISTERED for invited user, got %s", res.Status)
	}
}

func TestRegistration_PreventDuplicateRegistration(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()

	ctx := context.Background()
	notifySvc := notifications.NewService()
	svc := &registration.Service{
		DB:            db,
		Notifications: notifySvc,
	}

	// Seed user and event
	var userID, eventID int64
	if err := db.QueryRowContext(ctx,
		`INSERT INTO users (email, oidc_id, role) VALUES ('dup@example.com', 'auth0|dup', 'Member') RETURNING id`,
	).Scan(&userID); err != nil {
		t.Fatalf("create user: %v", err)
	}

	start := time.Now().Add(2 * time.Hour)
	end := start.Add(1 * time.Hour)
	if err := db.QueryRowContext(ctx, `
		INSERT INTO events (title, description, location, start_time, end_time, capacity, organizer_id, status, visibility, category)
		VALUES ('TEST_Dup', 'desc', 'Room', $1, $2, 100, $3, 'UPCOMING', 'PUBLIC', 'General')
		RETURNING id
	`, start, end, userID).Scan(&eventID); err != nil {
		t.Fatalf("create event: %v", err)
	}

	// First registration OK
	if _, err := svc.RegisterUserForEvent(ctx, userID, eventID); err != nil {
		t.Fatalf("first registration failed: %v", err)
	}

	// Second registration should return error "user already registered"
	if _, err := svc.RegisterUserForEvent(ctx, userID, eventID); err == nil {
		t.Fatalf("expected error on duplicate registration, got nil")
	}
}
