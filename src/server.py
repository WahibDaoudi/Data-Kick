import json
import os
import threading
import time
from datetime import datetime, timedelta, timezone
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

import joblib

from competitions import PREDICTED
from features import get_fixture_features, get_fixtures_features, invalidate_context
from fixtures import upcoming_fixtures
from predictions import save_live, season_results, stored_predictions
from update import update

ROOT = Path(__file__).resolve().parent.parent
WEB_DIR = ROOT / "web"
MODEL_PATH = ROOT / "models" / "model.joblib"
PORT = int(os.getenv("PORT", 8000))
#127.0.0.1: only this machine (local use, or behind Caddy in production)
HOST = os.getenv("HOST", "127.0.0.1")
#Scores of the current round, read in the background (visitors only read the cache, they never wait):
#every 2 minutes while a match is being played or waiting for its final score, every 10 minutes otherwise
LIVE_SECONDS = 2 * 60
IDLE_SECONDS = 10 * 60
#New results in the database (features of the next matches) every 3 hours
UPDATE_SECONDS = 3 * 60 * 60

#Loaded once at startup
model = joblib.load(MODEL_PATH)
#Predictions of each competition: {code: (timestamp, matches)}
cache = {}


def to_probs(X):
    #Probabilities keyed by result: H, D, A
    proba = model.predict_proba(X)[0]
    return {c: round(float(p), 4) for c, p in zip(model.classes_, proba)}


def predict(home, away):
    return to_probs(get_fixture_features(home, away))


def week_predictions(competition, force=False):
    #Matches of the current round with their probabilities and verdicts; the cache unless force (background refresh)
    if competition in cache and not force:
        return cache[competition][1]

    matches = upcoming_fixtures(competition)
    now = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    started = [m for m in matches if m["kickoff"] <= now]
    to_come = [m for m in matches if m["kickoff"] > now]

    #Started or played: the prediction stored before kick-off (never recomputed: the model could see the result),
    #and the verdict once the score is known (live predictions only, like the accuracy screen)
    stored = stored_predictions(competition, started)
    for m in started:
        saved = stored.get((m["kickoff"][:10], m["home"], m["away"]))
        m["probs"] = saved["probs"] if saved else None
        m["source"] = saved["source"] if saved else None
        m["error"] = None if saved else "No prediction made before kick-off"
        m["correct"] = None
        if saved and m["score"] and saved["source"] == "live":
            hg, ag = m["score"]
            m["correct"] = saved["predicted"] == ("H" if hg > ag else "A" if hg < ag else "D")

    #To come: fresh prediction from the latest results
    kind = PREDICTED[competition]["kind"]
    features = get_fixtures_features([(m["home"], m["away"], m["kickoff"][:10]) for m in to_come], kind)
    for m, X in zip(to_come, features):
        #A string means the match cannot be predicted (unknown team, no history)
        m["probs"] = None if isinstance(X, str) else to_probs(X)
        m["error"] = X if isinstance(X, str) else None
        m["correct"] = None

    #Keep what was predicted before kick-off, to check it once the match is played
    save_live(competition, to_come)
    cache[competition] = (time.time(), matches)
    return matches


def results_with_fresh(competition):
    #Season results from the database, plus the matches whose final score is already in the fixtures feed
    #but not yet in the database (league results reach the database 1 to 2 days after the match)
    data = season_results(competition)
    known = {(m["date"], m["home"], m["away"]) for m in data["matches"]}
    try:
        fixtures = week_predictions(competition)
    except OSError:
        fixtures = []

    fresh = []
    for f in fixtures:
        key = (f["kickoff"][:10], f["home"], f["away"])
        #Same rule as the database results: a live prediction made before kick-off, and a final score
        if not f["score"] or f["correct"] is None or f.get("source") != "live" or key in known:
            continue
        hg, ag = f["score"]
        fresh.append({
            "date": key[0], "round": f["round"], "home": f["home"], "away": f["away"],
            "score": f["score"], "result": "H" if hg > ag else "A" if hg < ag else "D",
            "probs": f["probs"], "predicted": max(f["probs"], key=f["probs"].get),
            "correct": f["correct"], "source": "live",
        })
    if not fresh:
        return data

    matches = sorted(fresh + data["matches"], key=lambda m: m["date"], reverse=True)
    played = len(matches)
    data["matches"] = matches
    data["summary"].update(
        played=played,
        correct=sum(m["correct"] for m in matches),
        accuracy=round(sum(m["correct"] for m in matches) / played, 4),
        home_baseline=round(sum(m["result"] == "H" for m in matches) / played, 4),
        pending=max(data["summary"]["pending"] - len(fresh), 0),
    )
    return data


