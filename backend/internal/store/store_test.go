package store

import (
	"context"
	"testing"
	"time"
)

// Helper to connect to DB for testing
func setupTestDB(t *testing.T) *EventRepository {
	// Assumes default docker-compose credentials
	dsn := "postgres://postgres:password@localhost:5432/cems?sslmode=disable"
	db, err := NewPostgresDB(dsn)
	if err != nil {
		t.Skip("Skipping DB tests: Database not available (is Docker running?)")
	}

	// Clean up previous test data
	db.Exec("DELETE FROM events WHERE title LIKE 'TEST_%'")

	return NewEventRepository(db)
}

func TestEventRepository_Lifecycle(t *testing.T) {
	repo := setupTestDB(t)
	ctx := context.Background()

	// 1. Test Create
	event := &Event{
		Title:       "TEST_Event",
		Description: "Integration Test",
		Location:    "Test Lab",
		StartTime:   time.Now().Add(24 * time.Hour),
		EndTime:     time.Now().Add(26 * time.Hour),
		Capacity:    100,
		OrganizerID: 1, // Ensure User ID 1 exists or mock it
		Status:      "UPCOMING",
		Visibility:  "PUBLIC",
	}

	err := repo.Create(ctx, event)
	if err != nil {
		t.Fatalf("Failed to create event: %v", err)
	}
	if event.ID == 0 {
		t.Error("Expected ID to be set after creation")
	}

	// 2. Test Update
	event.Location = "Updated Lab"
	err = repo.Update(ctx, event)
	if err != nil {
		t.Errorf("Failed to update event: %v", err)
	}

	// 3. Test Search (Read)
	events, err := repo.Search(ctx, "TEST_Event", "")
	if err != nil {
		t.Fatalf("Search failed: %v", err)
	}
	if len(events) == 0 {
		t.Error("Expected to find the created event")
	}
	if events[0].Location != "Updated Lab" {
		t.Error("Update did not persist")
	}
}
