package store

import (
	"context"
	"time"
)

type Notification struct {
	ID        int64     `json:"id"`
	UserID    int64     `json:"user_id"`
	Message   string    `json:"message"`
	IsRead    bool      `json:"is_read"`
	CreatedAt time.Time `json:"created_at"`
}

func (r *EventRepository) CreateNotification(ctx context.Context, userID int64, message string) error {
	_, err := r.db.ExecContext(ctx, "INSERT INTO notifications (user_id, message) VALUES ($1, $2)", userID, message)
	return err
}

func (r *EventRepository) GetNotifications(ctx context.Context, userID int64) ([]*Notification, error) {
	rows, err := r.db.QueryContext(ctx, "SELECT id, user_id, message, is_read, created_at FROM notifications WHERE user_id = $1 ORDER BY created_at DESC", userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var notes []*Notification
	for rows.Next() {
		var n Notification
		if err := rows.Scan(&n.ID, &n.UserID, &n.Message, &n.IsRead, &n.CreatedAt); err != nil {
			return nil, err
		}
		notes = append(notes, &n)
	}
	return notes, nil
}

func (r *EventRepository) MarkNotificationsRead(ctx context.Context, userID int64) error {
	_, err := r.db.ExecContext(ctx, "UPDATE notifications SET is_read = TRUE WHERE user_id = $1", userID)
	return err
}

func (r *EventRepository) NotifyAllAttendees(ctx context.Context, eventID int64, message string) error {
	query := `
		INSERT INTO notifications (user_id, message)
		SELECT user_id, $1 FROM registrations WHERE event_id = $2
		UNION
		SELECT user_id, $1 FROM waitlist WHERE event_id = $2
	`
	_, err := r.db.ExecContext(ctx, query, message, eventID)
	return err
}
