CREATE TYPE registration_status AS ENUM ('REGISTERED', 'CANCELLED');

CREATE TABLE IF NOT EXISTS registrations
(
    id         BIGSERIAL PRIMARY KEY,
    user_id    INT                         NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    event_id   INT                         NOT NULL REFERENCES events (id) ON DELETE CASCADE,
    status     registration_status         NOT NULL DEFAULT 'REGISTERED',
    created_at TIMESTAMP(0) WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP(0) WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, event_id)
);

CREATE TABLE IF NOT EXISTS waitlist
(
    id         BIGSERIAL PRIMARY KEY,
    user_id    INT                         NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    event_id   INT                         NOT NULL REFERENCES events (id) ON DELETE CASCADE,
    created_at TIMESTAMP(0) WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, event_id)
);

CREATE INDEX idx_registrations_event ON registrations (event_id);
CREATE INDEX idx_waitlist_event ON waitlist (event_id);