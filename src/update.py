import io
import os
from datetime import date
from pathlib import Path
from urllib.request import urlopen

import pandas as pd
import psycopg2
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / ".env")

RAW_DIR = ROOT / "data" / "raw" / "ligue-1"
URL = "https://www.football-data.co.uk/mmz4281/{code}/F1.csv"

#Raw columns -> DB columns (same mapping as the EDA notebook)
COLUMNS = {
    "Date": "match_date", "HomeTeam": "home_team", "AwayTeam": "away_team",
    "FTHG": "home_goals", "FTAG": "away_goals", "FTR": "result",
    "HS": "home_shots", "AS": "away_shots",
    "HST": "home_shots_on_target", "AST": "away_shots_on_target",
    "HC": "home_corners", "AC": "away_corners",
    "HY": "home_yellow_cards", "AY": "away_yellow_cards",
    "HR": "home_red_cards", "AR": "away_red_cards",
}
STATS = list(COLUMNS.values())[3:]
STATS.remove("result")


def season_code(day=None):
    #2026-10-20 -> "2627" (a season starts in July)
    day = day or date.today()
    start = day.year if day.month >= 7 else day.year - 1
    return f"{start % 100:02d}{(start + 1) % 100:02d}"


def download_season(code):
    #Results of the season so far, saved next to the other raw files
    with urlopen(URL.format(code=code), timeout=20) as res:
        df = pd.read_csv(io.BytesIO(res.read()), encoding="utf-8-sig")
    df = df.dropna(subset=list(COLUMNS))[list(COLUMNS)]
    df["Date"] = pd.to_datetime(df["Date"], dayfirst=True).dt.strftime("%Y-%m-%d")
    df["HomeTeam"] = df["HomeTeam"].str.strip()
    df["AwayTeam"] = df["AwayTeam"].str.strip()

    RAW_DIR.mkdir(parents=True, exist_ok=True)
    df.to_csv(RAW_DIR / f"season-{code}.csv", index=False)
    return df.rename(columns=COLUMNS)


def insert_new_matches(df, code):
    #Insert only the matches that are not in the database yet
    conn = psycopg2.connect(os.environ["DATABASE_URL"])
    cur = conn.cursor()

    cur.execute("INSERT INTO seasons (code) VALUES (%s) ON CONFLICT (code) DO NOTHING;", (code,))
    cur.execute("SELECT id FROM seasons WHERE code = %s;", (code,))
    s_id = cur.fetchone()[0]

    for team in set(df["home_team"]) | set(df["away_team"]):
        cur.execute("INSERT INTO teams (name) VALUES (%s) ON CONFLICT (name) DO NOTHING;", (team,))
    cur.execute("SELECT name, id FROM teams;")
    team_ids = dict(cur.fetchall())

    cur.execute("SELECT match_date, home_team_id, away_team_id FROM matches WHERE season_id = %s;", (s_id,))
    known = {(str(d), h, a) for d, h, a in cur.fetchall()}

    added = 0
    for _, r in df.iterrows():
        h, a = team_ids[r["home_team"]], team_ids[r["away_team"]]
        if (r["match_date"], h, a) in known:
            continue
        cur.execute(
            f"""
            INSERT INTO matches (
                season_id, match_date, home_team_id, away_team_id, result, {", ".join(STATS)}
            ) VALUES (%s, %s, %s, %s, %s, {", ".join(["%s"] * len(STATS))});
            """,
            (s_id, r["match_date"], h, a, r["result"], *[int(r[c]) for c in STATS]),
        )
        added += 1

    conn.commit()
    cur.close()
    conn.close()
    return added


def update():
    code = season_code()
    df = download_season(code)
    added = insert_new_matches(df, code)
    print(f"Season {code}: {len(df)} matches played, {added} new in the database")
    return added


if __name__ == "__main__":
    update()
