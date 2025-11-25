package events

import (
	"strings"
	"testing"
	"time"
)

func TestCreateEventRequest_Validate(t *testing.T) {
	now := time.Now()

	tests := []struct {
		name    string
		req     CreateEventRequest
		wantErr bool
		errMsg  string
	}{
		{
			name: "Valid Request",
			req: CreateEventRequest{
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
			req: CreateEventRequest{
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
			name: "End Time Before Start",
			req: CreateEventRequest{
				Title:      "Bad Time",
				Location:   "Room 101",
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
			req: CreateEventRequest{
				Title:      "Small Room",
				Location:   "Room 101",
				Capacity:   -1,
				StartTime:  now.Add(1 * time.Hour),
				EndTime:    now.Add(2 * time.Hour),
				Visibility: "PUBLIC",
			},
			wantErr: true,
			errMsg:  "capacity must be greater than zero",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.req.Validate()
			if (err != nil) != tt.wantErr {
				t.Errorf("Validate() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if tt.wantErr && !strings.Contains(err.Error(), tt.errMsg) {
				t.Errorf("Validate() error = %v, expected substring %v", err, tt.errMsg)
			}
		})
	}
}
