import json
import os

import pandas as pd
import psycopg2

from competitions import CUPS, LEAGUES, UCL_ALIASES, season_code, season_start
from download import RAW_DIR, download_cups, download_leagues
from ingest import insert_matches

#Raw columns -> DB columns (same mapping as the notebooks)
COLUMNS = {
    "Date": "match_date", "HomeTeam": "home_team", "AwayTeam": "away_team",
    "FTHG": "home_goals", "FTAG": "away_goals", "FTR": "result",
    "HS": "home_shots", "AS": "away_shots",
    "HST": "home_shots_on_target", "AST": "away_shots_on_target",
    "HC": "home_corners", "AC": "away_corners",
    "HY": "home_yellow_cards", "AY": "away_yellow_cards",
    "HR": "home_red_cards", "AR": "away_red_cards",
}


def league_season(div, code):
    #One raw football-data season, cleaned like in notebooks/multi_league.ipynb
    path = RAW_DIR / LEAGUES[div]["folder"] / f"season-{code}.csv"
    df = pd.read_csv(path, encoding="utf-8-sig", usecols=list(COLUMNS)).dropna(subset=["HomeTeam", "FTR"])
    df = df.rename(columns=COLUMNS)
    df["match_date"] = pd.to_datetime(df["match_date"], format="%d/%m/%Y")
    df["home_team"] = df["home_team"].str.strip()
    df["away_team"] = df["away_team"].str.strip()
    df["competition"] = div
    df["season"] = code
    return df


def cup_season(cup, code):
    #One raw fixturedownload season: played matches only, names mapped to football-data names
    path = RAW_DIR / CUPS[cup]["folder"] / f"season-{code}.json"
    rows = []
    for m in json.loads(path.read_text()):
        if m["HomeTeamScore"] is None:
            continue
        hg, ag = m["HomeTeamScore"], m["AwayTeamScore"]
        rows.append({
            "competition": cup,
            "season": code,
            "match_date": pd.to_datetime(m["DateUtc"]).tz_localize(None).normalize(),
            "round": m["RoundNumber"],
            #The current season is not finished: its final is not played yet
            "neutral": False,
            "home_team": UCL_ALIASES.get(m["HomeTeam"], m["HomeTeam"]),
            "away_team": UCL_ALIASES.get(m["AwayTeam"], m["AwayTeam"]),
            "home_goals": hg,
            "away_goals": ag,
            "result": "H" if hg > ag else "A" if hg < ag else "D",
        })
    return pd.DataFrame(rows)


def update():
    #Download the current season of every competition, then insert the new matches
    start = season_start()
    code = season_code(start)
    download_leagues([start])
    download_cups([start])

    frames = [league_season(div, code) for div in LEAGUES] + [cup_season(cup, code) for cup in CUPS]
    df = pd.concat([f for f in frames if not f.empty], ignore_index=True)

    conn = psycopg2.connect(os.environ["DATABASE_URL"])
    cur = conn.cursor()
    added = insert_matches(cur, df)
    conn.commit()
    cur.close()
    conn.close()
    print(f"Season {code}: {len(df)} matches played, {added} new in the database")
    return added


if __name__ == "__main__":
    update()
