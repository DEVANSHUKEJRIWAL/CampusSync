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

	var exists bool
	err = tx.QueryRowContext(ctx, "SELECT EXISTS(SELECT 1 FROM registrations WHERE user_id=$1 AND event_id=$2 AND status='REGISTERED')", userID, eventID).Scan(&exists)
	if err != nil {
		return nil, err
	}
	if exists {
		return nil, errors.New("user already registered")
	}

	var capacity int
	var eventTitle string
	var userEmail string
	var visibility string

	err = tx.QueryRowContext(ctx, "SELECT title, capacity, visibility FROM events WHERE id=$1", eventID).Scan(&eventTitle, &capacity, &visibility)
	if err != nil {
		return nil, errors.New("event not found")
	}

	err = tx.QueryRowContext(ctx, "SELECT email FROM users WHERE id=$1", userID).Scan(&userEmail)
	if err != nil {
		return nil, errors.New("user not found")
	}

	if visibility == "PRIVATE" {
		var isInvited bool
		err = tx.QueryRowContext(ctx, "SELECT EXISTS(SELECT 1 FROM invitations WHERE event_id=$1 AND email=$2)", eventID, userEmail).Scan(&isInvited)
		if err != nil {
			return nil, err
		}
		if !isInvited {
			return nil, errors.New("this event is private and you are not invited")
		}
	}

	var currentCount int
	err = tx.QueryRowContext(ctx, "SELECT COUNT(*) FROM registrations WHERE event_id=$1 AND status='REGISTERED'", eventID).Scan(&currentCount)
	if err != nil {
		return nil, err
	}

	if currentCount < capacity {
		_, err = tx.ExecContext(ctx,
			"INSERT INTO registrations (user_id, event_id, status, created_at, updated_at) VALUES ($1, $2, 'REGISTERED', $3, $3)",
			userID, eventID, time.Now())
		if err != nil {
			return nil, err
		}

		msg := "Registration Confirmed! You are going to " + eventTitle
		_, err = tx.ExecContext(ctx, "INSERT INTO notifications (user_id, message) VALUES ($1, $2)", userID, msg)
		if err != nil {
			return nil, err
		}

		if err := tx.Commit(); err != nil {
			return nil, err
		}

		s.Notifications.SendRegistrationEmail(userEmail, eventTitle)

		return &RegisterResult{Status: "REGISTERED", Message: "You have successfully registered!"}, nil

	} else {
		_, err = tx.ExecContext(ctx,
			"INSERT INTO waitlist (user_id, event_id, created_at) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING",
			userID, eventID, time.Now())
		if err != nil {
			return nil, err
		}

		msg := "You are on the waitlist for " + eventTitle
		_, err = tx.ExecContext(ctx, "INSERT INTO notifications (user_id, message) VALUES ($1, $2)", userID, msg)
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

func (s *Service) CancelRegistration(ctx context.Context, userID, eventID int64) error {
	tx, err := s.DB.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	var status string
	err = tx.QueryRowContext(ctx, "SELECT status FROM registrations WHERE user_id=$1 AND event_id=$2", userID, eventID).Scan(&status)
	if err == sql.ErrNoRows {
		res, _ := tx.ExecContext(ctx, "DELETE FROM waitlist WHERE user_id=$1 AND event_id=$2", userID, eventID)
		rows, _ := res.RowsAffected()
		if rows > 0 {
			return tx.Commit()
		}
		return errors.New("registration not found")
	} else if err != nil {
		return err
	}

	_, err = tx.ExecContext(ctx, "DELETE FROM registrations WHERE user_id=$1 AND event_id=$2", userID, eventID)
	if err != nil {
		return err
	}

	if status == "REGISTERED" {
		var nextUserID int64
		err := tx.QueryRowContext(ctx,
			"SELECT user_id FROM waitlist WHERE event_id=$1 ORDER BY created_at ASC LIMIT 1",
			eventID).Scan(&nextUserID)

		if err == nil {
			_, err = tx.ExecContext(ctx, "DELETE FROM waitlist WHERE user_id=$1 AND event_id=$2", nextUserID, eventID)
			if err != nil {
				return err
			}

			_, err = tx.ExecContext(ctx,
				"INSERT INTO registrations (user_id, event_id, status, created_at, updated_at) VALUES ($1, $2, 'REGISTERED', $3, $3)",
				nextUserID, eventID, time.Now())
			if err != nil {
				return err
			}

			var email, title string
			tx.QueryRowContext(ctx, "SELECT email FROM users WHERE id=$1", nextUserID).Scan(&email)
			tx.QueryRowContext(ctx, "SELECT title FROM events WHERE id=$1", eventID).Scan(&title)

			msg := "Good news! You have been promoted off the waitlist for " + title
			_, err = tx.ExecContext(ctx, "INSERT INTO notifications (user_id, message) VALUES ($1, $2)", nextUserID, msg)
			if err != nil {
				return err
			}

			s.Notifications.SendRegistrationEmail(email, title+" (Moved off Waitlist!)")
		} else if err != sql.ErrNoRows {
			return err
		}
	}

	return tx.Commit()
}
