# DataKick
Football match prediction with Python, SQL and machine learning

## Run the app

Retro arcade website: this week's Ligue 1 matches with the model's H/D/A probabilities.

```bash
docker compose up -d                 # PostgreSQL
source .venv/bin/activate
pip install -r requirements.txt
cd src
python train.py                      # creates models/model.joblib (once)
python server.py                     # http://localhost:8000
```

On startup the server runs `update.py`: it downloads the current season results
(football-data.co.uk) into `data/raw/ligue-1/` and inserts the new matches into the database,
so the features of upcoming matches are up to date. It can also be run alone: `python update.py`.

The server (`src/server.py`) serves the static site in `web/` and two endpoints:

- `GET /api/fixtures`: matches of the next 7 days (fixturedownload.com) with their probabilities, cached 30 min
- `GET /api/predict?home=Paris%20SG&away=Marseille`: `{"probs": {"H": ..., "D": ..., "A": ...}}`

Set `PORT` to use another port. Keys: arrows, Enter, Esc, M music on/off, S sound effects on/off.
