-- Database init
DROP TABLE IF EXISTS predictions;
DROP TABLE IF EXISTS matches;
DROP TABLE IF EXISTS teams;
DROP TABLE IF EXISTS seasons;
DROP TABLE IF EXISTS competitions;

CREATE TABLE competitions (
    id SERIAL PRIMARY KEY,
    code VARCHAR(10) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    kind VARCHAR(10) NOT NULL CHECK (kind IN ('league', 'cup'))
);

CREATE TABLE seasons (
    id SERIAL PRIMARY KEY,
    code VARCHAR(10) UNIQUE NOT NULL
);

CREATE TABLE teams (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL
);

-- Stats are NULL for cup matches (scores only) and a few league matches
CREATE TABLE matches (
    id SERIAL PRIMARY KEY,
    competition_id INTEGER NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
    season_id INTEGER NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
    match_date DATE NOT NULL,
    round SMALLINT,
    neutral BOOLEAN NOT NULL DEFAULT FALSE,
    home_team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE RESTRICT,
    away_team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE RESTRICT,
    home_goals SMALLINT NOT NULL CHECK (home_goals >= 0),
    away_goals SMALLINT NOT NULL CHECK (away_goals >= 0),
    result CHAR(1) NOT NULL CHECK (result IN ('H', 'D', 'A')),
    home_shots SMALLINT CHECK (home_shots >= 0),
    away_shots SMALLINT CHECK (away_shots >= 0),
    home_shots_on_target SMALLINT CHECK (home_shots_on_target >= 0),
    away_shots_on_target SMALLINT CHECK (away_shots_on_target >= 0),
    home_corners SMALLINT CHECK (home_corners >= 0),
    away_corners SMALLINT CHECK (away_corners >= 0),
    home_yellow_cards SMALLINT CHECK (home_yellow_cards >= 0),
    away_yellow_cards SMALLINT CHECK (away_yellow_cards >= 0),
    home_red_cards SMALLINT CHECK (home_red_cards >= 0),
    away_red_cards SMALLINT CHECK (away_red_cards >= 0),
    CONSTRAINT chk_different_teams CHECK (home_team_id <> away_team_id)
);

-- B-tree indexes for faster lookups
CREATE UNIQUE INDEX uq_matches_fixture ON matches(competition_id, match_date, home_team_id, away_team_id);
CREATE INDEX idx_matches_competition ON matches(competition_id);
CREATE INDEX idx_matches_date ON matches(match_date);
CREATE INDEX idx_matches_home_team ON matches(home_team_id);
CREATE INDEX idx_matches_away_team ON matches(away_team_id);

-- Model predictions, checked against the real results (see sql/migrations/002_predictions.sql)
CREATE TABLE predictions (
    id SERIAL PRIMARY KEY,
    competition_id INTEGER NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
    match_date DATE NOT NULL,
    home_team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE RESTRICT,
    away_team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE RESTRICT,
    prob_home REAL NOT NULL CHECK (prob_home BETWEEN 0 AND 1),
    prob_draw REAL NOT NULL CHECK (prob_draw BETWEEN 0 AND 1),
    prob_away REAL NOT NULL CHECK (prob_away BETWEEN 0 AND 1),
    predicted CHAR(1) NOT NULL CHECK (predicted IN ('H', 'D', 'A')),
    source VARCHAR(10) NOT NULL CHECK (source IN ('live', 'backtest')),
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    CONSTRAINT uq_predictions_fixture UNIQUE (competition_id, match_date, home_team_id, away_team_id)
);
