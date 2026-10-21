import os
from pathlib import Path

import pandas as pd
import psycopg2
from dotenv import load_dotenv
from psycopg2.extras import execute_values

from competitions import CUPS, LEAGUES

#Load DATABASE_URL from .env
ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / ".env")

PROCESSED_DIR = ROOT / "data" / "processed"
CSV_PATHS = [PROCESSED_DIR / "league_matches.csv", PROCESSED_DIR / "ucl_matches.csv"]

#CSV columns inserted as-is into matches (same names as the DB columns), NULL when missing
STATS = [
    "home_shots", "away_shots",
    "home_shots_on_target", "away_shots_on_target",
    "home_corners", "away_corners",
    "home_yellow_cards", "away_yellow_cards",
    "home_red_cards", "away_red_cards",
]
COLUMNS = ["competition_id", "season_id", "match_date", "round", "neutral",
           "home_team_id", "away_team_id", "home_goals", "away_goals", "result", *STATS]


def insert_matches(cur, df):
    #Insert competitions, seasons, teams, then the matches not stored yet; returns the number of new matches
    for code, comp in {**LEAGUES, **CUPS}.items():
        kind = "league" if code in LEAGUES else "cup"
        cur.execute("INSERT INTO competitions (code, name, kind) VALUES (%s, %s, %s) ON CONFLICT (code) DO NOTHING;",
                    (code, comp["name"], kind))
    cur.execute("SELECT code, id FROM competitions;")
    competition_ids = dict(cur.fetchall())

    for code in df["season"].astype(str).unique():
        cur.execute("INSERT INTO seasons (code) VALUES (%s) ON CONFLICT (code) DO NOTHING;", (code,))
    cur.execute("SELECT code, id FROM seasons;")
    season_ids = dict(cur.fetchall())

    for team in set(df["home_team"]) | set(df["away_team"]):
        cur.execute("INSERT INTO teams (name) VALUES (%s) ON CONFLICT (name) DO NOTHING;", (team,))
    cur.execute("SELECT name, id FROM teams;")
    team_ids = dict(cur.fetchall())

    #Missing columns (round, neutral, stats) and missing values become NULL / default
    def value(r, col):
        v = r.get(col)
        return None if v is None or pd.isna(v) else v

    rows = [
        (
            competition_ids[r["competition"]], season_ids[str(r["season"])], pd.Timestamp(r["match_date"]).date(),
            None if value(r, "round") is None else int(r["round"]), bool(value(r, "neutral") or False),
            team_ids[r["home_team"]], team_ids[r["away_team"]],
            int(r["home_goals"]), int(r["away_goals"]), r["result"],
            *[None if value(r, c) is None else int(r[c]) for c in STATS],
        )
        for r in df.to_dict("records")
    ]

    #The unique index on (competition, date, home, away) skips matches already stored
    inserted = execute_values(
        cur,
        f"INSERT INTO matches ({', '.join(COLUMNS)}) VALUES %s ON CONFLICT DO NOTHING RETURNING id;",
        rows,
        fetch=True,
    )
    return len(inserted)


def run_ingestion():
    #Connect to PostgreSQL (Docker locally, Supabase in prod)
    conn = psycopg2.connect(os.environ["DATABASE_URL"])
    cur = conn.cursor()
    print("Connected to PostgreSQL!")

    #Processed files from notebooks/multi_league.ipynb
    for path in CSV_PATHS:
        df = pd.read_csv(path, dtype={"season": str})
        added = insert_matches(cur, df)
        print(f"{path.name}: {len(df)} matches, {added} new")

    #Commit and close
    conn.commit()
    cur.close()
    conn.close()
    print("Ingestion done")


if __name__ == "__main__":
    run_ingestion()
