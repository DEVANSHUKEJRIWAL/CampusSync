CREATE TABLE IF NOT EXISTS notifications
(
    id         BIGSERIAL PRIMARY KEY,
    user_id    INT                         NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    message    TEXT                        NOT NULL,
    is_read    BOOLEAN                              DEFAULT FALSE,
    created_at TIMESTAMP(0) WITH TIME ZONE NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_notif_user ON notifications (user_id);