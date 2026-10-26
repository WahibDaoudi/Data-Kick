from datetime import date

#First season downloaded for every competition (2019-20, same as Ligue 1)
FIRST_SEASON = 2019

#Domestic leagues: football-data.co.uk division code -> raw folder, name, country
LEAGUES = {
    "F1": {"folder": "ligue-1", "name": "Ligue 1", "country": "France"},
    "E0": {"folder": "premier-league", "name": "Premier League", "country": "England"},
    "SP1": {"folder": "la-liga", "name": "La Liga", "country": "Spain"},
    "D1": {"folder": "bundesliga", "name": "Bundesliga", "country": "Germany"},
    "I1": {"folder": "serie-a", "name": "Serie A", "country": "Italy"},
    "P1": {"folder": "primeira-liga", "name": "Primeira Liga", "country": "Portugal"},
    "N1": {"folder": "eredivisie", "name": "Eredivisie", "country": "Netherlands"},
    "B1": {"folder": "pro-league", "name": "Pro League", "country": "Belgium"},
    "T1": {"folder": "super-lig", "name": "Super Lig", "country": "Turkey"},
    "SC0": {"folder": "premiership", "name": "Premiership", "country": "Scotland"},
    "G1": {"folder": "super-league", "name": "Super League", "country": "Greece"},
}

#European cups: fixturedownload.com feed name
CUPS = {
    "UCL": {"folder": "champions-league", "name": "Champions League", "feed": "champions-league"},
}


#Champions League names (fixturedownload) -> football-data names, so a club has one name everywhere
#Clubs outside the downloaded leagues only get their spellings unified
UCL_ALIASES = {
    "AEK Athens": "AEK", "Athletic Club": "Ath Bilbao", "Atleti": "Ath Madrid",
    "Atlético": "Ath Madrid", "Atlético de Madrid": "Ath Madrid", "B. Dortmund": "Dortmund",
    "Bayern": "Bayern Munich", "Bayern München": "Bayern Munich", "Braga": "Sp Braga",
    "FC Porto": "Porto", "Fenerbahçe": "Fenerbahce", "Frankfurt": "Ein Frankfurt",
    "Internazionale": "Inter", "Istanbul Basaksehir": "Buyuksehyr", "LOSC": "Lille",
    "Leipzig": "RB Leipzig", "Man Utd": "Man United", "Man. City": "Man City",
    "Man. United": "Man United", "Mönchengladbach": "M'gladbach", "Olympiacos": "Olympiakos",
    "PSV": "PSV Eindhoven", "Paris": "Paris SG", "Real Betis": "Betis",
    "Real Sociedad": "Sociedad", "Sporting CP": "Sp Lisbon", "Union SG": "St. Gilloise",
    "Crvena zvezda": "Crvena Zvezda", "GNK Dinamo": "Dinamo Zagreb", "Shakhtar": "Shakhtar Donetsk",
}


#Ligue 1 names (fixturedownload) -> football-data names
LIGUE1_ALIASES = {
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

#Premier League names (fixturedownload) -> football-data names
PREMIER_LEAGUE_ALIASES = {"Man Utd": "Man United", "Spurs": "Tottenham"}

#La Liga and Serie A names (fixturedownload) -> football-data names
LALIGA_ALIASES = {
    "Athletic Club": "Ath Bilbao", "Atlético de Madrid": "Ath Madrid", "CA Osasuna": "Osasuna",
    "Deportivo Alavés": "Alaves", "Elche CF": "Elche", "FC Barcelona": "Barcelona", "Getafe CF": "Getafe",
    "Levante UD": "Levante", "Málaga CF": "Malaga", "R. Racing Club": "Santander", "RC Deportivo": "La Coruna",
    "RCD Espanyol de Barcelona": "Espanol", "Rayo Vallecano": "Vallecano", "Real Betis": "Betis",
    "Real Sociedad": "Sociedad", "Sevilla FC": "Sevilla", "Valencia CF": "Valencia", "Villarreal CF": "Villarreal",
}
SERIE_A_ALIASES = {"Internazionale": "Inter"}

#Competitions predicted on the website: fixtures feed, feed names, kind of competition
PREDICTED = {
    "F1": {"feed": "ligue-1", "aliases": LIGUE1_ALIASES, "kind": "league"},
    "E0": {"feed": "epl", "aliases": PREMIER_LEAGUE_ALIASES, "kind": "league"},
    "SP1": {"feed": "la-liga", "aliases": LALIGA_ALIASES, "kind": "league"},
    "I1": {"feed": "serie-a", "aliases": SERIE_A_ALIASES, "kind": "league"},
    "UCL": {"feed": "champions-league", "aliases": UCL_ALIASES, "kind": "cup"},
}


def season_start(day=None):
    #A season starts in July: 2026-10-21 -> 2026
    day = day or date.today()
    return day.year if day.month >= 7 else day.year - 1


def season_code(start):
    #2026 -> "2627"
    return f"{start % 100:02d}{(start + 1) % 100:02d}"


def all_seasons():
    #Every season start year from FIRST_SEASON to the current one
    return list(range(FIRST_SEASON, season_start() + 1))
