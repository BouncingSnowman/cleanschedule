/**
 * Reely — Weather Proxy Edge Function
 * Proxies MET Norway Locationforecast 2.0 for weather data.
 * 
 * GET /reely-weather?lat=62.567&lon=7.687
 * 
 * No API key needed — MET API is free but requires User-Agent header
 * which cannot be set from a browser (CORS restriction).
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const MET_BASE = 'https://api.met.no/weatherapi/locationforecast/2.0'
const USER_AGENT = 'Reely/1.0 github.com/BouncingSnowman/web'

serve(async (req) => {
  // CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    })
  }

  try {
    const url = new URL(req.url)
    const lat = url.searchParams.get('lat')
    const lon = url.searchParams.get('lon')

    if (!lat || !lon) {
      return jsonResponse({ ok: false, error: 'lat and lon parameters required' }, 400)
    }

    // Fetch compact forecast from MET
    const metUrl = `${MET_BASE}/compact?lat=${lat}&lon=${lon}`
    const res = await fetch(metUrl, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'application/json',
      },
    })

    if (!res.ok) {
      const errText = await res.text()
      return jsonResponse({ ok: false, error: `MET API error ${res.status}`, detail: errText }, 502)
    }

    const metData = await res.json()

    // Extract the next 5 days of daily summaries
    const timeseries = metData?.properties?.timeseries || []
    const dailyForecasts = extractDailyForecasts(timeseries)

    // Also return current conditions
    const current = timeseries[0]?.data?.instant?.details || {}
    const currentSymbol = timeseries[0]?.data?.next_1_hours?.summary?.symbol_code
      || timeseries[0]?.data?.next_6_hours?.summary?.symbol_code || 'cloudy'

    return jsonResponse({
      ok: true,
      current: {
        temp: current.air_temperature,
        wind: current.wind_speed,
        humidity: current.relative_humidity,
        pressure: current.air_pressure_at_sea_level,
        symbol: currentSymbol,
      },
      forecast: dailyForecasts,
      source: 'MET Norway (Yr)',
      license: 'CC BY 4.0',
    })

  } catch (e) {
    console.error('[reely-weather] Error:', e)
    return jsonResponse({ ok: false, error: String(e) }, 500)
  }
})

function extractDailyForecasts(timeseries) {
  const days = {}

  for (const entry of timeseries) {
    const date = entry.time.split('T')[0]
    const hour = parseInt(entry.time.split('T')[1].split(':')[0])
    const details = entry.data?.instant?.details || {}
    const symbol = entry.data?.next_6_hours?.summary?.symbol_code
      || entry.data?.next_1_hours?.summary?.symbol_code

    if (!days[date]) {
      days[date] = { date, temps: [], winds: [], symbols: [], precipitation: 0 }
    }

    days[date].temps.push(details.air_temperature)
    days[date].winds.push(details.wind_speed)
    if (symbol && hour >= 6 && hour <= 18) {
      days[date].symbols.push(symbol)
    }

    // Accumulate precipitation
    const precip = entry.data?.next_6_hours?.details?.precipitation_amount
      || entry.data?.next_1_hours?.details?.precipitation_amount || 0
    if (hour === 6 || hour === 12 || hour === 18) {
      days[date].precipitation += precip
    }
  }

  // Convert to array, take first 5 days
  return Object.values(days).slice(0, 5).map(day => ({
    date: day.date,
    tempHigh: Math.round(Math.max(...day.temps.filter(t => t != null)) * 10) / 10,
    tempLow: Math.round(Math.min(...day.temps.filter(t => t != null)) * 10) / 10,
    windAvg: Math.round(day.winds.reduce((a, b) => a + b, 0) / day.winds.length * 10) / 10,
    windMax: Math.round(Math.max(...day.winds) * 10) / 10,
    symbol: mostCommon(day.symbols) || 'cloudy',
    precipitation: Math.round(day.precipitation * 10) / 10,
  }))
}

function mostCommon(arr) {
  if (!arr.length) return null
  const counts = {}
  arr.forEach(s => counts[s] = (counts[s] || 0) + 1)
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=1800', // 30 min cache
    },
  })
}
