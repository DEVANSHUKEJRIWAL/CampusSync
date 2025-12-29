package store

import (
	"context"
	"database/sql"
	"encoding/csv"
	"fmt"
	"io"
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

type Feedback struct {
	ID        int64     `json:"id"`
	EventID   int64     `json:"event_id"`
	UserID    int64     `json:"user_id"`
	Rating    int       `json:"rating"`
	Comment   string    `json:"comment"`
	CreatedAt time.Time `json:"created_at"`
}

type SystemStats struct {
	TotalUsers         int            `json:"total_users"`
	ActiveUsers        int            `json:"active_users"`
	TotalEvents        int            `json:"total_events"`
	TotalRegistrations int            `json:"total_registrations"`
	AvgRating          float64        `json:"avg_rating"`
	TotalAttended      int            `json:"total_attended"`
	AttendanceRate     float64        `json:"attendance_rate"`
	WeeklyHeatmap      map[string]int `json:"weekly_heatmap"`
}

type EventRepository struct {
	db *sql.DB
}

type AnalyticsSummary struct {
	TotalRegistrations int            `json:"total_registrations"`
	TotalAttended      int            `json:"total_attended"`
	AttendanceRate     float64        `json:"attendance_rate"`
	WeeklyHeatmap      map[string]int `json:"weekly_heatmap"` // e.g., "Monday": 5
}

func NewEventRepository(db *sql.DB) *EventRepository {
	return &EventRepository{db: db}
}

func (r *EventRepository) Create(ctx context.Context, e *Event) error {
	query := `
		INSERT INTO events (title, description, location, start_time, end_time, capacity, organizer_id, status, visibility, category, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
		RETURNING id, created_at, updated_at
	`
	now := time.Now()
	return r.db.QueryRowContext(ctx, query,
		e.Title, e.Description, e.Location, e.StartTime, e.EndTime, e.Capacity, e.OrganizerID,
		e.Status, e.Visibility, e.Category,
		now, now,
	).Scan(&e.ID, &e.CreatedAt, &e.UpdatedAt)
}

func (r *EventRepository) Update(ctx context.Context, e *Event) error {
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

func (r *EventRepository) Search(ctx context.Context, query, location, category string) ([]*Event, error) {
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

func (r *EventRepository) GetEventByID(ctx context.Context, id int64) (*Event, error) {
	query := `
		SELECT e.id, e.title, e.description, e.location, e.start_time, e.end_time, 
		       e.capacity, e.organizer_id, e.status, e.visibility, e.category,
		       (SELECT COUNT(*) FROM registrations WHERE event_id = e.id AND status = 'REGISTERED') as registered_count
		FROM events e
		WHERE e.id = $1
	`
	var e Event
	err := r.db.QueryRowContext(ctx, query, id).Scan(
		&e.ID, &e.Title, &e.Description, &e.Location, &e.StartTime, &e.EndTime,
		&e.Capacity, &e.OrganizerID, &e.Status, &e.Visibility, &e.Category, &e.RegisteredCount,
	)
	if err != nil {
		return nil, err
	}
	return &e, nil
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
	stats := &SystemStats{
		WeeklyHeatmap: make(map[string]int),
	}

	if err := r.db.QueryRowContext(ctx, "SELECT COUNT(*) FROM users").Scan(&stats.TotalUsers); err != nil {
		return nil, err
	}
	if err := r.db.QueryRowContext(ctx, "SELECT COUNT(*) FROM users WHERE is_active = true").Scan(&stats.ActiveUsers); err != nil {
		return nil, err
	}
	if err := r.db.QueryRowContext(ctx, "SELECT COUNT(*) FROM events").Scan(&stats.TotalEvents); err != nil {
		return nil, err
	}

	// 2. Registration & Attendance Logic
	queryReg := `
		SELECT 
			COUNT(*) as total,
			COUNT(CASE WHEN status = 'ATTENDED' THEN 1 END) as attended
		FROM registrations
	`
	if err := r.db.QueryRowContext(ctx, queryReg).Scan(&stats.TotalRegistrations, &stats.TotalAttended); err != nil {
		return nil, err
	}

	if stats.TotalRegistrations > 0 {
		stats.AttendanceRate = (float64(stats.TotalAttended) / float64(stats.TotalRegistrations)) * 100
	}

	// 3. Average Rating
	var avg sql.NullFloat64
	if err := r.db.QueryRowContext(ctx, "SELECT AVG(rating) FROM event_feedback").Scan(&avg); err != nil {
		return nil, err
	}
	if avg.Valid {
		stats.AvgRating = avg.Float64
	} else {
		stats.AvgRating = 0.0
	}

	// 4. Weekly Heatmap (The missing piece!)
	queryHeatmap := `
		SELECT TRIM(TO_CHAR(e.start_time, 'Day')), COUNT(r.id)
		FROM events e
		JOIN registrations r ON e.id = r.event_id
		WHERE r.status = 'ATTENDED'
		GROUP BY 1
	`
	rows, err := r.db.QueryContext(ctx, queryHeatmap)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var day string
		var count int
		if err := rows.Scan(&day, &count); err != nil {
			return nil, err
		}
		stats.WeeklyHeatmap[day] = count
	}

	return stats, nil
}

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
	EndTime   time.Time `json:"end_time"`
	MyStatus  string    `json:"my_status"`
}

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

		UNION ALL

		SELECT 0 as id, email, 'INVITED' as status, created_at
		FROM invitations
		WHERE event_id = $1
		AND email NOT IN (SELECT u.email FROM registrations r JOIN users u ON r.user_id = u.id WHERE r.event_id = $1)
		
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

func (r *EventRepository) InviteUser(ctx context.Context, eventID int64, email string) error {
	query := "INSERT INTO invitations (event_id, email) VALUES ($1, $2) ON CONFLICT DO NOTHING"
	_, err := r.db.ExecContext(ctx, query, eventID, email)
	return err
}

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
		res, err := stmt.ExecContext(ctx, eventID, email)
		if err != nil {
			return count, err
		}
		rows, _ := res.RowsAffected()
		if rows > 0 {
			count++
		}
	}

	if err := tx.Commit(); err != nil {
		return 0, err
	}
	return count, nil
}

