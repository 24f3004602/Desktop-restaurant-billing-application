# FastAPI Backend (Restaurant POS)

## Architecture

- Domain modules are under app/modules/:
	- auth/
	- inventory/
	- orders/
	- billing/
	- payments/
	- reports/
- Each module has router.py and service.py, plus local models.py/schemas.py facades.
- Shared configuration and runtime behavior are in app/core/:
	- config.py (Pydantic BaseSettings)
	- exceptions.py (typed application/domain errors)

## Run locally

1. Create and activate virtual environment
2. Install dependencies
3. Start API server

PowerShell example:

- python -m venv .venv
- .\\.venv\\Scripts\\Activate.ps1
- pip install -r requirements.txt
- uvicorn app.main:app --reload --host 127.0.0.1 --port 8000

Project root helper:

- npm run seed

## Default admin

- username: admin
- password: admin123

Change these via environment variables:

- DEFAULT_ADMIN_USERNAME
- DEFAULT_ADMIN_PASSWORD
- SECRET_KEY
- DATABASE_PATH

## API base URL

- http://127.0.0.1:8000/api/v1

## Alembic migrations

- alembic upgrade head
- alembic revision --autogenerate -m "your message"

## Docker

From project root:

- docker compose up --build

The backend container uses a mounted SQLite volume at /app/database.

## Backup helper

From project root:

- npm run backup

This runs scripts/backup.sh and rotates old SQLite backups.

## Test suites

- Node e2e smoke:
	- npm test
- Python unit/integration:
	- pytest -q
