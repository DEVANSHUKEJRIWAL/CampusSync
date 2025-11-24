CREATE TYPE event_status AS ENUM ('UPCOMING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');
CREATE TYPE event_visibility AS ENUM ('PUBLIC', 'PRIVATE');

CREATE TABLE IF NOT EXISTS events (
                                      id BIGSERIAL PRIMARY KEY,
                                      title VARCHAR(255) NOT NULL,
                                      description TEXT,
                                      location VARCHAR(255) NOT NULL,
                                      start_time TIMESTAMP(0) WITH TIME ZONE NOT NULL,
                                      end_time TIMESTAMP(0) WITH TIME ZONE NOT NULL,
                                      capacity INT NOT NULL,
                                      organizer_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                                      status event_status NOT NULL DEFAULT 'UPCOMING',
                                      visibility event_visibility NOT NULL DEFAULT 'PUBLIC',
                                      created_at TIMESTAMP(0) WITH TIME ZONE NOT NULL DEFAULT NOW(),
                                      updated_at TIMESTAMP(0) WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_events_start_time ON events(start_time);
CREATE INDEX idx_events_organizer ON events(organizer_id);