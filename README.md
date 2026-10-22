# Forma — Dashboard Studio

A working, desktop-first dashboard builder inspired by the supplied Webflow/Framer editor references. Built with vanilla JavaScript modules, HTML5 Canvas, PHP 8.3, Apache and MySQL 8.4. No frontend build or runtime package installation is required.

## Run with Docker (recommended)

Install and start Docker Desktop, then run from this folder:

```sh
docker compose up -d --build
```

Open **http://localhost:8080**. Wait for “Connected to MySQL” in the footer. The schema and sample dashboard load automatically on the first startup. Click **Save dashboard**, then reload to verify persistence. MySQL data lives in a named Docker volume and survives container restarts.

Optional: copy `.env.example` to `.env` and change local database credentials **before the first startup**. Compose reads `.env`; PHP reads environment variables, not this file directly. The app binds only to localhost; MySQL is not exposed on a host port. Change the host port in `docker-compose.yml` if 8080 is already occupied.

```sh
docker compose stop       # Stop without deleting data
docker compose up -d      # Resume
```

## Existing LAMP / XAMPP setup

1. Use PHP 8.1+ with `pdo_mysql` and MySQL 8+. Enable Apache and MySQL.
2. Create a database and a dedicated account with SELECT and UPDATE privileges on it. Import the files in this order using an administrative database account:

   ```sh
   mysql -u root -p -e "CREATE DATABASE dashboard_builder CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
   mysql -u root -p dashboard_builder < database/schema.sql
   mysql -u root -p dashboard_builder < database/sample.sql
   ```

3. Set `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, and `DB_PASSWORD` in the Apache/PHP process environment. See `.env.example` for the variable names. The configured account must match the one you created.
4. Point Apache's document root at this project's **public/** directory, keeping `src/`, database scripts and configuration outside the web root. See `docker/apache.conf`.
5. Alternatively, after exporting those variables, run `php -S localhost:8080 -t public` for local development.

## Use the editor

- Click **Section**, **Text**, **Image**, **Bar chart**, or **Line chart** to add a block.
- Drag any block to move it. Drag its eight selection handles to resize it. Geometry stays inside its container.
- Select a section before adding a block to put the new block inside it. Use **Container** in the inspector to reparent an existing element. Sections are top-level; child positions are relative to their section. Moving, resizing, duplicating and deleting a section handles its children together.
- Double-click text or click **Edit text**. Select words and use **B / I** for rich formatting; use those buttons without a text selection to format the whole block. Font size and text color are editable in the inspector. Pasted text is plain text.
- Upload PNG/JPEG/WebP/GIF images (up to 2 MB each). Choose cover/contain and edit their accessible descriptions. Uploaded images are embedded in the layout JSON and stored in MySQL.
- Edit chart labels and values, then click **Apply data**, or click **Generate sample data**. Canvas graphs redraw dynamically from the data and on resize. Chart type and color are editable.
- Use **Layers** to select obscured elements and **Back / Front** to arrange overlapping siblings.
- **Preview** hides editor panels; desktop/mobile width controls and zoom let you inspect the fixed canvas. Smaller screens use a scaled canvas, scrollable panels and a floating inspector. This is a freeform layout, so mobile view scales the design rather than reflowing blocks.
- Save is explicit. Unsaved changes trigger a browser exit warning. Export downloads a JSON backup. Undo/redo covers layout, content, section children, styling and name changes.
- Shortcuts: Ctrl/⌘ S to save, Ctrl/⌘ Z to undo, Ctrl/⌘ Shift Z to redo, Ctrl/⌘ D to duplicate, Delete to remove, arrows to move (Shift = 10px), `/` to search. Shortcuts do not override normal typing.

Without a PHP/MySQL connection, the app clearly displays **Browser demo** and saves only to localStorage. `npm run preview` serves that demo. Browser demo data does not automatically overwrite database data when reconnecting.

## API

Single shared prototype dashboard, ID `1`:

| Request | Result |
| --- | --- |
| `GET /api/dashboard.php` | `{ dashboard: { id, name, layout, version, updated_at }, csrfToken }` |
| `PUT /api/dashboard.php` | JSON `{ name, layout, version }`; returns updated dashboard |

For PUT, send `Content-Type: application/json`, the `X-CSRF-Token` from GET, and the same session cookie. Save uses an atomic version check: a stale version receives **409**, preserving the newer save. Export local changes and reload to resolve a conflict. Errors use `{ "error": "message" }` with 400/403/405/413/415/422/503 as appropriate. Limit: 150 elements and 7 MB per layout.

The layout contains canvas dimensions/background and ordered elements with ID, type, parent ID, position, dimensions, colors, radius, font size and typed content. Text is stored as text runs with boolean bold/italic flags, never arbitrary HTML. Images are validated raster data URLs. Charts contain labels, numeric values and an accent color.

## Structure and checks

```text
public/                 Apache document root
  index.html            Editor shell
  assets/               UI, model, canvas charts, styles and sample layout
  api/dashboard.php     HTTP controller and session/CSRF handling
src/                    Strict layout validation and PDO repository
database/              SQL schema and seeded dashboard
tests/                 Model and API integration tests
```

```sh
npm test
python3 tests/api_test.py                 # Requires running LAMP stack
# Optional alternate port:
python3 tests/api_test.py http://localhost:8081
```

Model tests cover bounds, section containment, duplication independence, cascading removal and valid sample geometry. API tests cover persistence, UTF-8 content, validation, CSRF, unsupported methods and version conflicts; they restore the original dashboard. Run integration tests against a local test instance with no concurrent editor saves.

## Scope

This is an assignment prototype with one shared dashboard, explicit saves, and local undo history. It has no user authentication or authorization; deploy behind authentication before making it accessible beyond a trusted local environment. It uses prepared PDO statements, server-side validation, CSRF protection, safe text rendering, request size limits and optimistic concurrency. The optional Google Fonts stylesheet falls back to system fonts when offline. No third-party JavaScript is loaded.
