# Model Results — Data-Kick

## Setup

- **Task**: predict the result of a match (`H` home win, `D` draw, `A` away win) in Ligue 1 and in the Champions League
- **Training data**: 11 domestic leagues + Champions League since 2019-20, one chronological feature pipeline (see `docs/features.md`)
- **Features**: 9 differences (home - away)
- **Split**: temporal. Oldest 80% to train (20800 matches), most recent 20% to test (5201 matches, from 2025-03-29)
- **Preprocessing**: `StandardScaler` fitted on the training set only
- **Baseline**: `DummyClassifier(strategy="prior")`, per competition: the class frequencies of its own training matches

## Results (test set)

| Competition | Test matches | Baseline accuracy | Baseline log loss | Model accuracy | Model log loss |
|---|---|---|---|---|---|
| All competitions | 5201 | 0.434 | 1.072 | 0.529 | 0.982 |
| Ligue 1 | 435 | 0.467 | 1.059 | 0.529 | 1.000 |
| Champions League | 240 | 0.517 | 1.008 | 0.588 | 0.966 |

## Ligue 1 only vs multi-competition

Same cutoff for every setup (2025-02-23, the test start of the previous Ligue 1 model), Ligue 1 measured on the **same 462 matches**:

| Setup | Ligue 1 log loss / accuracy | Champions League log loss / accuracy (263 matches) |
|---|---|---|
| Baseline | 1.058 / 0.465 | 1.010 / 0.510 |
| Previous model: Ligue 1 only, 5 matches minimum | 0.9965 / 0.528 | - |
| All competitions, 9 features | **0.9925 / 0.537** | **0.9702 / 0.578** |
| All competitions, 9 features + `history_weight`, `is_cup`, `neutral` | 0.9928 / 0.537 | 0.9774 / 0.582 |
| Ligue 1 + Champions League only | 0.9936 / 0.535 | 0.9721 / 0.582 |
| All competitions, same starting Elo (1500) for every league | 0.9917 / 0.539 | 0.9981 / 0.544 |

- Ligue 1 does not get worse with the other leagues, it gets slightly better: 22 000 more matches.
- **The starting Elo by league is what makes the Champions League work**: with the same 1500 everywhere, European predictions are almost back to the baseline (0.998 vs 0.970).
- `history_weight`, `is_cup` and `neutral` do not improve the log loss as model inputs (the gap is noise on 263 matches): the model keeps the 9 features, the fallback stays inside the feature computation.

## Learned weights (standardized features)

| Feature | A | D | H |
|---|---|---|---|
| elo_diff | -0.40 | 0.02 | 0.38 |
| abs_elo_diff | 0.01 | -0.06 | 0.05 |
| points_last5_diff | 0.15 | -0.04 | -0.10 |
| goal_diff_last5_diff | -0.10 | 0.02 | 0.08 |
| sot_for_last5_diff | -0.13 | -0.01 | 0.13 |
| sot_against_last5_diff | 0.07 | 0.03 | -0.10 |
| context_points_diff | -0.04 | 0.02 | 0.02 |
| season_ppg_diff | -0.04 | -0.01 | 0.05 |
| rest_days_diff | 0.02 | 0.00 | -0.02 |

## Interpretation

- The model beats the baseline in every competition.
- `elo_diff` dominates even more than before: with one rating pool, it also carries the level gap between leagues.
- `sot_against_last5_diff` now has the expected sign (conceding more shots lowers the home win probability).
- `points_last5_diff` keeps its counter-intuitive sign, probably because it overlaps with Elo and goal-based features.

## Limits

- Champions League test set: 240 matches, log loss margin about ±0.02. A single split: walk-forward validation is planned.
- 27 European clubs have no domestic league in the database (Salzburg, Shakhtar, Bodø/Glimt...): only their European matches, the rest is default values.
- The home advantage is learned once for every competition: a neutral final is predicted like a home match.
- Starting Elo by league are set by hand (UEFA ranking order), not fitted.
