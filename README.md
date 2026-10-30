# DataKick
Football match prediction with Python, SQL and machine learning

## Run the app

Retro arcade website: this week's matches with the model's H/D/A probabilities, for **Ligue 1**, the **Premier League**, **La Liga**, **Serie A** and the **Champions League**.

```bash
docker compose up -d                 # PostgreSQL
source .venv/bin/activate
pip install -r requirements.txt
cd src
python server.py                     # http://localhost:8000
```

First install (empty database), from `src/`:

```bash
python download.py                   # raw files -> data/raw/
# run notebooks/multi_league.ipynb   # data/raw -> data/processed/
python ingest.py                     # data/processed -> PostgreSQL
python train.py                      # creates models/model.joblib
```

Existing database: apply the files of `sql/migrations/` once, in order (`001_multi_competition.sql`, `002_predictions.sql`).

Only the current round is shown. Its scores are read in the background every 2 minutes while a match is being
played (every 10 minutes otherwise), and the open page reloads them every minute during a match (every 5 otherwise). On startup, then every 3 hours, the server runs `update.py`: it downloads the current season of every competition
into `data/raw/` and inserts the new matches, so the features of upcoming matches (Elo, last 5 matches...) use the
latest results. The model itself is not retrained: only its inputs change.

Model accuracy (`src/predictions.py`): every prediction shown before kick-off is stored in the `predictions` table
(`live`). Matches already played this season get a `backtest` prediction from a model trained on previous seasons
only, so the accuracy is always measured out of sample.

The server (`src/server.py`) serves the static site in `web/` and two endpoints:

- `GET /api/fixtures?competition=F1|E0|SP1|I1|UCL`: matches of the next 7 days (fixturedownload.com) with their probabilities, cached 30 min
- `GET /api/results?competition=F1|E0|SP1|I1|UCL`: played matches of the season with their prediction, the result and the accuracy
- `GET /api/predict?home=Paris%20SG&away=Marseille`: `{"probs": {"H": ..., "D": ..., "A": ...}}`

Online: **https://datakick.duckdns.org**, hosted for free on Render (website, deployed on every push)
and Supabase (PostgreSQL). Setup guide: [deploy/RENDER.md](deploy/RENDER.md).

Set `PORT` (and `HOST`) to use another port or interface. Keys: left/right to pick the competition on the title screen, arrows, Enter, Esc, M music on/off, S sound effects on/off.
