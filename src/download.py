from pathlib import Path
from urllib.request import Request, urlopen

from competitions import CUPS, LEAGUES, all_seasons, season_code, season_start

RAW_DIR = Path(__file__).resolve().parent.parent / "data" / "raw"

LEAGUE_URL = "https://www.football-data.co.uk/mmz4281/{code}/{div}.csv"
CUP_URL = "https://fixturedownload.com/feed/json/{feed}-{year}"


def fetch(url):
    req = Request(url, headers={"User-Agent": "Data-Kick"})
    with urlopen(req, timeout=30) as res:
        return res.read()


def save(path, url, refresh):
    #Finished seasons never change: download them once, the current one every time
    if path.exists() and not refresh:
        return False
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(fetch(url))
    return True


def download_leagues(seasons=None):
    #One raw CSV per league and season: data/raw/<league>/season-XXYY.csv
    current = season_start()
    for div, league in LEAGUES.items():
        for start in seasons or all_seasons():
            code = season_code(start)
            path = RAW_DIR / league["folder"] / f"season-{code}.csv"
            if save(path, LEAGUE_URL.format(code=code, div=div), refresh=start == current):
                print(f"{league['name']} {code}: downloaded")


def download_cups(seasons=None):
    #One raw JSON per cup and season: data/raw/<cup>/season-XXYY.json
    current = season_start()
    for cup in CUPS.values():
        for start in seasons or all_seasons():
            code = season_code(start)
            path = RAW_DIR / cup["folder"] / f"season-{code}.json"
            if save(path, CUP_URL.format(feed=cup["feed"], year=start), refresh=start == current):
                print(f"{cup['name']} {code}: downloaded")


if __name__ == "__main__":
    download_leagues()
    download_cups()
