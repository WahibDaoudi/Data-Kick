import os

import pandas as pd
import psycopg2
from dotenv import load_dotenv

#Load DATABASE_URL from .env
load_dotenv()

CSV_PATH = "../data/processed/ligue1_matches.csv"

#CSV columns inserted as-is into matches (same names as the DB columns)
STATS = [
    "home_goals", "away_goals", "home_shots", "away_shots",
    "home_shots_on_target", "away_shots_on_target",
    "home_corners", "away_corners",
    "home_yellow_cards", "away_yellow_cards",
    "home_red_cards", "away_red_cards",
]


def run_ingestion():
    #Connect to PostgreSQL (Docker locally, Supabase in prod)
    conn = psycopg2.connect(os.environ["DATABASE_URL"])
    cur = conn.cursor()
    print("Connected to PostgreSQL!")

    #Read the concatenated file and parse dates
    df = pd.read_csv(CSV_PATH).dropna(subset=["home_team"])
    df["match_date"] = pd.to_datetime(df["match_date"])


    #Insert the seasons, then map season code -> id
    for code in df["season"].astype(str).unique():
        cur.execute("INSERT INTO seasons (code) VALUES (%s) ON CONFLICT (code) DO NOTHING;", (code,))
    cur.execute("SELECT code, id FROM seasons;")
    season_ids = dict(cur.fetchall())

    #Insert the teams, then map team name -> id
    for team in set(df["home_team"]) | set(df["away_team"]):
        cur.execute("INSERT INTO teams (name) VALUES (%s) ON CONFLICT (name) DO NOTHING;", (team,))
    cur.execute("SELECT name, id FROM teams;")
    team_ids = dict(cur.fetchall())

    #Insert the matches (foreign keys use the ids found above)
    for _, r in df.iterrows():
        cur.execute(
            f"""
            INSERT INTO matches (
                season_id, match_date, home_team_id, away_team_id, result, {", ".join(STATS)}
            ) VALUES (%s, %s, %s, %s, %s, {", ".join(["%s"] * len(STATS))});
            """,
            (
                season_ids[str(r["season"])], r["match_date"].date(),
                team_ids[r["home_team"]], team_ids[r["away_team"]], r["result"],
                *[int(r[c]) for c in STATS],
            ),
        )

    #Commit and close
    conn.commit()
    cur.close()
    conn.close()
    print(f"Ingestion done: {len(df)} matches inserted")


if __name__ == "__main__":
    run_ingestion()