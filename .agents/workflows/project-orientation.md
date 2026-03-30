---
description: Project orientation for CleanSchedule (Veckoplan) - read this first to understand the codebase
---

# CleanSchedule (Veckoplan) — Project Orientation

A scheduling app for cleaning companies. Swedish UI. Built with vanilla JS + Supabase.

## Directory Layout

```
H:\My Drive\ANTIGRAVITY\time-scheduler\    ← SOURCE / DEV (git repo: BouncingSnowman/cleanschedule)
├── index.html              ← Single-page app (all views in one HTML file)
├── bump-versions.ps1       ← Auto-bumps all ?v= version numbers
├── sw.js                   ← Service worker (PWA)
├── manifest.json           ← PWA manifest
├── css/
│   └── style.css           ← All styles (51KB)
├── src/                    ← All JS modules (vanilla ES modules)
│   ├── main.js             ← Entry point, view routing, sidebar, theme toggle
│   ├── supabase.js         ← Supabase client, auth helpers, CRUD operations
│   ├── auth.js             ← Login/signup UI (Google OAuth + email)
│   ├── store.js            ← Data layer — loads/caches all data, export/import
│   ├── calendar.js         ← Weekly schedule grid + day timeline view
│   ├── dashboard.js        ← Overview cards (today's jobs, stats)
│   ├── employees.js        ← Employee management (CRUD, color assignment)
│   ├── customers.js        ← Customer management (CRUD, CSV import)
│   ├── settings.js         ← Settings view (push notifications, preferences)
│   ├── modals.js           ← Shared modal dialog system
│   ├── my-schedule.js      ← Employee self-service "Mitt Schema" view
│   └── ics.js              ← ICS calendar export
├── sql/                    ← Supabase SQL migrations/policies (reference only)
│   ├── migration.sql       ← Core schema
│   ├── employee-access.sql ← RLS policies for employee portal
│   ├── shared-access.sql   ← Shared access policies
│   └── push-subscriptions.sql ← Push notification tables
└── supabase/
    └── functions/
        └── send-push/      ← Edge Function for push notifications
```

## Deployment

- **Source repo**: `BouncingSnowman/cleanschedule` (source control only, does NOT deploy)
- **Deployed via**: `H:\My Drive\ANTIGRAVITY\web-github\cleanschedule\` → `BouncingSnowman/web` (GitHub Pages)
- **Live URL**: https://aliensector.net/cleanschedule/
- **Deploy workflow**: `/deploy`

## Tech Stack

- **Vanilla JS** — ES modules, no build tools, no npm
- **Supabase** — Auth (Google OAuth), PostgreSQL database, RLS, Edge Functions
- **PWA** — Service worker + manifest for installability
- **Inter font** — via Google Fonts

## Architecture Overview

| Module | Responsibility |
|--------|---------------|
| `main.js` | Boot, auth flow, view switching, sidebar, theme, mobile menu |
| `supabase.js` | Supabase client init, session management, all DB queries |
| `auth.js` | Login/signup UI rendering, OAuth redirect handling |
| `store.js` | In-memory data cache, loads employees/customers/jobs, export/import |
| `calendar.js` | Week grid rendering, job cards, drag-and-drop, day timeline |
| `dashboard.js` | Overview stats, today's schedule, weekly summary |
| `employees.js` | Employee list, add/edit/delete, color assignment |
| `customers.js` | Customer list, add/edit/delete, CSV import from Spiris |
| `settings.js` | Push notification subscription, calendar export prefs |
| `modals.js` | Reusable modal dialog (shared by calendar, employees, customers) |
| `my-schedule.js` | Read-only employee view — shows only their assigned jobs |
| `ics.js` | Generates .ics calendar files for week export |

## Module Dependency Graph

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
├── my-schedule.js (imported by: main — indirect via nav)
├── ics.js (imported by: calendar, my-schedule)
└── main.js (entry point)
```

## App Views (Swedish UI)

| View | Nav Label | Description |
|------|-----------|-------------|
| Dashboard | Översikt | Stats cards, today's jobs |
| Schedule | Schema | Week grid with employee rows, drag-and-drop jobs |
| Unscheduled | Oplanerade | Side panel on schedule view — jobs not yet assigned to a day |
| My Schedule | Mitt Schema | Employee self-service — read-only view of own jobs |
| Employees | Anställda | Manage employees (name, email, phone, color) |
| Customers | Kunder | Manage customers (name, address, notes, recurring jobs) |
| Settings | Inställningar | Push notifications, export preferences |

## Common Gotchas

See `/learning` workflow for the full list. Key ones:

- **Module version mismatch is critical**: If `store.js?v=8` imports `supabase.js?v=3`, the browser creates *two separate module instances* → session is lost. Always keep all `?v=N` in sync. Run `bump-versions.ps1`.
- **PowerShell encoding**: Same as Alien Sector — never use `Get-Content`/`Set-Content` on source files.
- **Deploy target**: The `cleanschedule` GitHub repo is source-only. Actual deployment is through `web-github/cleanschedule/` → `BouncingSnowman/web`.
- **Supabase Edge Functions (Deno)**: PKCS8 key import doesn't work — use JWK. Deno returns raw ECDSA signatures, not DER.
- **Push notifications**: Subscriptions expire (410 Gone) — old ones should be cleaned from DB.
