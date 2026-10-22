# Verification

Verified locally on 22 October 2026:

- Docker image built with PHP 8.3/Apache and pdo_mysql; MySQL 8.4 started healthy and loaded schema/sample data.
- Five Node model tests passed: bounds, section resize containment, independent duplication, cascading removal, sample geometry.
- API integration checks passed: load, save/reload, UTF-8 text, CSRF rejection, unsupported methods, malformed JSON, negative geometry, invalid parent references, invalid chart data, invalid image sources, stale-version conflicts and restoration.
- All three PHP files passed syntax checks; application and chart JavaScript passed syntax checks.
- Safari: visually inspected desktop editor and rendered charts; added a chart, regenerated data, changed width, saved and reloaded from MySQL; edited text and undid the edit; checked narrow-width preview and returned to desktop. Temporary test edits were removed and the sample restored.

Not exhaustively exercised in browser automation: file-picker uploads, every drag/resize handle, touch devices, all rich-text selection combinations, and other browser engines. These are implemented, but this is not a claim of full cross-browser coverage.
