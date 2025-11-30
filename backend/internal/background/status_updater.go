package background

import (
	"context"
	"database/sql"
	"log"
	"time"
)

type StatusUpdater struct {
	DB *sql.DB
}

func NewStatusUpdater(db *sql.DB) *StatusUpdater {
	return &StatusUpdater{DB: db}
}

func (s *StatusUpdater) Start() {
	ticker := time.NewTicker(1 * time.Minute)
	go func() {
		for {
			select {
			case <-ticker.C:
				s.updateStatuses()
			}
		}
	}()
}

func (s *StatusUpdater) updateStatuses() {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	queryInProgress := `
		UPDATE events 
		SET status = 'IN_PROGRESS', updated_at = NOW()
		WHERE status = 'UPCOMING' AND start_time <= NOW() AND end_time > NOW()
	`
	res1, err := s.DB.ExecContext(ctx, queryInProgress)
	var rows1 int64
	if err != nil {
		log.Printf("Error updating IN_PROGRESS events: %v", err)
	} else {
		rows1, _ = res1.RowsAffected()
	}

	queryCompleted := `
		UPDATE events 
		SET status = 'COMPLETED', updated_at = NOW()
		WHERE (status = 'UPCOMING' OR status = 'IN_PROGRESS') AND end_time <= NOW()
	`
	res2, err := s.DB.ExecContext(ctx, queryCompleted)
	var rows2 int64
	if err != nil {
		log.Printf("Error updating COMPLETED events: %v", err)
	} else {
		rows2, _ = res2.RowsAffected()
	}

	if rows1 > 0 || rows2 > 0 {
		log.Printf("🔄 [Background Job] Status Update: %d started, %d completed.", rows1, rows2)
	}
}

// Test_UpdateStatuses is only used in tests.
func (s *StatusUpdater) Test_UpdateStatuses() {
	s.updateStatuses()
}
