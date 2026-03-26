---
description: How to deploy CleanSchedule changes to production
---

# CleanSchedule Deployment

CleanSchedule is developed in `h:\My Drive\ANTIGRAVITY\time-scheduler` but deployed via the `web-github` repo at `h:\My Drive\ANTIGRAVITY\web-github\cleanschedule\`.

**Live URL:** https://aliensector.net/cleanschedule/

## Steps

1. Make and test your changes in `h:\My Drive\ANTIGRAVITY\time-scheduler`

2. Bump cache-busting versions (`?v=N`) in `index.html` for any changed CSS/JS files. Also update matching `import` statements inside JS files (e.g. if `dashboard.js` changes, update both the `<script>` tag in `index.html` AND the `import` in `main.js`)

3. Copy changed files to the deployment folder:
```powershell
Copy-Item -Path "h:\My Drive\ANTIGRAVITY\time-scheduler\<file>" -Destination "h:\My Drive\ANTIGRAVITY\web-github\cleanschedule\<file>" -Force
```

4. Commit and push the `web-github` repo:
```powershell
cd "h:\My Drive\ANTIGRAVITY\web-github"
git add cleanschedule/
git commit -m "CleanSchedule: <description>"
git push origin main
```

5. Optionally also commit and push the source repo:
```powershell
cd "h:\My Drive\ANTIGRAVITY\time-scheduler"
git add -A
git commit -m "<description>"
git push origin main
```

## Important Notes

- The `cleanschedule` GitHub repo (`BouncingSnowman/cleanschedule`) is source control only — it does NOT deploy anywhere
- The actual deployment is through `BouncingSnowman/web` repo (GitHub Pages at aliensector.net)
- Always copy files to `web-github/cleanschedule/` and push that repo to deploy
