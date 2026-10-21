import json
import os
import time
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

import joblib

from features import get_fixture_features, get_fixtures_features
from fixtures import upcoming_fixtures
from update import update

ROOT = Path(__file__).resolve().parent.parent
WEB_DIR = ROOT / "web"
MODEL_PATH = ROOT / "models" / "model.joblib"
PORT = int(os.getenv("PORT", 8000))
CACHE_SECONDS = 30 * 60

#Loaded once at startup
model = joblib.load(MODEL_PATH)
cache = {"at": 0.0, "data": None}


def to_probs(X):
    #Probabilities keyed by result: H, D, A
    proba = model.predict_proba(X)[0]
    return {c: round(float(p), 4) for c, p in zip(model.classes_, proba)}


def predict(home, away):
    return to_probs(get_fixture_features(home, away))


def week_predictions():
    #Upcoming matches with their probabilities, cached for 30 minutes
    if cache["data"] is not None and time.time() - cache["at"] < CACHE_SECONDS:
        return cache["data"]

    matches = upcoming_fixtures()
    features = get_fixtures_features([(m["home"], m["away"], m["kickoff"][:10]) for m in matches])
    for m, X in zip(matches, features):
        #A string means the match cannot be predicted (unknown team, no history)
        m["probs"] = None if isinstance(X, str) else to_probs(X)
        m["error"] = X if isinstance(X, str) else None

    cache.update(at=time.time(), data=matches)
    return matches


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(WEB_DIR), **kwargs)

    def do_GET(self):
        url = urlparse(self.path)
        if url.path == "/api/fixtures":
            try:
                return self.send_json(200, {"fixtures": week_predictions()})
            except OSError as e:
                return self.send_json(502, {"error": f"Fixtures unavailable: {e}"})
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

    server = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    print(f"Data-Kick running on http://localhost:{PORT}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
