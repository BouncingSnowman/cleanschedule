---
description: How to bump cache-busting version numbers across the project
---

# CleanSchedule Version Bump

CleanSchedule uses `?v=N` query parameters for cache-busting on CSS and JS files.

## What to bump

When you change a file, you need to bump its version in **all** places it's referenced:

### 1. `index.html` — `<link>` and `<script>` tags
```html
<link rel="stylesheet" href="css/style.css?v=N">
<script type="module" src="src/main.js?v=N"></script>
<script type="module" src="src/dashboard.js?v=N"></script>
<!-- etc -->
```

### 2. ES module `import` statements inside JS files
If you change `dashboard.js`, you must also update the import in `main.js`:
```javascript
import { initDashboard, renderDashboard } from './dashboard.js?v=N';
```

Similarly for other modules — check `main.js` imports and any cross-imports between:
- `store.js` (imported by calendar, dashboard, employees, customers)
- `modals.js` (imported by calendar)
- `calendar.js` (imported by main)
- `dashboard.js` (imported by main)
- `employees.js` (imported by main)
- `customers.js` (imported by main)
- `supabase.js` (imported by main, auth, store)
- `auth.js` (imported by main)

### 3. Keep versions in sync
All references to the same file must use the same version number. A mismatch (e.g. `?v=3` in an import but `?v=5` in the script tag) causes the browser to load the module twice as two different URLs.
