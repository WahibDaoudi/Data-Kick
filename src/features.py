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

#Model inputs
FEATURES = [
    "elo_diff", "abs_elo_diff", "points_last5_diff", "goal_diff_last5_diff",
    "sot_for_last5_diff", "sot_against_last5_diff", "context_points_diff",
    "season_ppg_diff", "rest_days_diff",
]
#Context of each row, not model inputs (they did not improve the log loss, see docs/results.md)
CONTEXT = ["history_weight", "is_cup", "neutral"]

#Starting Elo of a club by league: one rating pool for every competition, European matches calibrate the leagues
LEAGUE_ELO = {
    "E0": 1600, "SP1": 1590, "I1": 1570, "D1": 1570, "F1": 1540, "P1": 1520,
    "N1": 1510, "B1": 1480, "T1": 1470, "SC0": 1450, "G1": 1450,
}
#Clubs only seen in European cups (leagues not downloaded: Austria, Serbia, Ukraine...)
CUP_ONLY_ELO = 1450
#Promoted clubs start below their league
PROMOTED_GAP = 100

#Elo settings per kind of competition (European matches are rarer: they move ratings more)
K_FACTOR = {"league": 20, "cup": 30}
HOME_ADVANTAGE = {"league": 65, "cup": 50}

#Window of recent matches, and default values for its missing slots (averages of the database)
WINDOW = 5
PRIOR_POINTS = 1.374
PRIOR_GOAL_DIFF = 0.0
PRIOR_SOT = 4.41


