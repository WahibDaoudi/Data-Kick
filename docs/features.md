# Feature Matrix — Data-Kick

Training DataFrame built by `src/features.py` from the `matches` table: every competition (11 domestic leagues + Champions League) in **one chronological loop**. Every feature uses only information available **before** kick-off (no data leakage).

---

## 1. Pipeline

```text
matches (PostgreSQL)
        |
        v
load_matches()      -> raw matches sorted by date
        |
        v
build_features()    -> chronological loop: read history, create row, then update history
        |
        v
DataFrame (features + target) -> train.py
```

---

## 2. DataFrame schema

```text
+--------------------------+-------------+---------------------------------------------+
| Column                   | Type        | Description                                 |
+--------------------------+-------------+---------------------------------------------+
| match_id                 | int         | matches.id                                  |
| season_id                | int         | matches.season_id                           |
| match_date               | datetime    | Kick-off date                               |
+--------------------------+-------------+---------------------------------------------+
| elo_diff                 | float       | Home Elo - Away Elo                         |
| abs_elo_diff             | float       | |elo_diff|                                  |
| points_last5_diff        | float       | Avg points, last 5 matches                  |
| goal_diff_last5_diff     | float       | Avg goal difference, last 5 matches         |
| sot_for_last5_diff       | float       | Avg shots on target for, last 5 matches     |
| sot_against_last5_diff   | float       | Avg shots on target against, last 5 matches |
| context_points_diff      | float       | Home team at home vs away team away         |
| season_ppg_diff          | float       | Points per game in the current season       |
| rest_days_diff           | int         | Days of rest (capped at 14)                 |
+--------------------------+-------------+---------------------------------------------+
| competition              | str         | Competition code (F1, E0..., UCL)           |
| history_weight           | float       | Real matches in the window / 5 (both teams) |
| is_cup                   | int         | 1 for a European cup match                  |
| neutral                  | int         | 1 for a neutral venue (finals)              |
+--------------------------+-------------+---------------------------------------------+
| target                   | str         | Result to predict: H, D or A                |
+--------------------------+-------------+---------------------------------------------+
```

17 columns: 3 identifiers, 9 features (model inputs), 4 context columns, 1 target.

---

## 3. Feature definitions

All features are `home team - away team`, except `abs_elo_diff`.

| Feature | Definition | Reading |
|---|---|---|
| `elo_diff` | Elo rating of the home team minus the away team | > 0: home team is stronger overall |
| `abs_elo_diff` | Absolute value of `elo_diff` | Small: balanced match, higher chance of a draw |
| `points_last5_diff` | Mean points (3 win, 1 draw, 0 loss) over the last 5 matches | > 0: home team in better form |
| `goal_diff_last5_diff` | Mean goal difference over the last 5 matches | > 0: better results margin |
| `sot_for_last5_diff` | Mean shots on target created over the last 5 matches | > 0: more dangerous attack |
| `sot_against_last5_diff` | Mean shots on target conceded over the last 5 matches | > 0: home team concedes **more** (unfavorable) |
| `context_points_diff` | Home team's mean points in its last 5 **home** matches minus away team's mean points in its last 5 **away** matches | > 0: better at its own venue |
| `season_ppg_diff` | Points per game since the start of the current season | > 0: better season so far |
| `rest_days_diff` | Days since last match (capped at 14) | > 0: home team more rested |

---

## 4. Construction rules

- **No data leakage**: features are computed from past matches only, then the match result updates the history.
- **One history per club, every competition**: form, rest days and Elo use league and European matches together. A club has the same name (and `team_id`) in its league and in Europe.
- **Elo rating, one pool for all competitions**:
  - A club starts at the level of its league (`LEAGUE_ELO`: Premier League 1600, La Liga 1590, Serie A / Bundesliga 1570, Ligue 1 1540 ... Greece / Scotland 1450). Clubs only seen in Europe (Austria, Serbia, Ukraine...) start at 1450. Promoted clubs start 100 below their league.
  - After each match: `elo += K * (actual - expected)`. League: `K = 20`, home advantage 65. European cup: `K = 30` (rarer matches, they calibrate the leagues against each other), home advantage 50. Neutral venue: no home advantage.
  - New season: every rating is pulled 25% back toward the level of its league.
- **Flexible window (fallback)**: the "last 5" features are means over 5 slots. When a club has fewer than 5 past matches, the empty slots take a default value (database averages: 1.374 points, 0 goal difference, 4.41 shots on target). With 5 matches the feature is the plain mean, with none it is the average club.
  - Venue form (`context_points_diff`) fills its empty slots with the club's overall form.
  - Shots on target: European matches have no stats, so the window skips them and looks further back in the league.
  - `history_weight` = min(real matches of the two clubs, 5) / 5.
- **Season form**: points per game in the domestic league only (1.374 before the first match of the season).
- **Rows kept**: every match where both clubs have at least 1 past match (`history_weight >= 0.2`). Before, a match needed 5 past matches per club.
- **Missing rest period** defaults to 7 days.
- **Target**: `H` home win, `D` draw, `A` away win (same codes as `matches.result`).
