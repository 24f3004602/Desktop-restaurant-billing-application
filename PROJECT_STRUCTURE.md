# Project Structure

Current cleaned structure (source/config focused):

```text
restaurant-pos/
|-- main.js
|-- preload.js
|-- package.json
|-- package-lock.json
|-- .gitignore
|-- docker-compose.yml
|-- scripts/
|   |-- seed.py
|   `-- backup.sh
|-- .github/
|   `-- workflows/
|       `-- ci.yml
|-- backend/
|   |-- Dockerfile
|   |-- README.md
|   |-- requirements.txt
|   |-- alembic.ini
|   |-- .env.example
|   |-- alembic/
|   `-- app/
|       |-- main.py
|       |-- api/
|       |   `-- v1/
|       |-- core/
|       |   |-- config.py
|       |   `-- exceptions.py
|       |-- db/
|       |-- logging/
|       |-- models/
|       |-- modules/
|       |   |-- auth/
|       |   |-- inventory/
|       |   |-- orders/
|       |   |-- billing/
|       |   |-- payments/
|       |   `-- reports/
|       `-- schemas/
|-- electron/
|   |-- backendProcess.js
|   |-- ipcHandlers.js
|   |-- printer.js
|   `-- autoUpdater.js
|-- frontend/
|   |-- index.html
|   |-- package.json
|   |-- package-lock.json
|   |-- postcss.config.js
|   |-- tailwind.config.js
|   |-- tsconfig.json
|   |-- vite.config.ts
|   `-- src/
|       |-- App.vue
|       |-- main.ts
|       |-- api/
|       |-- composables/
|       |-- components/
|       |-- router/
|       |-- stores/
|       |-- types/
|       |-- utils/
|       `-- views/
|-- database/
|   |-- restaurant_pos.db
|   `-- backups/
`-- tests/
    |-- conftest.py
    |-- unit/
    |-- integration/
    `-- e2e/
        |-- smoke.billing-payment.test.js
        `-- conftest.py
```

Notes:
- Removed duplicated UI folders: src/renderer/ and src/renderer-vue/.
- Removed duplicate legacy backend folder src/backend.
- Removed unreferenced Electron template files under electron/.
- Generated folders (for example node_modules, frontend/dist, tests/.tmp) are intentionally omitted from this view.
- Packaging now excludes legacy src sources from packaged output.
- Backend is now domain-oriented under app/modules with router+service+models+schemas per domain.
