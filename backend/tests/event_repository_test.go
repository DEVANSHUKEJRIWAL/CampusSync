// tests/event_repository_test.go
package tests

import (
	"context"
	"testing"
	"time"

	"github.com/DEVANSHUKEJRIWAL/CampusSync/internal/store"
)

func TestEventRepository_CRUDSearch(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()

	ctx := context.Background()
	repo := store.NewEventRepository(db)

	// Create test user (organizer)
	var organizerID int64
	if err := db.QueryRowContext(ctx,
		`INSERT INTO users (email, oidc_id, role) VALUES ('org@example.com', 'auth0|org', 'Organizer') RETURNING id`,
	).Scan(&organizerID); err != nil {
		t.Fatalf("failed to seed organizer: %v", err)
	}

	event := &store.Event{
		Title:       "TEST_Event",
		Description: "Integration Test",
		Location:    "Test Lab",
		StartTime:   time.Now().Add(24 * time.Hour),
		EndTime:     time.Now().Add(26 * time.Hour),
		Capacity:    100,
		OrganizerID: organizerID,
		Status:      "UPCOMING",
		Visibility:  "PUBLIC",
		Category:    "General",
	}

	// CREATE
	if err := repo.Create(ctx, event); err != nil {
		t.Fatalf("Create() failed: %v", err)
	}
	if event.ID == 0 {
		t.Fatalf("Create() should populate ID")
	}

	// UPDATE
	event.Location = "Updated Lab"
	if err := repo.Update(ctx, event); err != nil {
		t.Fatalf("Update() failed: %v", err)
	}

	// SEARCH
	list, err := repo.Search(ctx, "TEST_Event", "", "")
	if err != nil {
		t.Fatalf("Search() failed: %v", err)
	}
	if len(list) == 0 {
		t.Fatalf("Search() should return the updated event")
	}
	if list[0].Location != "Updated Lab" {
		t.Fatalf("Update() did not persist (got %s)", list[0].Location)
	}
}

func TestEventRepository_AttendeesAndInvites(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()

	ctx := context.Background()
	repo := store.NewEventRepository(db)

	// Seed organizer + members
	var orgID, u1, u2 int64
	db.QueryRowContext(ctx, `INSERT INTO users (email, oidc_id, role) VALUES ('org2@example.com','auth0|org2','Organizer') RETURNING id`).Scan(&orgID)
	db.QueryRowContext(ctx, `INSERT INTO users (email, oidc_id, role) VALUES ('u1@example.com','auth0|u1','Member') RETURNING id`).Scan(&u1)
	db.QueryRowContext(ctx, `INSERT INTO users (email, oidc_id, role) VALUES ('u2@example.com','auth0|u2','Member') RETURNING id`).Scan(&u2)

	// Create event
	start := time.Now().Add(24 * time.Hour)
	end := start.Add(2 * time.Hour)
	var eventID int64
	db.QueryRowContext(ctx, `
		INSERT INTO events (title, location, start_time, end_time, capacity, organizer_id, status, visibility, category)
		VALUES ('AttendeeTest','Hall',$1,$2,5,$3,'UPCOMING','PUBLIC','General') RETURNING id
	`, start, end, orgID).Scan(&eventID)

	// Register user
	db.ExecContext(ctx, `
		INSERT INTO registrations (user_id, event_id, status)
		VALUES ($1, $2, 'REGISTERED')
	`, u1, eventID)

	// Add to waitlist
	db.ExecContext(ctx, `
		INSERT INTO waitlist (user_id, event_id) VALUES ($1, $2)
	`, u2, eventID)

	// Add invited email
	db.ExecContext(ctx, `
		INSERT INTO invitations (event_id, email) VALUES ($1, 'invited@example.com')
	`, eventID)

	attendees, err := repo.GetAttendees(ctx, eventID)
	if err != nil {
		t.Fatalf("GetAttendees(): %v", err)
	}

	if len(attendees) != 3 {
		t.Fatalf("expected 3 attendee rows (1 reg, 1 waitlist, 1 invited), got %d", len(attendees))
	}
}