def load_matches():
    #Connect to PostgreSQL using DATABASE_URL
    conn = psycopg2.connect(os.getenv("DATABASE_URL"))

    #Query all matches of every competition sorted chronologically
    query = """
        SELECT m.id, m.season_id, m.match_date, m.home_team_id, m.away_team_id,
               m.home_goals, m.away_goals, m.result, m.neutral,
               m.home_shots_on_target, m.away_shots_on_target,
               c.code AS competition, c.kind
        FROM matches m
        JOIN competitions c ON c.id = m.competition_id
        ORDER BY m.match_date ASC, m.id ASC;
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


def window_mean(values, prior):
    #Mean over the last WINDOW slots, the slots without a match take the prior
    last = values[-WINDOW:]
    return (sum(last) + (WINDOW - len(last)) * prior) / WINDOW


def new_state():
    #Memory of every team: ratings, histories and dates
    return {
        "elo": {},
        "league": {},                     # last domestic league of each team
        "form": defaultdict(list),        # (points, goal difference), every competition
        "sot": defaultdict(list),         # (shots on target for, against), matches with stats only
        "home": defaultdict(list),        # points at home
        "away": defaultdict(list),        # points away
        "season": defaultdict(lambda: defaultdict(list)),  # domestic league points per season
        "last_date": {},
    }


def team_prior(state, t):
    #Rating a team is pulled back to: the level of its league
    league = state["league"].get(t)
    return LEAGUE_ELO[league] if league else CUP_ONLY_ELO


def make_row(state, h, a, s_id, m_date, kind="league", neutral=False):
    #Build the features of a match from the current state (the state is only read, never modified)
    #Never None: missing history is replaced by default values, history_weight tells how much is real
    form_h, form_a = state["form"][h], state["form"][a]
    sot_h, sot_a = state["sot"][h], state["sot"][a]

    elo_h = state["elo"].get(h, team_prior(state, h))
    elo_a = state["elo"].get(a, team_prior(state, a))
    elo_diff = elo_h - elo_a

    last_date = state["last_date"]
    rest_h = min((m_date - last_date[h]).days, 14) if h in last_date else 7
    rest_a = min((m_date - last_date[a]).days, 14) if a in last_date else 7

    #Overall form, also the default of the venue form
    points_h = window_mean([p for p, _ in form_h], PRIOR_POINTS)
    points_a = window_mean([p for p, _ in form_a], PRIOR_POINTS)

    season_h = state["season"][s_id][h]
    season_a = state["season"][s_id][a]

    return {
        "elo_diff": elo_diff,
        "abs_elo_diff": abs(elo_diff),
        "points_last5_diff": points_h - points_a,
        "goal_diff_last5_diff": window_mean([g for _, g in form_h], PRIOR_GOAL_DIFF) - window_mean([g for _, g in form_a], PRIOR_GOAL_DIFF),
        "sot_for_last5_diff": window_mean([f for f, _ in sot_h], PRIOR_SOT) - window_mean([f for f, _ in sot_a], PRIOR_SOT),
        "sot_against_last5_diff": window_mean([c for _, c in sot_h], PRIOR_SOT) - window_mean([c for _, c in sot_a], PRIOR_SOT),
        "context_points_diff": window_mean(state["home"][h], points_h) - window_mean(state["away"][a], points_a),
        "season_ppg_diff": (np.mean(season_h) if season_h else PRIOR_POINTS) - (np.mean(season_a) if season_a else PRIOR_POINTS),
        "rest_days_diff": rest_h - rest_a,
        "history_weight": min(len(form_h[-WINDOW:]), len(form_a[-WINDOW:])) / WINDOW,
        "is_cup": int(kind == "cup"),
        "neutral": int(neutral),
    }


def build_features(df, season_regression=0.25):
    #Initialize teams memory
    state = new_state()
    elo, league_of = state["elo"], state["league"]

    first_season = df["season_id"].iloc[0]
    current_season = first_season

    rows = []

    #Loop through each match of every competition chronologically
    for row in df.itertuples():
        h, a, s_id, m_date = row.home_team_id, row.away_team_id, row.season_id, row.match_date
        kind, neutral = row.kind, bool(row.neutral)

        #New season: pull every rating back toward the level of its league
        if s_id != current_season:
            for t in elo:
                prior = team_prior(state, t)
                elo[t] = prior + (elo[t] - prior) * (1 - season_regression)
            current_season = s_id

        #Unseen teams start at their league level in the first season, lower afterwards (promoted teams)
        for t in (h, a):
            if t not in elo:
                if kind == "league":
                    league_of[t] = row.competition
                    elo[t] = LEAGUE_ELO[row.competition] - (0 if s_id == first_season else PROMOTED_GAP)
                else:
                    elo[t] = CUP_ONLY_ELO
            elif kind == "league":
                league_of[t] = row.competition

        #Features are built before the match is added to the history: no leakage
        feats = make_row(state, h, a, s_id, m_date, kind, neutral)
        rows.append({
            "match_id": row.id, "season_id": s_id, "match_date": m_date, "competition": row.competition,
            **feats, "target": row.result,
        })

        #Update points based on match result
        if row.result == "H":
            pts_h, pts_a, score_h = 3, 0, 1.0
        elif row.result == "A":
            pts_h, pts_a, score_h = 0, 3, 0.0
        else:
            pts_h, pts_a, score_h = 1, 1, 0.5

        #Update Elo ratings
        advantage = 0 if neutral else HOME_ADVANTAGE[kind]
        k = K_FACTOR[kind]
        exp_h = 1 / (1 + 10 ** ((elo[a] - (elo[h] + advantage)) / 400))
        elo[h] += k * (score_h - exp_h)
        elo[a] += k * ((1 - score_h) - (1 - exp_h))

        #Update history and dates for next matches
        gd = row.home_goals - row.away_goals
        state["form"][h].append((pts_h, gd))
        state["form"][a].append((pts_a, -gd))

        #Cup matches have no shots: the window looks further back instead
        if pd.notna(row.home_shots_on_target) and pd.notna(row.away_shots_on_target):
            state["sot"][h].append((row.home_shots_on_target, row.away_shots_on_target))
            state["sot"][a].append((row.away_shots_on_target, row.home_shots_on_target))

        if not neutral:
            state["home"][h].append(pts_h)
            state["away"][a].append(pts_a)

        #Season form: domestic league only
        if kind == "league":
            state["season"][s_id][h].append(pts_h)
            state["season"][s_id][a].append(pts_a)

        state["last_date"][h] = m_date
        state["last_date"][a] = m_date

    #The final state describes every team right now: it is used to predict upcoming matches
    return pd.DataFrame(rows), state


def get_training_data(min_history=0.2):
    #Load raw data and build features matrix
    #Rows where a team has no past match at all only hold default values: not kept
    df_features, _ = build_features(load_matches())
    return df_features[df_features["history_weight"] >= min_history].reset_index(drop=True)


def get_fixture_features(home_name, away_name, date=None, kind="league", neutral=False):
    #Features of an upcoming match, built from the current state of the database
    result = get_fixtures_features([(home_name, away_name, date)], kind, neutral)[0]
    if isinstance(result, str):
        raise ValueError(result)
    return result


def get_fixtures_features(fixtures, kind="league", neutral=False):
    #Same for several (home_name, away_name, date) matches with a single database load
    #Each item is a one-row DataFrame, or an error message
    df = load_matches()
    _, state = build_features(df)
    team_ids = load_team_ids()

    #Latest season of the database
    s_id = df["season_id"].iloc[-1]

    results = []
    for home_name, away_name, date in fixtures:
        unknown = [n for n in (home_name, away_name) if n not in team_ids]
        if unknown:
            results.append(f"Unknown team: {unknown[0]}")
            continue

        #Today by default
        m_date = pd.Timestamp(date) if date else pd.Timestamp.today().normalize()
        feats = make_row(state, team_ids[home_name], team_ids[away_name], s_id, m_date, kind, neutral)

        #One row, columns in the training order
        results.append(pd.DataFrame([feats], columns=FEATURES))
    return results


if __name__ == "__main__":
    df_raw = load_matches()
    df_features, _ = build_features(df_raw)
    print(f"Features matrix generated: {df_features.shape[0]} rows, {df_features.shape[1]} columns.")
    print(df_features.groupby("competition").size())

    #Consistency check: rebuild one played match from the state just before it
    row = df_features.iloc[len(df_features) // 2]
    i = df_raw.index[df_raw["id"] == row["match_id"]][0]
    _, state_before = build_features(df_raw.iloc[:i])
    m = df_raw.iloc[i]
    rebuilt = make_row(state_before, m.home_team_id, m.away_team_id, m.season_id, m.match_date, m.kind, bool(m.neutral))
    print(pd.DataFrame({"training": row[FEATURES + CONTEXT], "rebuilt": pd.Series(rebuilt)}))
