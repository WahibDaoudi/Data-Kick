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


def upcoming_fixtures(competition="F1", days=7, keep_days=2, now=None):
    #The current round (the last one that has started: played matches with their score, and the ones still to come),
    #kept until `keep_days` after its last match, plus the matches of the next `days` days
    #(or the next round if nothing is coming within `days`)
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

    #Highest round already started: a match of an older round played late (postponed) does not bring it back
    started = [m for m in matches if m["kickoff"] <= now]
    current = max((m["round"] for m in started), default=None)
    week = [m for m in matches if m["round"] == current]
    #A finished round leaves the list `keep_days` after its last match
    if week and max(m["kickoff"] for m in week) < now - timedelta(days=keep_days):
        week = []

    upcoming = sorted((m for m in matches if m["kickoff"] > now), key=lambda m: m["kickoff"])
    soon = [m for m in upcoming if m["kickoff"] <= now + timedelta(days=days)]
    if not soon and upcoming:
        soon = [m for m in upcoming if m["round"] == upcoming[0]["round"]]
    week += [m for m in soon if m not in week]

    week.sort(key=lambda m: m["kickoff"])
    for m in week:
        m["kickoff"] = m["kickoff"].strftime("%Y-%m-%dT%H:%M:%SZ")
    return week
