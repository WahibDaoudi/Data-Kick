import json
import os
import threading
import time
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

import joblib

from competitions import PREDICTED
from features import get_fixture_features, get_fixtures_features
from fixtures import upcoming_fixtures
from predictions import save_live, season_results, stored_predictions
from update import update

ROOT = Path(__file__).resolve().parent.parent
WEB_DIR = ROOT / "web"
MODEL_PATH = ROOT / "models" / "model.joblib"
PORT = int(os.getenv("PORT", 8000))
#127.0.0.1: only this machine (local use, or behind Caddy in production)
HOST = os.getenv("HOST", "127.0.0.1")
CACHE_SECONDS = 30 * 60
#New results, then new predictions, every 3 hours while the server runs
REFRESH_SECONDS = 3 * 60 * 60

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


def week_predictions(competition):
    #Upcoming matches of a competition with their probabilities, cached for 30 minutes
    if competition in cache and time.time() - cache[competition][0] < CACHE_SECONDS:
        return cache[competition][1]

    matches = upcoming_fixtures(competition)
    now = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    started = [m for m in matches if m["kickoff"] <= now]
    to_come = [m for m in matches if m["kickoff"] > now]

    #Started or played: the prediction stored before kick-off (never recomputed: the model could see the result),
    #and the verdict once the score is known
    stored = stored_predictions(competition, started)
    for m in started:
        saved = stored.get((m["kickoff"][:10], m["home"], m["away"]))
        m["probs"] = saved["probs"] if saved else None
        m["source"] = saved["source"] if saved else None
        m["error"] = None if saved else "No prediction made before kick-off"
        m["correct"] = None
        if saved and m["score"]:
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


def refresh():
    #New results in the database, upcoming matches recomputed (and their live predictions stored)
    #Any error is printed and skipped: the next refresh retries, the loop never dies
    try:
        update()
    except Exception as e:
        print(f"Update skipped: {e!r}")
    cache.clear()
    for competition in PREDICTED:
        try:
            week_predictions(competition)
        except Exception as e:
            print(f"{competition} predictions skipped: {e!r}")


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
            return self.send_json(200, {"competition": competition, **season_results(competition)})
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

    #In the background: every competition predicted (switching is instant, live predictions stored),
    #then the same again every REFRESH_SECONDS so the next round uses the latest results
    def background():
        for competition in PREDICTED:
            try:
                week_predictions(competition)
            except Exception as e:
                print(f"{competition} predictions skipped: {e!r}")
        while True:
            time.sleep(REFRESH_SECONDS)
            refresh()
    threading.Thread(target=background, daemon=True).start()

    server = ThreadingHTTPServer((HOST, PORT), Handler)
    print(f"Data-Kick running on http://{HOST}:{PORT}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
