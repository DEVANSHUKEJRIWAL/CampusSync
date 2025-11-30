package tests

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"
	"time"

	"github.com/DEVANSHUKEJRIWAL/CampusSync/internal/events"
	"github.com/DEVANSHUKEJRIWAL/CampusSync/internal/notifications"
	"github.com/DEVANSHUKEJRIWAL/CampusSync/internal/store"
)

func TestHandleListEvents_SearchAndFilter(t *testing.T) {
	db := setupTestDB(t)

	userRepo := store.NewUserRepository(db)
	eventRepo := store.NewEventRepository(db)
	nsvc := notifications.NewService()

	h := &events.Handler{
		Repo:          eventRepo,
		UserRepo:      userRepo,
		Notifications: nsvc,
	}

	ctx := context.Background()
	org := seedUser(t, userRepo, "orgsearch@example.com", "auth0|orgsearch", "Organizer")

	now := time.Now()
	// Seed events with different titles/locations/categories
	ev1 := &store.Event{
		Title:       "UMD Career Fair",
		Description: "Jobs!",
		Location:    "Stamp",
		StartTime:   now.Add(24 * time.Hour),
		EndTime:     now.Add(26 * time.Hour),
		Capacity:    100,
		OrganizerID: org.ID,
		Status:      "UPCOMING",
		Visibility:  "PUBLIC",
		Category:    "Career",
	}
	ev2 := &store.Event{
		Title:       "Basketball Night",
		Description: "Sports",
		Location:    "Xfinity Center",
		StartTime:   now.Add(24 * time.Hour),
		EndTime:     now.Add(26 * time.Hour),
		Capacity:    50,
		OrganizerID: org.ID,
		Status:      "UPCOMING",
		Visibility:  "PUBLIC",
		Category:    "Sports",
	}
	for _, ev := range []*store.Event{ev1, ev2} {
		if err := eventRepo.Create(ctx, ev); err != nil {
			t.Fatalf("seed event error: %v", err)
		}
	}

	t.Run("Search by query", func(t *testing.T) {
		u := url.URL{
			Path: "/api/events",
		}
		q := url.Values{}
		q.Set("q", "Career")
		u.RawQuery = q.Encode()

		req := httptest.NewRequest(http.MethodGet, u.String(), nil)
		w := httptest.NewRecorder()

		h.HandleListEvents(w, req)

		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
		}

		var got []*store.Event
		if err := json.Unmarshal(w.Body.Bytes(), &got); err != nil {
			t.Fatalf("unmarshal error: %v", err)
		}
		if len(got) == 0 {
			t.Fatalf("expected at least one event for query Career")
		}
	})

	t.Run("Filter by category", func(t *testing.T) {
		u := url.URL{Path: "/api/events"}
		q := url.Values{}
		q.Set("category", "Sports")
		u.RawQuery = q.Encode()

		req := httptest.NewRequest(http.MethodGet, u.String(), nil)
		w := httptest.NewRecorder()

		h.HandleListEvents(w, req)

		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d", w.Code)
		}

		var got []*store.Event
		if err := json.Unmarshal(w.Body.Bytes(), &got); err != nil {
			t.Fatalf("unmarshal error: %v", err)
		}
		if len(got) == 0 {
			t.Fatalf("expected at least one sports event")
		}
	})
}
