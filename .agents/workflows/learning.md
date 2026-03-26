---
description: Veckoplan (CleanSchedule) — Tekniska lärdomar och gotchas
---

# Veckoplan — Lessons Learned

## Deployment & Versionshantering
- **Module version mismatch är kritiskt**: Om `store.js?v=8` importerar `supabase.js?v=3` skapas *två separata modul-instanser* → sessionen tappas. Alla `?v=N` måste alltid vara synkade.
- **Kör alltid `bump-versions.ps1`** innan deploy. Scriptet uppdaterar alla JS/CSS-versionsnummer automatiskt.
- **Deploy-rutin**: Filer kopieras manuellt från `time-scheduler/` till `web-github/cleanschedule/` och pushas därifrån.
- **GitHub Pages cache**: Om ändringar inte syns efter deploy, verifiera att `index.html` har rätt `?v=N` och att filerna verkligen pushats.

## Supabase Edge Functions (Deno)
- **PKCS8 key import fungerar INTE i Deno** — `crypto.subtle.importKey('pkcs8', ...)` ger `InvalidEncoding` för EC P-256-nycklar. **Använd JWK-format istället**.
- **Deno returnerar raw ECDSA-signaturer** (64 bytes r||s), INTE DER-format. Konvertera inte med `derToRaw`.
- **Admin API (`/auth/v1/admin/users`) är opålitligt** för user-lookup i Edge Functions. Använd en **SQL RPC-funktion** med `SECURITY DEFINER` som gör JOIN direkt mot `auth.users`.
- **Supabase CLI finns inte som npm-paket** på detta system. Ladda ner `.tar.gz` från GitHub releases med `curl.exe`.
- **`--no-verify-jwt` krävs** vid deploy av Edge Functions som anropas utan auth-token (t.ex. från frontend).

## Push-notiser (Web Push)
- **Service Worker-scope** måste matcha sidan som registrerar den.
- **Push-prenumerationer förfaller** (410 Gone) — gamla prenumerationer bör rensas från databasen.
- **`push_subscriptions`-tabellen** måste ha alla kolumner innan INSERT, annars misslyckas hela operationen tyst (pga RLS + PostgREST error handling).
- **Email-matchning** krävs: anställdkortets email måste matcha inloggnings-emailen för att notiser ska triggas.

## CSS / Dark Mode
- **`color-scheme: dark`** behövs på form inputs i dark mode för att native datepicker/timepicker-ikoner ska synas.
