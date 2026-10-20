import os
from collections import defaultdict
from pathlib import Path

import numpy as np
import pandas as pd
import psycopg2
from dotenv import load_dotenv

#Load environment variables from project root
env_path = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(dotenv_path=env_path)

BASE_ELO = 1500.0

FEATURES = [
    "elo_diff", "abs_elo_diff", "points_last5_diff", "goal_diff_last5_diff",
    "sot_for_last5_diff", "sot_against_last5_diff", "context_points_diff",
    "season_ppg_diff", "rest_days_diff",
]


def load_matches():
    #Connect to PostgreSQL using DATABASE_URL
    conn = psycopg2.connect(os.getenv("DATABASE_URL"))

    #Query all matches sorted chronologically
    query = """
        SELECT id, season_id, match_date, home_team_id, away_team_id,
               home_goals, away_goals, result,
               home_shots_on_target, away_shots_on_target
        FROM matches
        ORDER BY match_date ASC, id ASC;
    """
    df = pd.read_sql(query, conn)
    conn.close()
    df["match_date"] = pd.to_datetime(df["match_date"])
    return df


def load_team_ids():
    #Map team name -> id
    conn = psycopg2.connect(os.getenv("DATABASE_URL"))
    cur = conn.cursor()
    cur.execute("SELECT name, id FROM teams;")
    ids = dict(cur.fetchall())
    conn.close()
    return ids


def avg_tuple(hist, idx):
    #Compute mean for a specific index in tuple history
    return np.mean([x[idx] for x in hist]) if hist else 0.0


def venue_avg(hist, fallback):
    #Mean of the last venue matches, overall form if there is none yet
    return np.mean(hist[-5:]) if hist else fallback


def new_state():
    #Memory of every team: ratings, histories and dates
    return {
        "elo": {},
        "all": defaultdict(list),
        "home": defaultdict(list),
        "away": defaultdict(list),
        "season": defaultdict(lambda: defaultdict(list)),
        "last_date": {},
    }


def make_row(state, h, a, s_id, m_date):
    #Build the 9 features of a match from the current state (the state is only read, never modified)
    h_last5 = state["all"][h][-5:]
    a_last5 = state["all"][a][-5:]

    #Not enough history for one of the two teams
    if len(h_last5) < 5 or len(a_last5) < 5:
        return None

    elo_diff = state["elo"][h] - state["elo"][a]
    last_date = state["last_date"]
    rest_h = min((m_date - last_date[h]).days, 14) if h in last_date else 7
    rest_a = min((m_date - last_date[a]).days, 14) if a in last_date else 7

    #Overall form, used when a team has no home (or away) match yet
    form_h = avg_tuple(h_last5, 0)
    form_a = avg_tuple(a_last5, 0)

    season_h = state["season"][s_id][h]
    season_a = state["season"][s_id][a]

    return {
        "elo_diff": elo_diff,
        "abs_elo_diff": abs(elo_diff),
        "points_last5_diff": form_h - form_a,
        "goal_diff_last5_diff": avg_tuple(h_last5, 1) - avg_tuple(a_last5, 1),
        "sot_for_last5_diff": avg_tuple(h_last5, 2) - avg_tuple(a_last5, 2),
        "sot_against_last5_diff": avg_tuple(h_last5, 3) - avg_tuple(a_last5, 3),
        "context_points_diff": venue_avg(state["home"][h], form_h) - venue_avg(state["away"][a], form_a),
        "season_ppg_diff": (np.mean(season_h) if season_h else 0.0) - (np.mean(season_a) if season_a else 0.0),
        "rest_days_diff": rest_h - rest_a,
    }


def build_features(df, k_factor=20, home_advantage=65, season_regression=0.25, promoted_elo=1400.0):
    #Initialize teams memory
    state = new_state()
    elo, history_all, history_home, history_away = state["elo"], state["all"], state["home"], state["away"]
    season_pts, last_date = state["season"], state["last_date"]

    first_season = df["season_id"].iloc[0]
    current_season = first_season

    rows = []

    #Loop through each match chronologically
    for row in df.itertuples():
        h, a, s_id, m_date = row.home_team_id, row.away_team_id, row.season_id, row.match_date

        #New season: pull every rating back toward the league mean
        if s_id != current_season:
            for t in elo:
                elo[t] = BASE_ELO + (elo[t] - BASE_ELO) * (1 - season_regression)
            current_season = s_id

        #Unseen teams start at the league mean in the first season, lower afterwards (promoted teams)
        for t in (h, a):
            if t not in elo:
                elo[t] = BASE_ELO if s_id == first_season else promoted_elo

        #Features are built before the match is added to the history: no leakage
        feats = make_row(state, h, a, s_id, m_date)
        if feats is not None:
            rows.append({"match_id": row.id, "season_id": s_id, "match_date": m_date, **feats, "target": row.result})

        #Update points based on match result
        if row.result == "H":
            pts_h, pts_a, score_h = 3, 0, 1.0
        elif row.result == "A":
            pts_h, pts_a, score_h = 0, 3, 0.0
        else:
            pts_h, pts_a, score_h = 1, 1, 0.5

        #Update Elo ratings
        exp_h = 1 / (1 + 10 ** ((elo[a] - (elo[h] + home_advantage)) / 400))
        elo[h] += k_factor * (score_h - exp_h)
        elo[a] += k_factor * ((1 - score_h) - (1 - exp_h))

        #Update history and dates for next matches
        gd = row.home_goals - row.away_goals
        history_all[h].append((pts_h, gd, row.home_shots_on_target, row.away_shots_on_target))
        history_all[a].append((pts_a, -gd, row.away_shots_on_target, row.home_shots_on_target))

        history_home[h].append(pts_h)
        history_away[a].append(pts_a)

        season_pts[s_id][h].append(pts_h)
        season_pts[s_id][a].append(pts_a)

        last_date[h] = m_date
        last_date[a] = m_date

    #The final state describes every team right now: it is used to predict upcoming matches
    return pd.DataFrame(rows), state


def get_training_data():
    #Load raw data and build features matrix
    df_features, _ = build_features(load_matches())
    return df_features


def get_fixture_features(home_name, away_name, date=None):
    #Features of an upcoming match, built from the current state of the database
    df = load_matches()
    _, state = build_features(df)

    team_ids = load_team_ids()
    for name in (home_name, away_name):
        if name not in team_ids:
            raise ValueError(f"Unknown team: {name}")

    #Latest season of the database, today by default
    s_id = df["season_id"].iloc[-1]
    m_date = pd.Timestamp(date) if date else pd.Timestamp.today().normalize()

    feats = make_row(state, team_ids[home_name], team_ids[away_name], s_id, m_date)
    if feats is None:
        raise ValueError("Not enough past matches for one of the two teams")

    #One row, columns in the training order
    return pd.DataFrame([feats], columns=FEATURES)


if __name__ == "__main__":
    df_raw = load_matches()
    df_features, _ = build_features(df_raw)
    print(f"Features matrix generated: {df_features.shape[0]} rows, {df_features.shape[1]} columns.")

    #Consistency check: rebuild one played match from the state just before it
    row = df_features.iloc[len(df_features) // 2]
    i = df_raw.index[df_raw["id"] == row["match_id"]][0]
    _, state_before = build_features(df_raw.iloc[:i])
    m = df_raw.iloc[i]
    rebuilt = make_row(state_before, m.home_team_id, m.away_team_id, m.season_id, m.match_date)
    print(pd.DataFrame({"training": row[FEATURES], "rebuilt": pd.Series(rebuilt)}))