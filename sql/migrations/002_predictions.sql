-- Model predictions, to check them against the real results
-- live: shown on the website before kick-off (frozen at kick-off)
-- backtest: rebuilt for matches already played, by a model trained on previous seasons only
-- Safe to run twice.
BEGIN;

CREATE TABLE IF NOT EXISTS predictions (
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
    -- Same key as matches: a prediction joins its match once it is played
    CONSTRAINT uq_predictions_fixture UNIQUE (competition_id, match_date, home_team_id, away_team_id)
);

COMMIT;
