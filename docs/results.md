# Model Results — Data-Kick

## Setup

- **Task**: predict the result of a Ligue 1 match (`H` home win, `D` draw, `A` away win)
- **Features**: 9 differences (home - away), see `docs/features.md`
- **Split**: temporal. Oldest 80% to train (1799 matches), most recent 20% to test (450 matches)
- **Preprocessing**: `StandardScaler` fitted on the training set only
- **Baseline**: `DummyClassifier(strategy="prior")`, always predicts the class frequencies seen in training (A 33%, D 25%, H 42%)

## Results (test set)

| Model | Accuracy | Log loss |
|---|---|---|
| Baseline (class frequencies) | 0.460 | 1.061 |
| Logistic regression | 0.518 | 1.000 |

## Learned weights (standardized features)

| Feature | A | D | H |
|---|---|---|---|
| elo_diff | -0.34 | -0.02 | 0.36 |
| abs_elo_diff | 0.05 | -0.02 | -0.03 |
| points_last5_diff | 0.19 | -0.05 | -0.15 |
| goal_diff_last5_diff | -0.11 | 0.03 | 0.08 |
| sot_for_last5_diff | -0.12 | 0.01 | 0.11 |
| sot_against_last5_diff | -0.01 | 0.10 | -0.09 |
| context_points_diff | -0.09 | 0.02 | 0.07 |
| season_ppg_diff | -0.03 | -0.01 | 0.03 |
| rest_days_diff | -0.01 | -0.03 | 0.05 |

## Interpretation

- The model beats the baseline on both metrics: the features carry real information.
- `elo_diff` dominates (positive for `H`, negative for `A`), then recent shots and goals.
- The draw column is close to zero: the model barely detects draws.
- `points_last5_diff` has a counter-intuitive sign, probably because it overlaps with Elo and goal-based features.

## Limits

- A single split on 450 matches: accuracy has a margin of about ±2.3 points. Walk-forward validation is planned.
- Next: compare with k-NN, Naive Bayes and gradient boosting.