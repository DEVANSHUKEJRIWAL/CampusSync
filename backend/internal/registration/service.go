package registration

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"github.com/DEVANSHUKEJRIWAL/CampusSync/internal/notifications"
)

type Service struct {
	DB            *sql.DB
	Notifications *notifications.Service
}

type RegisterResult struct {
	Status  string `json:"status"`
	Message string `json:"message"`
}

func (s *Service) RegisterUserForEvent(ctx context.Context, userID, eventID int64) (*RegisterResult, error) {
	tx, err := s.DB.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	// 1. Check if already registered
	var exists bool
	err = tx.QueryRowContext(ctx, "SELECT EXISTS(SELECT 1 FROM registrations WHERE user_id=$1 AND event_id=$2 AND status='REGISTERED')", userID, eventID).Scan(&exists)
	if err != nil {
		return nil, err
	}
	if exists {
		return nil, errors.New("user already registered")
	}

	// 2. Get Event Details (INCLUDING VISIBILITY)
	var capacity int
	var eventTitle string
	var visibility string

	// 👇 UPDATED QUERY to fetch 'visibility'
	err = tx.QueryRowContext(ctx, "SELECT title, capacity, visibility FROM events WHERE id=$1", eventID).Scan(&eventTitle, &capacity, &visibility)
	if err != nil {
		return nil, errors.New("event not found")
	}

	// 3. Get User Email (Required for Invite Check)
	var userEmail string
	err = tx.QueryRowContext(ctx, "SELECT email FROM users WHERE id=$1", userID).Scan(&userEmail)
	if err != nil {
		return nil, errors.New("user not found")
	}

	if visibility == "PRIVATE" {
		var isInvited bool
		// Check if a row exists in invitations
		err = tx.QueryRowContext(ctx, "SELECT EXISTS(SELECT 1 FROM invitations WHERE event_id=$1 AND email=$2)", eventID, userEmail).Scan(&isInvited)
		if err != nil {
			return nil, err
		}
		if !isInvited {
			return nil, errors.New("this event is private and you are not invited")
		}
	}

	// 4. Capacity Check & Registration Logic
	var currentCount int
	err = tx.QueryRowContext(ctx, "SELECT COUNT(*) FROM registrations WHERE event_id=$1 AND status='REGISTERED'", eventID).Scan(&currentCount)
	if err != nil {
		return nil, err
	}

	if currentCount < capacity {
		// Register
		_, err = tx.ExecContext(ctx,
			"INSERT INTO registrations (user_id, event_id, status, created_at, updated_at) VALUES ($1, $2, 'REGISTERED', $3, $3)",
			userID, eventID, time.Now())
		if err != nil {
			return nil, err
		}
		if err := tx.Commit(); err != nil {
			return nil, err
		}

		// Async Email
		s.Notifications.SendRegistrationEmail(userEmail, eventTitle)
		return &RegisterResult{Status: "REGISTERED", Message: "You have successfully registered!"}, nil

	} else {
		// Waitlist
		_, err = tx.ExecContext(ctx,
			"INSERT INTO waitlist (user_id, event_id, created_at) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING",
			userID, eventID, time.Now())
		if err != nil {
			return nil, err
		}
		if err := tx.Commit(); err != nil {
			return nil, err
		}

		s.Notifications.SendWaitlistEmail(userEmail, eventTitle)
		return &RegisterResult{Status: "WAITLISTED", Message: "Event is full. You have been added to the waitlist."}, nil
	}
}

// Add this to backend/internal/registration/service.go

func (s *Service) CancelRegistration(ctx context.Context, userID, eventID int64) error {
	tx, err := s.DB.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	// 1. Check current status
	var status string
	err = tx.QueryRowContext(ctx, "SELECT status FROM registrations WHERE user_id=$1 AND event_id=$2", userID, eventID).Scan(&status)
	if err == sql.ErrNoRows {
		// Try to delete from waitlist if they are there
		res, _ := tx.ExecContext(ctx, "DELETE FROM waitlist WHERE user_id=$1 AND event_id=$2", userID, eventID)
		rows, _ := res.RowsAffected()
		if rows > 0 {
			return tx.Commit() // Just removed from waitlist, done.
		}
		return errors.New("registration not found")
	} else if err != nil {
		return err
	}

	// 2. Delete the registration
	_, err = tx.ExecContext(ctx, "DELETE FROM registrations WHERE user_id=$1 AND event_id=$2", userID, eventID)
	if err != nil {
		return err
	}

	// 3. IF they were "REGISTERED", we opened a spot. Check Waitlist.
	if status == "REGISTERED" {
		// Find the person who has been waiting the longest (ORDER BY created_at ASC)
		var nextUserID int64
		err := tx.QueryRowContext(ctx,
			"SELECT user_id FROM waitlist WHERE event_id=$1 ORDER BY created_at ASC LIMIT 1",
			eventID).Scan(&nextUserID)

		if err == nil {
			// A. Promote them!
			// Remove from waitlist
			_, err = tx.ExecContext(ctx, "DELETE FROM waitlist WHERE user_id=$1 AND event_id=$2", nextUserID, eventID)
			if err != nil {
				return err
			}

			// Add to registrations
			_, err = tx.ExecContext(ctx,
				"INSERT INTO registrations (user_id, event_id, status, created_at, updated_at) VALUES ($1, $2, 'REGISTERED', $3, $3)",
				nextUserID, eventID, time.Now())
			if err != nil {
				return err
			}

			// B. Get Details for Notification
			var email, title string
			tx.QueryRowContext(ctx, "SELECT email FROM users WHERE id=$1", nextUserID).Scan(&email)
			tx.QueryRowContext(ctx, "SELECT title FROM events WHERE id=$1", eventID).Scan(&title)

			// Send "You've been promoted!" email
			s.Notifications.SendRegistrationEmail(email, title+" (Moved off Waitlist!)")
		} else if err != sql.ErrNoRows {
			// Real error
			return err
		}
	}

	return tx.Commit()
}
