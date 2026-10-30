# Database Architecture — Data-Kick

PostgreSQL relational schema for storing and analyzing football matches: 11 domestic leagues and the Champions League.

---

## 1. Entity-Relationship Overview

```text
     [ competitions ]          [ seasons ]                    [ teams ]
  +----+------+------+      +----+--------+              +----+----------+
  | id | code | kind |      | id | code   |              | id | name     |  <-- PK (Primary Key)
  +----+------+------+      +----+--------+              +----+----------+
         ^                         ^                            ^      ^
         | (competition_id)        | (season_id)                |      |
         |                         |                            |      |
  +------+-------------------------+----------------------------+      |
  |                                | (home_team_id)                    | (away_team_id)
  |                                |                                   |
  |                          [ matches ]                               |
  +----+----------------+-----------+------------+--------------+------+-------+--------+
  | id | competition_id | season_id | match_date | home_team_id | away_team_id | result |
  +----+----------------+-----------+------------+--------------+--------------+--------+
```

### How it works:
* **`competitions`**, **`seasons`** and **`teams`** store unique reference values once (avoiding text duplication).
* **`matches`** is the central fact table. Instead of storing names or codes repeatedly, it stores lightweight integer pointers (**Foreign Keys**: `competition_id`, `season_id`, `home_team_id`, `away_team_id`) that reference the **Primary Keys** (`id`) of the parent tables.
* A club has **one name everywhere**: Champions League names are mapped to the football-data names (`src/competitions.py`), so a club's league and European matches share the same `team_id`.

---

## 2. Tables Breakdown

### Table 1: `competitions`
Every competition stored.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `SERIAL` | `PRIMARY KEY` | Unique internal identifier |
| `code` | `VARCHAR(10)` | `NOT NULL, UNIQUE` | football-data division code for leagues (`F1`, `E0`, `SP1`...), `UCL` for the Champions League |
| `name` | `VARCHAR(100)` | `NOT NULL` | Display name (e.g., `Ligue 1`, `Champions League`) |
| `kind` | `VARCHAR(10)` | `NOT NULL, IN ('league', 'cup')` | Domestic league or European cup |

---

### Table 2: `seasons`
Stores each edition, shared by all competitions.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `SERIAL` | `PRIMARY KEY` | Unique internal identifier |
| `code` | `VARCHAR(10)` | `NOT NULL, UNIQUE` | Short season identifier (e.g., `1920`, `2324`) |

---

### Table 3: `teams`
Master list of all football clubs.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `SERIAL` | `PRIMARY KEY` | Unique internal identifier |
| `name` | `VARCHAR(100)` | `NOT NULL, UNIQUE` | Standardized club name (e.g., `Paris SG`, `Bayern Munich`) |

---

### Table 4: `matches`
Central table containing match results and in-game statistics.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `SERIAL` | `PRIMARY KEY` | Unique match identifier |
| `competition_id` | `INTEGER` | `NOT NULL, FK -> competitions(id)` | Pointer to the competition |
| `season_id` | `INTEGER` | `NOT NULL, FK -> seasons(id)` | Pointer to the season |
| `match_date` | `DATE` | `NOT NULL` | Official match date (`YYYY-MM-DD`) |
| `round` | `SMALLINT` | | Cup round number (`NULL` for leagues) |
| `neutral` | `BOOLEAN` | `NOT NULL, DEFAULT FALSE` | Neutral venue (cup finals, 2020 Final 8 in Lisbon) |
| `home_team_id` | `INTEGER` | `NOT NULL, FK -> teams(id)` | Pointer to the home club |
| `away_team_id` | `INTEGER` | `NOT NULL, FK -> teams(id)` | Pointer to the away club |
| `home_goals` | `SMALLINT` | `NOT NULL, >= 0` | Full-time goals scored by the home club |
| `away_goals` | `SMALLINT` | `NOT NULL, >= 0` | Full-time goals scored by the away club |
| `result` | `CHAR(1)` | `NOT NULL, IN ('H', 'D', 'A')` | Home win, draw or away win |
| `home_shots`, `away_shots` | `SMALLINT` | `>= 0` | Total shots |
| `home_shots_on_target`, `away_shots_on_target` | `SMALLINT` | `>= 0` | Shots on target |
| `home_corners`, `away_corners` | `SMALLINT` | `>= 0` | Corners |
| `home_yellow_cards`, `away_yellow_cards` | `SMALLINT` | `>= 0` | Yellow cards |
| `home_red_cards`, `away_red_cards` | `SMALLINT` | `>= 0` | Red cards |

Stats are `NULL` for Champions League matches (the source only has scores) and for a few league matches missing in the raw files.

**Indexes:** unique `(competition_id, match_date, home_team_id, away_team_id)` so every insert skips matches already stored, plus `competition_id`, `match_date`, `home_team_id`, `away_team_id`.

### Table 5: `predictions`
What the model predicted, checked against `matches` once the match is played (same 4-column key).

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `SERIAL` | `PRIMARY KEY` | Unique identifier |
| `competition_id`, `match_date`, `home_team_id`, `away_team_id` | | `NOT NULL, UNIQUE together` | The fixture, same key as `matches` |
| `prob_home`, `prob_draw`, `prob_away` | `REAL` | `NOT NULL, 0 to 1` | Model probabilities |
| `predicted` | `CHAR(1)` | `NOT NULL, IN ('H', 'D', 'A')` | Most likely result |
| `source` | `VARCHAR(10)` | `NOT NULL, IN ('live', 'backtest')` | `live`: shown before kick-off. `backtest`: rebuilt by a model trained on previous seasons only |
| `created_at` | `TIMESTAMP` | `NOT NULL` | Last update (a live prediction is refreshed until kick-off) |

---

## 3. Data Flow

```text
src/download.py            data/raw/<competition>/season-XXYY.csv|json
        |
notebooks/multi_league.ipynb  ->  data/processed/league_matches.csv, ucl_matches.csv
        |
src/ingest.py              ->  PostgreSQL (full history)
src/update.py              ->  PostgreSQL (current season, on server start)
```

Existing database: apply `sql/migrations/001_multi_competition.sql` once. New database: `sql/schema.sql` already has the final schema.
