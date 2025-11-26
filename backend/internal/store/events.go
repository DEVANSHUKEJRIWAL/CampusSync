package store

import (
	"context"
	"database/sql"
	"fmt"
	"time"
)

type Event struct {
	ID              int64     `json:"id"`
	Title           string    `json:"title"`
	Description     string    `json:"description"`
	Location        string    `json:"location"`
	StartTime       time.Time `json:"start_time"`
	EndTime         time.Time `json:"end_time"`
	Capacity        int       `json:"capacity"`
	OrganizerID     int64     `json:"organizer_id"`
	Status          string    `json:"status"`
	Visibility      string    `json:"visibility"`
	Category        string    `json:"category"`
	RegisteredCount int       `json:"registered_count"`
	CreatedAt       time.Time `json:"created_at"`
	UpdatedAt       time.Time `json:"updated_at"`
}

type EventRepository struct {
	db *sql.DB
}

type SystemStats struct {
	TotalUsers         int     `json:"total_users"`
	ActiveUsers        int     `json:"active_users"`
	TotalEvents        int     `json:"total_events"`
	TotalRegistrations int     `json:"total_registrations"`
	AvgRating          float64 `json:"avg_rating"`
}

type Feedback struct {
	ID        int64     `json:"id"`
	EventID   int64     `json:"event_id"`
	UserID    int64     `json:"user_id"`
	Rating    int       `json:"rating"`
	Comment   string    `json:"comment"`
	CreatedAt time.Time `json:"created_at"`
}

func NewEventRepository(db *sql.DB) *EventRepository {
	return &EventRepository{db: db}
}

// Create inserts a new event
func (r *EventRepository) Create(ctx context.Context, e *Event) error {
	// 👇 FIXED: Ensure 'category' is in the INSERT list and the VALUES count matches
	query := `
		INSERT INTO events (title, description, location, start_time, end_time, capacity, organizer_id, status, visibility, category, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
		RETURNING id, created_at, updated_at
	`
	now := time.Now()

	return r.db.QueryRowContext(ctx, query,
		e.Title, e.Description, e.Location, e.StartTime, e.EndTime, e.Capacity, e.OrganizerID,
		e.Status, e.Visibility, e.Category, // 👈 ARG #10: Category
		now, now,
	).Scan(&e.ID, &e.CreatedAt, &e.UpdatedAt)
}

// Update modifies an existing event
func (r *EventRepository) Update(ctx context.Context, e *Event) error {
	// 👇 FIXED: Ensure 'category=$8' is in the UPDATE list
	query := `
		UPDATE events 
		SET title=$1, description=$2, location=$3, start_time=$4, end_time=$5, capacity=$6, visibility=$7, category=$8, updated_at=NOW()
		WHERE id=$9
	`
	_, err := r.db.ExecContext(ctx, query,
		e.Title, e.Description, e.Location, e.StartTime, e.EndTime, e.Capacity, e.Visibility, e.Category, e.ID,
	)
	return err
}

