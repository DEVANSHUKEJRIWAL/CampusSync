ALTER TABLE events
    ADD COLUMN category VARCHAR(50) NOT NULL DEFAULT 'General';

ALTER TABLE users
    ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT TRUE;

CREATE TABLE IF NOT EXISTS event_feedback
(
    id         BIGSERIAL PRIMARY KEY,
    event_id   INT                         NOT NULL REFERENCES events (id) ON DELETE CASCADE,
    user_id    INT                         NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    rating     INT CHECK (rating >= 1 AND rating <= 5),
    comment    TEXT,
    created_at TIMESTAMP(0) WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE (event_id, user_id)
);