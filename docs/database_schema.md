# Database Architecture — Data-Kick

PostgreSQL relational schema for storing and analyzing Ligue 1 match data.

---

## 1. Entity-Relationship Overview

```text
       [ seasons ]                               [ teams ]
  +----+--------+                           +----+----------+
  | id | code   |                           | id | name     |  <-- PK (Primary Key)
  +----+--------+                           +----+----------+
         ^                                         ^      ^
         | (season_id)                             |      |
         |                                         |      |
  +------+-------------+---------------------------+      |
  |                    | (home_team_id)                   | (away_team_id)
  |                    |                                  |
  |             [ matches ]                               |
  +----+-----------+--------------+--------------+--------+---+------------+
  | id | season_id | match_date   | home_team_id | away_team_id | result   |
  +----+-----------+--------------+--------------+--------------+----------+
```

### How it works:
* **`seasons`** and **`teams`** store unique reference values once (avoiding text duplication).
* **`matches`** is the central fact table. Instead of storing team names or season strings repeatedly, it stores lightweight integer pointers (**Foreign Keys**: `season_id`, `home_team_id`, `away_team_id`) that reference the **Primary Keys** (`id`) of the parent tables.

---

## 2. Tables Breakdown

### Table 1: `seasons`
Stores each Ligue 1 edition.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `SERIAL` | `PRIMARY KEY` | Unique internal identifier |
| `code` | `VARCHAR(10)` | `NOT NULL, UNIQUE` | Short season identifier (e.g., `1920`, `2324`) |

---

### Table 2: `teams`
Master list of all football clubs.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `SERIAL` | `PRIMARY KEY` | Unique internal identifier |
| `name` | `VARCHAR(100)` | `NOT NULL, UNIQUE` | Standardized club name (e.g., `Paris SG`, `Marseille`) |

---

### Table 3: `matches`
Central table containing match results and in-game statistics.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `SERIAL` | `PRIMARY KEY` | Unique match identifier |
| `season_id` | `INTEGER` | `NOT NULL, FK -> seasons(id)` | Pointer to the season |
| `match_date` | `DATE` | `NOT NULL` | Official match date (`YYYY-MM-DD`) |
| `home_team_id` | `INTEGER` | `NOT NULL, FK -> teams(id)` | Pointer to the home club |
| `away_team_id` | `INTEGER` | `NOT NULL, FK -> teams(id)` | Pointer to the away club |
| `home_goals` | `SMALLINT` | `NOT NULL` | Full