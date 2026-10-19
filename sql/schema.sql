-- Database init
DROP TABLE IF EXISTS matches;
DROP TABLE IF EXISTS teams;
DROP TABLE IF EXISTS seasons;

CREATE TABLE seasons (
    id SERIAL PRIMARY KEY,
    code VARCHAR(10) UNIQUE NOT NULL
);

CREATE TABLE teams (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL
);

CREATE TABLE matches (
    id SERIAL PRIMARY KEY,
    season_id INTEGER NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
    match_date DATE NOT NULL,
    home_team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE RESTRICT,
    away_team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE RESTRICT,
    home_goals SMALLINT NOT NULL CHECK (home_goals >= 0),
    away_goals SMALLINT NOT NULL CHECK (away_goals >= 0),
    result CHAR(1) NOT NULL CHECK (result IN ('H', 'D', 'A')),
    home_shots SMALLINT NOT NULL CHECK (home_shots >= 0),
    away_shots SMALLINT NOT NULL CHECK (away_shots >= 0),
    home_shots_on_target SMALLINT NOT NULL CHECK (home_shots_on_target >= 0),
    away_shots_on_target SMALLINT NOT NULL CHECK (away_shots_on_target >= 0),
    home_corners SMALLINT NOT NULL CHECK (home_corners >= 0),
    away_corners SMALLINT NOT NULL CHECK (away_corners >= 0),
    home_yellow_cards SMALLINT NOT NULL CHECK (home_yellow_cards >= 0),
    away_yellow_cards SMALLINT NOT NULL CHECK (away_yellow_cards >= 0),
    home_red_cards SMALLINT NOT NULL CHECK (home_red_cards >= 0),
    away_red_cards SMALLINT NOT NULL CHECK (away_red_cards >= 0),
    CONSTRAINT chk_different_teams CHECK (home_team_id <> away_team_id)
);

-- B-tree indexes for faster lookups
CREATE INDEX idx_matches_date ON matches(match_date);
CREATE INDEX idx_matches_home_team ON matches(home_team_id);
CREATE INDEX idx_matches_away_team ON matches(away_team_id);