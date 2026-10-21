import json
from datetime import datetime, timedelta, timezone
from urllib.request import Request, urlopen

FEED = "https://fixturedownload.com/feed/json/ligue-1-{year}"

#Feed names -> names of the teams table
NAMES = {
    "AJ Auxerre": "Auxerre", "AS Monaco": "Monaco", "Angers SCO": "Angers",
    "Estac Troyes": "Troyes", "FC Lorient": "Lorient", "FC Metz": "Metz",
    "FC Nantes": "Nantes", "Havre Athletic Club": "Le Havre", "LOSC Lille": "Lille",
    "Le Mans FC": "Le Mans", "Montpellier HSC": "Montpellier", "OGC Nice": "Nice",
    "Olympique Lyonnais": "Lyon", "Olympique de Marseille": "Marseille",
    "Paris FC": "Paris FC", "Paris Saint-Germain": "Paris SG", "RC Lens": "Lens",
    "RC Strasbourg Alsace": "Strasbourg", "Stade Brestois 29": "Brest",
    "Stade Rennais FC": "Rennes", "Stade de Reims": "Reims",
    "AS Saint-Étienne": "St Etienne", "Toulouse FC": "Toulouse",
}


def load_feed(now):
    #A season starts in July: in October 2026 the feed is ligue-1-2026
    year = now.year if now.month >= 7 else now.year - 1
    req = Request(FEED.format(year=year), headers={"User-Agent": "Data-Kick"})
    with urlopen(req, timeout=20) as res:
        return json.load(res)


def upcoming_fixtures(days=7, now=None):
    #Unplayed matches of the next `days` days, or the next round if there are none
    now = now or datetime.now(timezone.utc)
    matches = []
    for m in load_feed(now):
        kickoff = datetime.strptime(m["DateUtc"], "%Y-%m-%d %H:%M:%SZ").replace(tzinfo=timezone.utc)
        #Keep matches that started less than 2 hours ago (still being played)
        if kickoff < now - timedelta(hours=2):
            continue
        matches.append({
            "kickoff": kickoff,
            "round": m["RoundNumber"],
            "home": NAMES.get(m["HomeTeam"], m["HomeTeam"]),
            "away": NAMES.get(m["AwayTeam"], m["AwayTeam"]),
        })
    matches.sort(key=lambda m: m["kickoff"])

    week = [m for m in matches if m["kickoff"] <= now + timedelta(days=days)]
    if not week and matches:
        week = [m for m in matches if m["round"] == matches[0]["round"]]

    for m in week:
        m["kickoff"] = m["kickoff"].strftime("%Y-%m-%dT%H:%M:%SZ")
    return week
