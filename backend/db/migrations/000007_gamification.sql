-- 1. Add Gamification fields to Users
ALTER TABLE users ADD COLUMN IF NOT EXISTS points INT DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS current_streak INT DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_attended_at TIMESTAMP(0) WITH TIME ZONE;

-- 2. Create Badges Table
CREATE TABLE IF NOT EXISTS badges (
                                      id SERIAL PRIMARY KEY,
                                      name VARCHAR(50) NOT NULL UNIQUE,
                                      description TEXT,
                                      icon VARCHAR(10) NOT NULL, -- Emoji icon like 🏆
                                      required_points INT DEFAULT 0
);

-- 3. Create User Badges (Many-to-Many)
CREATE TABLE IF NOT EXISTS user_badges (
                                           user_id INT REFERENCES users(id) ON DELETE CASCADE,
                                           badge_id INT REFERENCES badges(id) ON DELETE CASCADE,
                                           earned_at TIMESTAMP(0) WITH TIME ZONE DEFAULT NOW(),
                                           PRIMARY KEY (user_id, badge_id)
);

-- 4. Seed Default Badges
INSERT INTO badges (name, description, icon, required_points) VALUES
                                                                  ('First Steps', 'Attended your first event', '🌱', 10),
                                                                  ('Rising Star', 'Earned 50 points', '⭐', 50),
                                                                  ('Campus Hero', 'Earned 100 points', '🚀', 100),
                                                                  ('Legend', 'Earned 500 points', '👑', 500)
ON CONFLICT (name) DO NOTHING;