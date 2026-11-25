CREATE TABLE IF NOT EXISTS timetable (
 id INTEGER PRIMARY KEY CHECK (id = 1),
 revision INTEGER NOT NULL CHECK (revision > 0),
 state_json TEXT NOT NULL,
 updated_at TEXT NOT NULL
);
