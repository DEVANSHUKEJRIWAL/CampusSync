CREATE TABLE IF NOT EXISTS invitations
(
    id         BIGSERIAL PRIMARY KEY,
    event_id   INT                         NOT NULL REFERENCES events (id) ON DELETE CASCADE,
    email      VARCHAR(255)                NOT NULL,
    created_at TIMESTAMP(0) WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE (event_id, email)
);

CREATE INDEX idx_invitations_email ON invitations (email);