func (r *EventRepository) GetUserEvents(ctx context.Context, userID int64) ([]*UserEvent, error) {
	query := `
		SELECT e.id, e.title, e.location, e.start_time, e.end_time, CAST(r.status AS TEXT)
		FROM events e
		JOIN registrations r ON e.id = r.event_id
		WHERE r.user_id = $1
		
		UNION ALL
		
		SELECT e.id, e.title, e.location, e.start_time, e.end_time, 'WAITLISTED' as status
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
		if err := rows.Scan(&e.EventID, &e.Title, &e.Location, &e.StartTime, &e.EndTime, &e.MyStatus); err != nil {
			return nil, err
		}
		events = append(events, &e)
	}
	return events, nil
}

func (r *EventRepository) MarkAttended(ctx context.Context, eventID, userID int64) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	res, err := tx.ExecContext(ctx, "UPDATE registrations SET status='ATTENDED' WHERE event_id=$1 AND user_id=$2 AND status='REGISTERED'", eventID, userID)
	if err != nil {
		return err
	}

	rows, _ := res.RowsAffected()
	if rows == 0 {
		return nil
	}

	_, err = tx.ExecContext(ctx, "UPDATE users SET points = points + 10, last_attended_at = NOW() WHERE id = $1", userID)
	if err != nil {
		return err
	}

	queryBadges := `
        INSERT INTO user_badges (user_id, badge_id)
        SELECT $1, id FROM badges 
        WHERE required_points <= (SELECT points FROM users WHERE id = $1)
        ON CONFLICT DO NOTHING
    `
	_, err = tx.ExecContext(ctx, queryBadges, userID)
	if err != nil {
		return err
	}

	return tx.Commit()
}

func (r *EventRepository) GetRegistrationStatus(ctx context.Context, eventID, userID int64) (string, error) {
	var status string
	err := r.db.QueryRowContext(ctx, "SELECT status FROM registrations WHERE event_id=$1 AND user_id=$2", eventID, userID).Scan(&status)
	return status, err
}

func (r *EventRepository) GetAnalytics(ctx context.Context) (*AnalyticsSummary, error) {
	summary := &AnalyticsSummary{WeeklyHeatmap: make(map[string]int)}

	// 1. Get Drop-off Stats
	queryStats := `
        SELECT 
            COUNT(*) as total,
            COUNT(CASE WHEN status = 'ATTENDED' THEN 1 END) as attended
        FROM registrations
    `
	err := r.db.QueryRowContext(ctx, queryStats).Scan(&summary.TotalRegistrations, &summary.TotalAttended)
	if err != nil {
		return nil, err
	}

	if summary.TotalRegistrations > 0 {
		summary.AttendanceRate = (float64(summary.TotalAttended) / float64(summary.TotalRegistrations)) * 100
	}

	queryHeatmap := `
        SELECT TRIM(TO_CHAR(e.start_time, 'Day')), COUNT(r.id)
        FROM events e
        JOIN registrations r ON e.id = r.event_id
        WHERE r.status = 'ATTENDED'
        GROUP BY 1
    `
	rows, err := r.db.QueryContext(ctx, queryHeatmap)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var day string
		var count int
		if err := rows.Scan(&day, &count); err != nil {
			return nil, err
		}
		summary.WeeklyHeatmap[day] = count
	}

	return summary, nil
}

// ExportAllData generates a CSV of ALL registrations in the system
func (r *EventRepository) ExportAllData(ctx context.Context, w io.Writer) error {
	query := `
        SELECT e.title, e.start_time, u.email, u.role, r.status, r.created_at
        FROM registrations r
        JOIN events e ON r.event_id = e.id
        JOIN users u ON r.user_id = u.id
        ORDER BY e.start_time DESC
    `
	rows, err := r.db.QueryContext(ctx, query)
	if err != nil {
		return err
	}
	defer rows.Close()

	writer := csv.NewWriter(w)
	defer writer.Flush()

	// Header
	writer.Write([]string{"Event Title", "Event Date", "User Email", "User Role", "Status", "Registered At"})

	for rows.Next() {
		var title, email, role, status string
		var evtDate, regDate time.Time
		if err := rows.Scan(&title, &evtDate, &email, &role, &status, &regDate); err != nil {
			return err
		}
		writer.Write([]string{
			title,
			evtDate.Format("2006-01-02 15:04"),
			email,
			role,
			status,
			regDate.Format("2006-01-02 15:04"),
		})
	}
	return nil
}
