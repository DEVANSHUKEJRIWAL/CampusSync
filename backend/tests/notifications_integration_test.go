package tests

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/DEVANSHUKEJRIWAL/CampusSync/internal/notifications"
	"github.com/DEVANSHUKEJRIWAL/CampusSync/internal/store"
)

func TestNotificationsStoreAndHandler(t *testing.T) {
	db := setupTestDB(t)

	userRepo := store.NewUserRepository(db)
	eventRepo := store.NewEventRepository(db)

	ctx := context.Background()
	u := seedUser(t, userRepo, "notif@example.com", "auth0|notif", "Member")

	// Create a few notifications via repository
	if err := eventRepo.CreateNotification(ctx, u.ID, "Message 1"); err != nil {
		t.Fatalf("CreateNotification: %v", err)
	}
	if err := eventRepo.CreateNotification(ctx, u.ID, "Message 2"); err != nil {
		t.Fatalf("CreateNotification: %v", err)
	}

	// List them via handler
	h := &notifications.Handler{
		Repo:     eventRepo,
		UserRepo: userRepo,
	}

	req := httptest.NewRequest(http.MethodGet, "/notifications", nil)
	req = injectClaims(req, u.OIDCID)
	w := httptest.NewRecorder()

	h.HandleListNotifications(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	var got []*store.Notification
	if err := json.Unmarshal(w.Body.Bytes(), &got); err != nil {
		t.Fatalf("unmarshal notifications: %v", err)
	}
	if len(got) != 2 {
		t.Fatalf("expected 2 notifications, got %d", len(got))
	}

	// Mark them as read
	req2 := httptest.NewRequest(http.MethodPost, "/notifications/read", nil)
	req2 = injectClaims(req2, u.OIDCID)
	w2 := httptest.NewRecorder()
	h.HandleMarkRead(w2, req2)

	if w2.Code != http.StatusOK {
		t.Fatalf("expected 200 from mark read, got %d", w2.Code)
	}

	// Confirm is_read changed
	rows, err := db.QueryContext(ctx, "SELECT is_read FROM notifications WHERE user_id=$1", u.ID)
	if err != nil {
		t.Fatalf("query notifications: %v", err)
	}
	defer rows.Close()

	for rows.Next() {
		var isRead bool
		if err := rows.Scan(&isRead); err != nil {
			t.Fatalf("scan: %v", err)
		}
		if !isRead {
			t.Fatalf("expected all notifications to be read")
		}
	}
}
