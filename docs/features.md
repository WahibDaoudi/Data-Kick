# Feature Matrix — Data-Kick

Training DataFrame built by `src/features.py` from the `matches` table. One row per match, chronological loop: every feature uses only information available **before** kick-off (no data leakage).

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
| target                   | str         | Result to predict: H, D or A                |
+--------------------------+-------------+---------------------------------------------+
```

13 columns: 3 identifiers, 9 features, 1 target.

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
- **Elo rating**: every team starts at 1500. After each match: `elo += K * (actual - expected)`, with `K = 20` and a home advantage of 65 points in the expected score. Ratings carry over between seasons.
- **Minimum history**: a match becomes a row only if both teams have at least 5 previous matches.
- **Missing history**: empty context or season history defaults to 0, and a missing rest period defaults to 7 days.
- **Target**: `H` home win, `D` draw, `A` away win (same codes as `matches.result`).