// Search retrieves events based on filters
func (r *EventRepository) Search(ctx context.Context, query, location, category string) ([]*Event, error) {
	// 👇 FIXED: Ensure 'e.category' is selected so we can scan it later
	sqlQuery := `
		SELECT e.id, e.title, e.description, e.location, e.start_time, e.end_time, 
		       e.capacity, e.organizer_id, e.status, e.visibility, e.category,
		       (SELECT COUNT(*) FROM registrations WHERE event_id = e.id AND status = 'REGISTERED') as registered_count
		FROM events e
		WHERE 1=1
	`
	args := []interface{}{}
	argId := 1

	if query != "" {
		sqlQuery += fmt.Sprintf(" AND (e.title ILIKE $%d OR e.description ILIKE $%d)", argId, argId+1)
		args = append(args, "%"+query+"%", "%"+query+"%")
		argId += 2
	}
	if location != "" {
		sqlQuery += fmt.Sprintf(" AND e.location ILIKE $%d", argId)
		args = append(args, "%"+location+"%")
		argId++
	}
	if category != "" && category != "All" {
		sqlQuery += fmt.Sprintf(" AND e.category = $%d", argId)
		args = append(args, category)
		argId++
	}

	sqlQuery += " ORDER BY e.start_time ASC"

	rows, err := r.db.QueryContext(ctx, sqlQuery, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var events []*Event
	for rows.Next() {
		var e Event
		// 👇 FIXED: Ensure &e.Category is in the Scan list at the correct position
		if err := rows.Scan(
			&e.ID, &e.Title, &e.Description, &e.Location, &e.StartTime, &e.EndTime,
			&e.Capacity, &e.OrganizerID, &e.Status, &e.Visibility, &e.Category, &e.RegisteredCount,
		); err != nil {
			return nil, err
		}
		events = append(events, &e)
	}
	return events, nil
}

// --- Helper Structs for other features ---

type Attendee struct {
	UserID    int64     `json:"user_id"`
	Email     string    `json:"email"`
	Status    string    `json:"status"`
	CreatedAt time.Time `json:"created_at"`
}

type UserEvent struct {
	EventID   int64     `json:"event_id"`
	Title     string    `json:"title"`
	Location  string    `json:"location"`
	StartTime time.Time `json:"start_time"`
	MyStatus  string    `json:"my_status"`
}

// GetAttendees fetches users for an event
func (r *EventRepository) GetAttendees(ctx context.Context, eventID int64) ([]*Attendee, error) {
	query := `
		SELECT u.id, u.email, CAST(r.status AS TEXT), r.created_at
		FROM registrations r
		JOIN users u ON r.user_id = u.id
		WHERE r.event_id = $1
		
		UNION ALL
		
		SELECT u.id, u.email, 'WAITLISTED', w.created_at
		FROM waitlist w
		JOIN users u ON w.user_id = u.id
		WHERE w.event_id = $1
		
		ORDER BY 3 ASC, 4 ASC
	`
	rows, err := r.db.QueryContext(ctx, query, eventID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []*Attendee
	for rows.Next() {
		var a Attendee
		if err := rows.Scan(&a.UserID, &a.Email, &a.Status, &a.CreatedAt); err != nil {
			return nil, err
		}
		list = append(list, &a)
	}
	return list, nil
}

// InviteUser adds an email to the invitations table
func (r *EventRepository) InviteUser(ctx context.Context, eventID int64, email string) error {
	query := "INSERT INTO invitations (event_id, email) VALUES ($1, $2) ON CONFLICT DO NOTHING"
	_, err := r.db.ExecContext(ctx, query, eventID, email)
	return err
}

// BulkInvite adds multiple emails
func (r *EventRepository) BulkInvite(ctx context.Context, eventID int64, emails []string) (int, error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return 0, err
	}
	defer tx.Rollback()

	stmt, err := tx.PrepareContext(ctx, "INSERT INTO invitations (event_id, email) VALUES ($1, $2) ON CONFLICT DO NOTHING")
	if err != nil {
		return 0, err
	}
	defer stmt.Close()

	count := 0
	for _, email := range emails {
		if email == "" {
			continue
		}
		_, err := stmt.ExecContext(ctx, eventID, email)
		if err != nil {
			return count, err
		}
		count++
	}

	if err := tx.Commit(); err != nil {
		return 0, err
	}
	return count, nil
}

// GetUserEvents fetches events for a specific user
func (r *EventRepository) GetUserEvents(ctx context.Context, userID int64) ([]*UserEvent, error) {
	query := `
		SELECT e.id, e.title, e.location, e.start_time, 'REGISTERED' as status
		FROM events e
		JOIN registrations r ON e.id = r.event_id
		WHERE r.user_id = $1
		
		UNION ALL
		
		SELECT e.id, e.title, e.location, e.start_time, 'WAITLISTED' as status
		FROM events e
		JOIN waitlist w ON e.id = w.event_id
		WHERE w.user_id = $1
		
		ORDER BY start_time ASC
	`

	rows, err := r.db.QueryContext(ctx, query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var events []*UserEvent
	for rows.Next() {
		var e UserEvent
		if err := rows.Scan(&e.EventID, &e.Title, &e.Location, &e.StartTime, &e.MyStatus); err != nil {
			return nil, err
		}
		events = append(events, &e)
	}
	return events, nil
}

func (r *EventRepository) AddFeedback(ctx context.Context, f *Feedback) error {
	query := `
		INSERT INTO event_feedback (event_id, user_id, rating, comment, created_at)
		VALUES ($1, $2, $3, $4, $5)
		ON CONFLICT (event_id, user_id) DO UPDATE
		SET rating = EXCLUDED.rating, comment = EXCLUDED.comment
		RETURNING id
	`
	return r.db.QueryRowContext(ctx, query,
		f.EventID, f.UserID, f.Rating, f.Comment, time.Now(),
	).Scan(&f.ID)
}

func (r *EventRepository) GetSystemStats(ctx context.Context) (*SystemStats, error) {
	stats := &SystemStats{}

	// 1. Count Users
	if err := r.db.QueryRowContext(ctx, "SELECT COUNT(*) FROM users").Scan(&stats.TotalUsers); err != nil {
		return nil, err
	}
	if err := r.db.QueryRowContext(ctx, "SELECT COUNT(*) FROM users WHERE is_active = true").Scan(&stats.ActiveUsers); err != nil {
		return nil, err
	}

	// 2. Count Events
	if err := r.db.QueryRowContext(ctx, "SELECT COUNT(*) FROM events").Scan(&stats.TotalEvents); err != nil {
		return nil, err
	}

	// 3. Count Registrations
	if err := r.db.QueryRowContext(ctx, "SELECT COUNT(*) FROM registrations WHERE status = 'REGISTERED'").Scan(&stats.TotalRegistrations); err != nil {
		return nil, err
	}

	// 4. Average Rating (Handle NULL if no ratings exist)
	var avg sql.NullFloat64
	if err := r.db.QueryRowContext(ctx, "SELECT AVG(rating) FROM event_feedback").Scan(&avg); err != nil {
		return nil, err
	}
	if avg.Valid {
		stats.AvgRating = avg.Float64
	} else {
		stats.AvgRating = 0.0
	}

	return stats, nil
}
