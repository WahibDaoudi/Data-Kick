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


def upcoming_fixtures(competition="F1", days=7, recent_hours=2, now=None):
    #Matches still being played (kick-off less than `recent_hours` ago) and of the next `days` days,
    #or the next round if nothing is coming within `days`
    now = now or datetime.now(timezone.utc)
    aliases = PREDICTED[competition]["aliases"]
    matches = []
    for m in load_feed(competition, now):
        kickoff = datetime.strptime(m["DateUtc"], "%Y-%m-%d %H:%M:%SZ").replace(tzinfo=timezone.utc)
        if kickoff < now - timedelta(hours=recent_hours):
            continue
        played = m["HomeTeamScore"] is not None
        matches.append({
            "kickoff": kickoff,
            "round": m["RoundNumber"],
            "home": aliases.get(m["HomeTeam"], m["HomeTeam"]),
            "away": aliases.get(m["AwayTeam"], m["AwayTeam"]),
            "score": [m["HomeTeamScore"], m["AwayTeamScore"]] if played else None,
        })
    matches.sort(key=lambda m: m["kickoff"])

    week = [m for m in matches if m["kickoff"] <= now + timedelta(days=days)]
    if not any(m["score"] is None for m in week):
        upcoming = [m for m in matches if m["score"] is None]
        if upcoming:
            week += [m for m in upcoming if m["round"] == upcoming[0]["round"] and m not in week]

    for m in week:
        m["kickoff"] = m["kickoff"].strftime("%Y-%m-%dT%H:%M:%SZ")
    return week
