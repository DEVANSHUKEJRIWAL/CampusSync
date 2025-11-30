// tests/event_validation_test.go
package tests

import (
	"strings"
	"testing"
	"time"

	"github.com/DEVANSHUKEJRIWAL/CampusSync/internal/events"
)

func TestCreateEventRequest_Validate(t *testing.T) {
	now := time.Now()

	tests := []struct {
		name    string
		req     events.CreateEventRequest
		wantErr bool
		errMsg  string
	}{
		{
			name: "Valid",
			req: events.CreateEventRequest{
				Title:      "Tech Talk",
				Location:   "Room 101",
				Capacity:   50,
				StartTime:  now.Add(1 * time.Hour),
				EndTime:    now.Add(2 * time.Hour),
				Visibility: "PUBLIC",
			},
			wantErr: false,
		},
		{
			name: "Missing Title",
			req: events.CreateEventRequest{
				Title:      "",
				Location:   "Room 101",
				Capacity:   50,
				StartTime:  now.Add(1 * time.Hour),
				EndTime:    now.Add(2 * time.Hour),
				Visibility: "PUBLIC",
			},
			wantErr: true,
			errMsg:  "event title is required",
		},
		{
			name: "End Before Start",
			req: events.CreateEventRequest{
				Title:      "Bad",
				Location:   "Room",
				Capacity:   50,
				StartTime:  now.Add(2 * time.Hour),
				EndTime:    now.Add(1 * time.Hour),
				Visibility: "PUBLIC",
			},
			wantErr: true,
			errMsg:  "end time must be after start time",
		},
		{
			name: "Negative Capacity",
			req: events.CreateEventRequest{
				Title:      "Small",
				Location:   "Room",
				Capacity:   -1,
				StartTime:  now.Add(1 * time.Hour),
				EndTime:    now.Add(2 * time.Hour),
				Visibility: "PUBLIC",
			},
			wantErr: true,
			errMsg:  "capacity must be greater than zero",
		},
		{
			name: "Invalid Visibility",
			req: events.CreateEventRequest{
				Title:      "Bad",
				Location:   "Room",
				Capacity:   50,
				StartTime:  now.Add(1 * time.Hour),
				EndTime:    now.Add(2 * time.Hour),
				Visibility: "INVALID",
			},
			wantErr: true,
			errMsg:  "invalid visibility",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.req.Validate()
			if (err != nil) != tt.wantErr {
				t.Fatalf("expected err=%v, got err=%v", tt.wantErr, err)
			}
			if tt.wantErr && !strings.Contains(err.Error(), tt.errMsg) {
				t.Fatalf("expected error to contain %q, got %v", tt.errMsg, err)
			}
		})
	}
}
