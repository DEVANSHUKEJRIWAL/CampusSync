-- 1. Add Category to Events
ALTER TABLE events ADD COLUMN category VARCHAR(50) NOT NULL DEFAULT 'General';

-- 2. Add Active Status to Users (for Deactivation)
ALTER TABLE users ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT TRUE;

-- 3. Create Feedback Table
CREATE TABLE IF NOT EXISTS event_feedback (
                                              id BIGSERIAL PRIMARY KEY,
                                              event_id INT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
                                              user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                                              rating INT CHECK (rating >= 1 AND rating <= 5),
                                              comment TEXT,
                                              created_at TIMESTAMP(0) WITH TIME ZONE NOT NULL DEFAULT NOW(),
                                              UNIQUE(event_id, user_id) -- One feedback per user per event
);