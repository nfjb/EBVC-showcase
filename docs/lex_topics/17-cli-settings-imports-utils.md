# CLI, Settings, Imports, Utilities

Search keywords: lex cli, env vars, module aliasing, lex setup, lex init, lex start, lex celery, lex migrate

## Scope

- `lex` CLI commands reference
- Runtime configuration via environment variables
- Import conventions and utility primitives

## CLI Commands

### Everyday Commands

| Command | What It Does |
|---|---|
| `lex setup` | Generate `.run/`, `.env`, and `migrations/` for a new project |
| `lex init` | Apply migrations + sync models/permissions to Keycloak |
| `lex start` | Start the development server |
| `lex --version` | Print the installed `lex-app` version |

### Keycloak Commands

| Command | What It Does |
|---|---|
| `lex init` | Sync models to Keycloak (also applies migrations) |
| `lex generate-configs` | Regenerate Keycloak configuration files |

### Database Commands

| Command | What It Does |
|---|---|
| `lex migrate` | Apply pending Django migrations |
| `lex makemigrations` | Create new migration files from model changes |
| `lex create_db` | Create/recreate the database |
| `lex sqlflush` | Print SQL statements to flush the database |

### Usage Pattern

**Linux / macOS:**
```bash
# Load environment variables first
set -a; source .env; set +a

# Then run any lex command
lex init
lex start --reload --loop asyncio lex_app.asgi:application
```

**Windows PowerShell:**
```powershell
Get-Content .env | ForEach-Object {
    if ($_ -match '^([^=]+)=(.*)$') {
        [System.Environment]::SetEnvironmentVariable($matches[1], $matches[2])
    }
}
lex init
lex start
```

## Key Settings

- `lex` CLI handles setup, startup, celery, and management-command pass-through.
- Environment variables control DB/cache/auth/celery behavior.
- `lex_config.py` in project root for framework settings (e.g., `INITIAL_DATA`, Celery config).
- Import aliasing shortens user-facing module paths while preserving canonical imports.

## LLM Prompt Starters

- "Produce the exact `lex` CLI command sequence for setup, init, server, and celery worker."
- "Audit this import usage against Lex aliasing/utilities and suggest canonical paths only."
