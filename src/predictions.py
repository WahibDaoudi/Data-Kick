import os
from datetime import datetime, timezone

import pandas as pd
import psycopg2
from psycopg2.extras import execute_values
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

from competitions import PREDICTED, season_code, season_start
from features import FEATURES, build_features, load_matches


def connect():
    return psycopg2.connect(os.getenv("DATABASE_URL"))


def save_live(competition, matches):
    #Store the predictions shown before kick-off; the last one before kick-off is kept
    now = datetime.now(timezone.utc)
    upcoming = [
        m for m in matches
        if m["probs"] and datetime.strptime(m["kickoff"], "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc) > now
    ]
    if not upcoming:
        return 0

    conn = connect()
    cur = conn.cursor()
    cur.execute("SELECT id FROM competitions WHERE code = %s;", (competition,))
    comp_id = cur.fetchone()[0]
    cur.execute("SELECT name, id FROM teams;")
    team_ids = dict(cur.fetchall())

    rows = []
    for m in upcoming:
        p = m["probs"]
        rows.append((comp_id, m["kickoff"][:10], team_ids[m["home"]], team_ids[m["away"]],
                     p["H"], p["D"], p["A"], max(p, key=p.get), "live"))
    execute_values(cur, """
        INSERT INTO predictions (competition_id, match_date, home_team_id, away_team_id,
                                 prob_home, prob_draw, prob_away, predicted, source)
        VALUES %s
        ON CONFLICT (competition_id, match_date, home_team_id, away_team_id) DO UPDATE SET
            prob_home = EXCLUDED.prob_home, prob_draw = EXCLUDED.prob_draw, prob_away = EXCLUDED.prob_away,
            predicted = EXCLUDED.predicted, source = 'live', created_at = now();
    """, rows)
    conn.commit()
    conn.close()
    return len(rows)


def stored_predictions(competition, matches):
    #Predictions made before kick-off for these matches: {(date, home, away): row}
    if not matches:
        return {}
    conn = connect()
    cur = conn.cursor()
    cur.execute("""
        SELECT p.match_date, th.name, ta.name, p.prob_home, p.prob_draw, p.prob_away, p.predicted, p.source
        FROM predictions p
        JOIN competitions c ON c.id = p.competition_id
        JOIN teams th ON th.id = p.home_team_id
        JOIN teams ta ON ta.id = p.away_team_id
        WHERE c.code = %s AND p.match_date = ANY(%s::date[]);
    """, (competition, sorted({m["kickoff"][:10] for m in matches})))
    rows = {(d.isoformat(), h, a): {"probs": {"H": round(ph, 4), "D": round(pd_, 4), "A": round(pa, 4)},
                                    "predicted": pred, "source": src}
            for d, h, a, ph, pd_, pa, pred, src in cur.fetchall()}
    conn.close()
    return rows


def backtest():
    #Predictions of this season's played matches by a model trained on previous seasons only
    #Features only use information before each match, the model never saw this season: real out-of-sample predictions
    #Matches that already have a live prediction keep it
    df, _ = build_features(load_matches())
    start = pd.Timestamp(season_start(), 7, 1)

    train = df[(df["match_date"] < start) & (df["history_weight"] >= 0.2)]
    model = make_pipeline(StandardScaler(), LogisticRegression())
    model.fit(train[FEATURES], train["target"])

    season = df[(df["match_date"] >= start) & df["competition"].isin(list(PREDICTED))]
    if season.empty:
        return 0
    proba = model.predict_proba(season[FEATURES])
    classes = list(model.classes_)
    rows = [
        (int(match_id), float(p[classes.index("H")]), float(p[classes.index("D")]), float(p[classes.index("A")]),
         classes[p.argmax()])
        for match_id, p in zip(season["match_id"], proba)
    ]

    conn = connect()
    cur = conn.cursor()
    inserted = execute_values(cur, """
        INSERT INTO predictions (competition_id, match_date, home_team_id, away_team_id,
                                 prob_home, prob_draw, prob_away, predicted, source)
        SELECT m.competition_id, m.match_date, m.home_team_id, m.away_team_id, v.h, v.d, v.a, v.p, 'backtest'
        FROM (VALUES %s) AS v(match_id, h, d, a, p)
        JOIN matches m ON m.id = v.match_id
        ON CONFLICT DO NOTHING
        RETURNING id;
    """, rows, fetch=True)
    conn.commit()
    conn.close()
    return len(inserted)


def season_results(competition):
    #Played matches of the current season with the prediction made before kick-off (live only), newest first
    conn = connect()
    cur = conn.cursor()
    cur.execute("""
        SELECT m.match_date, m.round, th.name, ta.name, m.home_goals, m.away_goals, m.result,
               p.prob_home, p.prob_draw, p.prob_away, p.predicted, p.source
        FROM matches m
        JOIN competitions c ON c.id = m.competition_id
        JOIN seasons s ON s.id = m.season_id
        JOIN teams th ON th.id = m.home_team_id
        JOIN teams ta ON ta.id = m.away_team_id
        JOIN predictions p ON p.competition_id = m.competition_id AND p.match_date = m.match_date
                          AND p.home_team_id = m.home_team_id AND p.away_team_id = m.away_team_id
        WHERE c.code = %s AND s.code = %s AND p.source = 'live'
        ORDER BY m.match_date DESC, m.id DESC;
    """, (competition, season_code(season_start())))
    rows = cur.fetchall()

    #Live predictions still waiting for their result
    cur.execute("""
        SELECT count(*)
        FROM predictions p
        JOIN competitions c ON c.id = p.competition_id
        WHERE c.code = %s AND p.source = 'live' AND p.match_date >= %s
          AND NOT EXISTS (SELECT 1 FROM matches m
                          WHERE m.competition_id = p.competition_id AND m.match_date = p.match_date
                            AND m.home_team_id = p.home_team_id AND m.away_team_id = p.away_team_id);
    """, (competition, f"{season_start()}-07-01"))
    pending = cur.fetchone()[0]
    conn.close()

    matches = [{
        "date": d.isoformat(), "round": rnd, "home": home, "away": away,
        "score": [hg, ag], "result": result,
        "probs": {"H": round(ph, 4), "D": round(pd_, 4), "A": round(pa, 4)},
        "predicted": predicted, "correct": predicted == result, "source": source,
    } for d, rnd, home, away, hg, ag, result, ph, pd_, pa, predicted, source in rows]

    played = len(matches)
    correct = sum(m["correct"] for m in matches)
    #Reference: always predicting a home win
    home_wins = sum(m["result"] == "H" for m in matches)
    return {
        "season": season_code(season_start()),
        "summary": {
            "played": played,
            "correct": correct,
            "accuracy": round(correct / played, 4) if played else None,
            "home_baseline": round(home_wins / played, 4) if played else None,
            "pending": pending,
        },
        "matches": matches,
    }


if __name__ == "__main__":
    print(f"Backtest: {backtest()} new predictions")
    for code in PREDICTED:
        print(code, season_results(code)["summary"])
