-- Multi-competition: domestic leagues + Champions League
-- Keeps every existing Ligue 1 match. Safe to run twice.
BEGIN;

CREATE TABLE IF NOT EXISTS competitions (
    id SERIAL PRIMARY KEY,
    code VARCHAR(10) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    kind VARCHAR(10) NOT NULL CHECK (kind IN ('league', 'cup'))
);

INSERT INTO competitions (code, name, kind) VALUES ('F1', 'Ligue 1', 'league')
ON CONFLICT (code) DO NOTHING;

-- Existing matches are Ligue 1 matches
ALTER TABLE matches ADD COLUMN IF NOT EXISTS competition_id INTEGER REFERENCES competitions(id) ON DELETE CASCADE;
UPDATE matches SET competition_id = (SELECT id FROM competitions WHERE code = 'F1') WHERE competition_id IS NULL;
ALTER TABLE matches ALTER COLUMN competition_id SET NOT NULL;

-- Cup round, and neutral venue (finals)
ALTER TABLE matches ADD COLUMN IF NOT EXISTS round SMALLINT;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS neutral BOOLEAN NOT NULL DEFAULT FALSE;

-- Cups only have scores, and a few league matches have no stats
ALTER TABLE matches
    ALTER COLUMN home_shots DROP NOT NULL,
    ALTER COLUMN away_shots DROP NOT NULL,
    ALTER COLUMN home_shots_on_target DROP NOT NULL,
    ALTER COLUMN away_shots_on_target DROP NOT NULL,
    ALTER COLUMN home_corners DROP NOT NULL,
    ALTER COLUMN away_corners DROP NOT NULL,
    ALTER COLUMN home_yellow_cards DROP NOT NULL,
    ALTER COLUMN away_yellow_cards DROP NOT NULL,
    ALTER COLUMN home_red_cards DROP NOT NULL,
    ALTER COLUMN away_red_cards DROP NOT NULL;

-- One row per fixture: lets every insert skip matches already stored
CREATE UNIQUE INDEX IF NOT EXISTS uq_matches_fixture ON matches(competition_id, match_date, home_team_id, away_team_id);
CREATE INDEX IF NOT EXISTS idx_matches_competition ON matches(competition_id);

COMMIT;
