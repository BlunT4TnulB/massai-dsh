# @deepseek-ai/dsh-tool-sqlite

Embedded SQLite database for the agent (Node's built-in `node:sqlite`, no native build).

- `db_exec` — run DDL/DML (`CREATE TABLE`, `INSERT`, …)
- `db_query` — run a query and return rows as JSON

## Config
- `dbPath` — SQLite file (default `~/.dsh/massai.sqlite`)
