import json
from datetime import datetime, timedelta, timezone
from urllib.request import Request, urlopen

from competitions import PREDICTED, season_start

FEED = "https://fixturedownload.com/feed/json/{feed}-{year}"


def load_feed(competition, now):
    #A season starts in July: in October 2026 the feed is <feed>-2026
    year = season_start(now.date())
    req = Request(FEED.format(feed=PREDICTED[competition]["feed"], year=year), headers={"User-Agent": "Data-Kick"})
    with urlopen(req, timeout=20) as res:
        return json.load(res)


def upcoming_fixtures(competition="F1", keep_days=2, horizon_days=7, now=None):
    #The current round only: its played matches (with their final score) and the ones still to come
    #Current round = the highest round already started. Once all its matches are played, it stays `keep_days`
    #after the last one, then the next round takes its place (or as soon as the next round starts).
    #A match postponed more than `horizon_days` after the start of its round does not hold it back, and is not shown.
    now = now or datetime.now(timezone.utc)
    aliases = PREDICTED[competition]["aliases"]
    matches = []
    for m in load_feed(competition, now):
        played = m["HomeTeamScore"] is not None
        matches.append({
            "kickoff": datetime.strptime(m["DateUtc"], "%Y-%m-%d %H:%M:%SZ").replace(tzinfo=timezone.utc),
            "round": m["RoundNumber"],
            "home": aliases.get(m["HomeTeam"], m["HomeTeam"]),
            "away": aliases.get(m["AwayTeam"], m["AwayTeam"]),
            "score": [m["HomeTeamScore"], m["AwayTeamScore"]] if played else None,
        })

    def of_round(r):
        #Window counted from today for a started round, from its first match for a round to come
        games = [m for m in matches if m["round"] == r]
        if not games:
            return []
        horizon = max(now, min(m["kickoff"] for m in games)) + timedelta(days=horizon_days)
        return [m for m in games if m["score"] or m["kickoff"] <= horizon]

    #Highest round already started: a postponed match of an older round played late does not bring it back
    current = max((m["round"] for m in matches if m["kickoff"] <= now), default=None)
    if current is not None:
        week = of_round(current)
        finished = all(m["score"] for m in week)
        if finished and max(m["kickoff"] for m in week) < now - timedelta(days=keep_days):
            current = None
    if current is None:
        upcoming = sorted((m for m in matches if m["kickoff"] > now), key=lambda m: m["kickoff"])
        current = upcoming[0]["round"] if upcoming else max((m["round"] for m in matches), default=None)

    week = sorted(of_round(current), key=lambda m: m["kickoff"])
    for m in week:
        m["kickoff"] = m["kickoff"].strftime("%Y-%m-%dT%H:%M:%SZ")
    return week
