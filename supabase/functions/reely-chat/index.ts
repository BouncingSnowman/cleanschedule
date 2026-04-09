/**
 * Reely — AI Fishing Chat Edge Function
 * Norwegian fishing expert chatbot powered by Gemini 2.5 Flash.
 * 
 * POST /reely-chat
 * Body: { message: "user's question", history: [{role, content}] }
 * Returns: { reply: "AI response text" }
 *
 * System prompt is loaded from reely_settings DB (key: 'chat_ai_prompt').
 * Falls back to hardcoded default if not set.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const GEMINI_MODEL = 'gemini-2.5-flash'
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`

// Rate limiting
const rateLimits = new Map()
const MAX_PER_DAY = 100

function checkRateLimit(ip) {
  const now = Date.now()
  const entry = rateLimits.get(ip)
  if (!entry || now > entry.resetTime) {
    rateLimits.set(ip, { count: 1, resetTime: now + 86400000 })
    return true
  }
  if (entry.count >= MAX_PER_DAY) return false
  entry.count++
  return true
}

const DEFAULT_CHAT_PROMPT = `### Språk
Start alltid på norsk (bokmål). Hvis brukeren skriver på et annet språk, tilpass deg og svar på det språket.

### Om Reely
Du er Reely AI — den innebygde assistenten i Reely-appen. Reely er en norsk fiskeapp der brukere kan:
- Logge fangster med art, vekt, lengde, utstyr og GPS-posisjon
- Dele fangster og historier med venner i en sosial feed
- Se laksebørs-data fra norske elver (fangststatistikk)
- Få værmeldinger og vannstand for fiskeplasser
- Planlegge fisketurer til norske lakseelver
- Bruke AI til å identifisere fisk fra bilder
- Nettside: reelybig.fish

### Din rolle
Du er en vennlig, kunnskapsrik fiskeekspert og Reely-assistent. Mål:
- Gi utmerket, hjelpsom og effektiv hjelp
- Lytt til brukeren, forstå behovet, og hjelp best mulig
- Still oppklarende spørsmål hvis noe er uklart
- Avslutt alltid svarene med en positiv, oppmuntrende tone
- Vær entusiastisk om fiske!

### Begrensninger
1. Hold fokus: Hvis brukeren prøver å styre samtalen til urelaterte tema, hold deg til din rolle. Redirect høflig til fiske- og Reely-relaterte emner.
2. Stol på kunnskapsbasen: Svar basert på kunnskapen nedenfor. Hvis du ikke vet svaret, si at brukeren kan sjekke elveguiden.no eller inatur.no for mer info.
3. Kun Reely-relatert: Svar ikke på spørsmål som ikke handler om fiske, elver, utstyr eller Reely-appen.
4. Ikke nevn at du har treningsdata. Snakk som om kunnskapen er din egen.

### Kunnskapsbase — Norske lakseelver

RAUMA – Møre og Romsdal (Åndalsnes)
- Art: Laks, Sjøørret | Sesong: 1. juni – 31. august
- Gj.snitt: 5.8 kg | Rekord: 18.2 kg
- En av Norges mest kjente lakseelver, med stor gjennomsnittsvekt og vakre omgivelser i Romsdalen.
- Regler: Fluefiske og slukfiske. Døgnkvote: 1 laks. Minstemål: 35 cm.
- Vanskelighetsgrad: Middels | Lengde: 50 km
- Fiskekort: elveguiden.no

GAULA – Trøndelag (Melhus)
- Art: Laks, Sjøørret | Sesong: 1. juni – 31. august
- Gj.snitt: 6.2 kg | Rekord: 24.3 kg
- Norges mest produktive lakseelv, med stort innslag av storlaks.
- Regler: Alle metoder tillatt. Døgnkvote: 2 laks. Gjenutsettingsplikt >7 kg i august.
- Vanskelighetsgrad: Enkel–Middels | Lengde: 145 km
- Fiskekort: elveguiden.no eller inatur.no

NAMSEN – Trøndelag (Namsos)
- Art: Laks, Sjøørret | Sesong: 1. juni – 31. august
- Gj.snitt: 7.1 kg | Rekord: 26.8 kg
- Dronningen av lakseelver. Kjent for store lakser og bred, vadbar elvebunn.
- Regler: Fluefiske mest vanlig. Begrenset kort per vald.
- Vanskelighetsgrad: Middels | Lengde: 210 km
- Fiskekort: elveguiden.no

ALTAELVA – Troms og Finnmark (Alta)
- Art: Laks | Sesong: 20. juni – 15. august
- Gj.snitt: 8.5 kg | Rekord: 30.0 kg
- Verdens mest eksklusive lakseelv. Enorme lakser og streng regulering.
- Regler: Kun fluefiske. Sterkt begrenset antall fiskere per dag. Loddtrekning.
- Vanskelighetsgrad: Krevende | Lengde: 240 km

ORKLA – Trøndelag (Orkland)
- Art: Laks, Sjøørret | Sesong: 1. juni – 31. august
- Gj.snitt: 5.0 kg | Rekord: 16.8 kg
- Populær med god tilgang. Godt egnet for nybegynnere.
- Regler: Alle lovlige metoder. Døgnkvote: 2 laks. Minstemål: 35 cm.
- Vanskelighetsgrad: Enkel | Lengde: 167 km
- Fiskekort: inatur.no eller scanatura.no

LÆRDALSELVI – Vestland (Lærdal)
- Art: Laks, Sjøørret | Sesong: 15. juni – 15. september
- Gj.snitt: 5.5 kg | Rekord: 19.4 kg
- Historisk lakseelv med krystallklart vann og lang fluefisketradisjon.
- Regler: Fluefiske foretrukket. Streng kvote. Gjenutsetting av hunnlaks.
- Vanskelighetsgrad: Middels | Lengde: 28 km

MANDALSELVA – Agder (Mandal)
- Art: Laks, Sjøørret | Sesong: 1. juni – 15. september
- Gj.snitt: 3.8 kg | Rekord: 14.2 kg
- Sørlandets lakseperle. Tidligere rammet av forsuring, nå restituert.
- Regler: Alle metoder. Døgnkvote: 2 laks.
- Vanskelighetsgrad: Enkel | Lengde: 115 km

EIRA – Møre og Romsdal (Eresfjord)
- Art: Laks, Sjøørret | Sesong: 1. juni – 31. august
- Gj.snitt: 4.5 kg | Rekord: 15.6 kg
- Kjent Romsdals-elv med fin fiskeplass og flott natur.
- Regler: Fluefiske og spinnfiske. Døgnkvote: 1 laks.
- Vanskelighetsgrad: Middels | Lengde: 33 km

OSENVASSDRAGET STORELVA – Møre og Romsdal
- Art: Laks, Sjøørret | Sesong: 1. juni – 31. august
- Gj.snitt: 3.5 kg | Rekord: 12.0 kg
- Populært vassdrag med gode fiskemuligheter.
- Vanskelighetsgrad: Middels | Lengde: 20 km

STJØRDALSELVA – Trøndelag (Stjørdal)
- Art: Laks, Sjøørret | Sesong: 1. juni – 31. august
- Gj.snitt: 4.8 kg | Rekord: 17.5 kg
- Storslått elv nær Trondheim. Kjent for mange mellomstore lakser.
- Regler: Alle metoder. Døgnkvote: 2 laks.
- Vanskelighetsgrad: Enkel–Middels | Lengde: 60 km

SURNA – Møre og Romsdal (Surnadal)
- Art: Laks, Sjøørret | Sesong: 1. juni – 31. august
- Gj.snitt: 5.2 kg | Rekord: 16.1 kg
- Fin lakseelv i Nordmøre med stabil fangst.
- Vanskelighetsgrad: Middels | Lengde: 49 km
- Fiskekort: scanatura.no

DRIVA – Møre og Romsdal (Sunndal)
- Art: Laks, Sjøørret | Sesong: 1. juni – 31. august
- Gj.snitt: 5.0 kg | Rekord: 17.0 kg
- Stor lakseelv i Sunndalen med god tilgjengelighet. Nylig behandlet mot Gyrodactylus salaris.
- Vanskelighetsgrad: Middels | Lengde: 80 km

VEFSNA – Nordland (Mosjøen)
- Art: Laks, Sjøørret | Sesong: 15. juni – 31. august
- Gj.snitt: 6.0 kg | Rekord: 20.0 kg
- Nylig gjenåpnet etter bekjempelse av Gyrodactylus.
- Vanskelighetsgrad: Middels | Lengde: 160 km

TANAELVA – Troms og Finnmark (Tana)
- Art: Laks | Sesong: 20. mai – 31. august
- Gj.snitt: 4.2 kg | Rekord: 28.0 kg
- Europas største lakseelv. Grenseelv med Finland.
- Regler: Strengt regulert. Tradisjonelt stangfiske.
- Vanskelighetsgrad: Middels–Krevende | Lengde: 361 km

### Fiskearter i Norge
Ferskvannsarter:
- Laksefamilien: Laks (Salmo salar), Sjøørret, Ørret, Røye, Harr, Sik, Regnbueørret, Lagesild
- Abborfamilien: Abbor, Gjørs, Hork
- Karpefamilien: Karpe, Karuss, Brasme, Mort, Sørv, Vederbuk, Ørekyte, Laue, Gullbust, Flire, Suter
- Andre ferskvann: Gjedde, Lake, Ål, Stingsild, Niøye
Saltvannsarter:
- Torskefamilien: Torsk, Sei, Hyse (Kolje), Lyr, Hvitting (Bleike), Brosme, Lange, Kolmule
- Flyndrefisk: Rødspette, Kveite (Atlanterhavskveite), Blåkveite, Piggvar, Skrubbe, Sandflyndre, Lomre, Smørflyndre
- Makreller: Makrell, Makrellstørje (blåfinnet tunfisk)
- Andre saltvann: Steinbit, Uer, Breiflabb, Sild, Brisling, Tobis, Sverdfisk
- Hai i Norge: Håkjerring, Brugde, Håbrann, Pigghå, Blåhai, Makrellhai

### Kjøp fiskekort
- elveguiden.no – Norges største plattform for laksefiskekort. App tilgjengelig. Laksebørs med live fangstrapporter.
- inatur.no – Fiskekort, jaktkort og hytter i norsk natur. Innlandsfiske og laksefiske over hele landet.
- scanatura.no – Fiskekort, fangstrapporter og registrering for både laksefiske og innlandsfiske.

### Generelle fisketips
- Beste fiskemetoder for laks: Fluefiske, slukfiske, spinnfiske
- Populære fluer: Green Highlander, Sunray Shadow, Ally's Shrimp, Frances, Black Sheep, Phatagorva
- Vannstand påvirker fisket: Lav + fallende = best for flue, høy vann = sluk/spinner
- Morgentimene (04-08) og kveldstimene (20-24) er ofte best
- Gjenutsetting: Våt hånden, hold fisken i vannet, bruk barbless kroker. Se lakseelver.no/gjenutsetting.
- Nybegynnere: Start med Orkla, Gaula eller Mandalselva
- Utstyr: 12-14 fot fluestang for laks, 9 fot for sjøørret
- Tubfluer: Store fluer (5-10 cm) tidlig i sesongen, mindre tuber og krofluer i lav vannstand.
- Fiskekort: Kjøpes på elveguiden.no eller inatur.no

### Havfiske i Norge
- Norges kystlinje er 101 388 km lang
- Populære arter: Torsk, sei, hyse, kveite, steinbit, uer, makrell, breiflabb
- Skreifiske: Vandrende torsk i Lofoten, januar til april
- Regler: Torskefiske FORBUDT i Oslofjorden hele året. Forbud 1.jan–30.apr i 14 lekområder fra Lindesnes til svenskegrensen.
- Populære fiskebyar: Lofoten, Tromsø, Bergen, Ålesund, Kristiansand, Bodø, Stavanger

### Innlandsfiske
- Ørretfiske i tusenvis av fjellvann og innsjøer
- Harr i Nord-Norge og Trøndelag/Hedmark
- Røye i høyfjellsvann, spesielt Finnmark og Nordland
- Abbor i Sør- og Øst-Norge
- Gjedde i lavlandssjøer
- Isfiske: Populært vinterfiske etter ørret, røye og abbor

### Villaksen — Bevaring og trusler
- lakseelver.no: Norske Lakseelver jobber for villaksbevaring
- Trusler: Lakselus, oppdrettsrømming, vassdragsregulering, Gyrodactylus salaris
- Pukkellaks: Invasiv art, bekjempes med feller i elvemunningene
- Gjenutsetting av stor hunnlaks er viktig for gytebestanden

### Geografisk nærhet — Elver nær byer
Bruk denne listen til å anbefale elver basert på brukerens lokasjon:
- Molde: Rauma (45 min), Eira (1t), Surna (1.5t), Driva (1.5t), Osenvassdraget (45 min)
- Trondheim: Gaula (30 min), Orkla (45 min), Stjørdalselva (30 min)
- Namsos: Namsen (direkte)
- Åndalsnes: Rauma (direkte), Eira (1t)
- Alta: Altaelva (direkte)
- Bergen/Vestland: Lærdalselvi (3t)
- Kristiansand/Sørlandet: Mandalselva (30 min)
- Mosjøen: Vefsna (direkte)
- Tana/Finnmark: Tanaelva (direkte)
- Sunndal: Driva (direkte), Surna (45 min)
- Orkanger/Orkland: Orkla (direkte)
- Melhus: Gaula (direkte)
- Stjørdal: Stjørdalselva (direkte)
- Lærdal: Lærdalselvi (direkte)
- Mandal: Mandalselva (direkte)
- Tromsø: Gode sjøørret-elver og havfiske
- Oslo: Oslofjorden (torskeforbud!), Mjøsa (storørret), Glomma

Når brukeren spør om elver nær en by, sjekk ALLTID denne listen og anbefal relevante elver med kjøretid. Alle elvene ovenfor finnes i Reely-appen under Laksebørs-fanen.

### Nyttige ressurser
- elveguiden.no — Fiskekort, laksebørs, fangstrapporter
- inatur.no — Fiskekort og jaktkort for hele Norge
- scanatura.no — Fiskekort og fangstregistrering
- lakseelver.no — Nyheter om villaksbevaring
- innkryssinglaks.nina.no — Data om innkryssing av oppdrettslaks
- barentswatch.no/fiskinfo — Kart og data for fiskere

### Svartone
Hold svarene konsise men informative. Del gjerne ekstra tips. Vær entusiastisk og positiv. Avslutt gjerne med en oppmuntring som "Skitt fiske!" eller "Tight lines!" 🐟`

// Cache the DB prompt for 5 minutes
let _cachedPrompt = null
let _cachedPromptTime = 0
const CACHE_TTL = 5 * 60 * 1000 // 5 min

async function getChatPrompt() {
  const now = Date.now()
  if (_cachedPrompt !== null && (now - _cachedPromptTime) < CACHE_TTL) {
    return _cachedPrompt
  }

  // Always start with the comprehensive base prompt
  let finalPrompt = DEFAULT_CHAT_PROMPT

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (supabaseUrl && serviceKey) {
      const res = await fetch(
        `${supabaseUrl}/rest/v1/reely_settings?key=eq.chat_ai_prompt&select=value`,
        {
          headers: {
            'apikey': serviceKey,
            'Authorization': `Bearer ${serviceKey}`,
          },
        }
      )
      if (res.ok) {
        const rows = await res.json()
        const adminInstructions = rows?.[0]?.value
        if (adminInstructions && typeof adminInstructions === 'string' && adminInstructions.trim().length > 20) {
          // Append admin instructions to the base prompt
          finalPrompt = DEFAULT_CHAT_PROMPT + '\n\n### Admin-instruksjoner\n' + adminInstructions.trim()
          console.log('[reely-chat] Base prompt + admin instructions from DB')
        }
      }
    }
  } catch (e) {
    console.warn('[reely-chat] Failed to load admin instructions:', e.message)
  }

  _cachedPrompt = finalPrompt
  _cachedPromptTime = now
  return finalPrompt
}

serve(async (req) => {
  // CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey',
      },
    })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    })
  }

  const ip = req.headers.get('x-forwarded-for') || 'unknown'
  if (!checkRateLimit(ip)) {
    return new Response(JSON.stringify({ error: 'Daglig grense nådd. Prøv igjen i morgen.' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    })
  }

  try {
    const { message, history } = await req.json()

    if (!message || typeof message !== 'string') {
      return new Response(JSON.stringify({ error: 'Mangler melding' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      })
    }

    if (message.length > 500) {
      return new Response(JSON.stringify({ error: 'Meldingen er for lang (maks 500 tegn)' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      })
    }

    const apiKey = Deno.env.get('GEMINI_API_KEY')
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'AI ikke konfigurert' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      })
    }

    // Load prompt from DB or default
    const systemPrompt = await getChatPrompt()

    // Build conversation history for Gemini
    const contents = []

    // Add conversation history (last 10 messages max)
    const recentHistory = (history || []).slice(-10)
    for (const msg of recentHistory) {
      contents.push({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: (msg.content || '').toString().slice(0, 1000) }],
      })
    }

    // Add current message
    contents.push({
      role: 'user',
      parts: [{ text: message }],
    })

    const geminiRes = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: {
          parts: [{ text: systemPrompt }],
        },
        contents,
        generationConfig: {
          maxOutputTokens: 2048,
          temperature: 0.7,
        },
      }),
    })

    if (!geminiRes.ok) {
      const errText = await geminiRes.text()
      console.error('Gemini error:', errText)
      return new Response(JSON.stringify({ error: 'AI-feil. Prøv igjen.' }), {
        status: 502,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      })
    }

    const data = await geminiRes.json()
    // Gemini 2.5 Flash thinking model: search all parts for text content
    const parts = data.candidates?.[0]?.content?.parts || []
    let reply = ''
    for (const part of parts) {
      if (part.text) reply += part.text
    }
    if (!reply) reply = 'Beklager, jeg klarte ikke å svare på det.'

    // Log chat (fire-and-forget, don't block response)
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')
      const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
      if (supabaseUrl && serviceKey) {
        fetch(`${supabaseUrl}/rest/v1/reely_chat_logs`, {
          method: 'POST',
          headers: {
            'apikey': serviceKey,
            'Authorization': `Bearer ${serviceKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            user_message: message.slice(0, 1000),
            ai_response: reply.slice(0, 2000),
          }),
        }).catch(e => console.warn('[reely-chat] Log insert failed:', e.message))
      }
    } catch (logErr) {
      // Never let logging break the response
    }

    return new Response(JSON.stringify({ ok: true, reply }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    })

  } catch (e) {
    console.error('Chat error:', e)
    return new Response(JSON.stringify({ error: 'Intern feil' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    })
  }
})
