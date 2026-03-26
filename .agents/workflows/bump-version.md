---
description: How to bump cache-busting version numbers across the project
---

# Veckoplan Version Bump

Veckoplan uses `?v=N` query parameters for cache-busting on CSS and JS files.

## Automated Bump Script

// turbo
Run the bump script from the project root:
```powershell
.\bump-versions.ps1
```

This automatically:
1. Finds the current max version number from `index.html`
2. Replaces ALL `?v=N` in `index.html` (CSS + script tags)
3. Replaces ALL `?v=N` in JS import statements inside `src/`
4. Reports which files were updated

## CRITICAL: Keep versions in sync

All references to the same file **must** use the same version number. A mismatch (e.g. `?v=3` in an import but `?v=8` in the script tag) causes the browser to load the module **twice** as two different URLs, creating duplicate instances with separate state. This breaks session management and data loading.

## Module dependency graph
```
index.html
├── supabase.js (imported by: main, auth, store, settings)
├── auth.js (imported by: main)
├── store.js (imported by: main, calendar, dashboard, employees, customers)
├── modals.js (imported by: calendar, employees, customers)
├── calendar.js (imported by: main)
├── dashboard.js (imported by: main)
├── employees.js (imported by: main)
├── customers.js (imported by: main)
├── settings.js (imported by: main)
└── main.js (entry point)
```