def is_live(matches):
    #A match started less than 4 hours ago and still without its final score
    now = datetime.now(timezone.utc)
    for m in matches:
        kickoff = datetime.strptime(m["kickoff"], "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)
        if not m["score"] and kickoff <= now <= kickoff + timedelta(hours=4):
            return True
    return False


def refresh(competition):
    #Fresh scores and predictions of one competition; any error is printed and skipped, the next round retries
    try:
        week_predictions(competition, force=True)
    except Exception as e:
        print(f"{competition} refresh skipped: {e!r}")


def background():
    #Every competition now (switching is instant), then each one at its own pace, new database results every 3 hours
    for competition in PREDICTED:
        refresh(competition)
    last_update = time.time()
    while True:
        time.sleep(30)
        if time.time() - last_update >= UPDATE_SECONDS:
            try:
                update()
            except Exception as e:
                print(f"Update skipped: {e!r}")
            #New results change the form of the teams: every prediction is recomputed
            invalidate_context()
            cache.clear()
            last_update = time.time()
        for competition in PREDICTED:
            age = time.time() - cache[competition][0] if competition in cache else float("inf")
            pace = LIVE_SECONDS if competition in cache and is_live(cache[competition][1]) else IDLE_SECONDS
            if age >= pace:
                refresh(competition)


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(WEB_DIR), **kwargs)

    def do_GET(self):
        url = urlparse(self.path)
        if url.path == "/api/fixtures":
            competition = parse_qs(url.query).get("competition", ["F1"])[0]
            if competition not in PREDICTED:
                return self.send_json(400, {"error": f"Unknown competition: {competition}"})
            try:
                return self.send_json(200, {"competition": competition, "fixtures": week_predictions(competition)})
            except OSError as e:
                return self.send_json(502, {"error": f"Fixtures unavailable: {e}"})
        if url.path == "/api/results":
            competition = parse_qs(url.query).get("competition", ["F1"])[0]
            if competition not in PREDICTED:
                return self.send_json(400, {"error": f"Unknown competition: {competition}"})
            return self.send_json(200, {"competition": competition, **results_with_fresh(competition)})
        if url.path == "/api/predict":
            query = parse_qs(url.query)
            home = query.get("home", [""])[0]
            away = query.get("away", [""])[0]
            if not home or not away or home == away:
                return self.send_json(400, {"error": "Two different teams are required"})
            try:
                return self.send_json(200, {"home": home, "away": away, "probs": predict(home, away)})
            except ValueError as e:
                return self.send_json(400, {"error": str(e)})
        #Everything else: static files from web/
        super().do_GET()

    def end_headers(self):
        #Browsers must check for a new version of every file: an old app.js with a new index.html breaks the page
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()

    def send_json(self, status, data):
        body = json.dumps(data).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


if __name__ == "__main__":
    #Fresh results first: features of upcoming matches depend on them
    try:
        update()
    except OSError as e:
        print(f"Update skipped (offline?): {e}")

    threading.Thread(target=background, daemon=True).start()

    server = ThreadingHTTPServer((HOST, PORT), Handler)
    print(f"Data-Kick running on http://{HOST}:{PORT}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
