/**
 * Reely — Water Data Proxy Edge Function
 * Proxies NVE HydAPI for river water level/discharge data.
 * 
 * GET /reely-water?stationId=12.209.0&parameter=1001&days=7
 * 
 * Environment variables:
 *   NVE_API_KEY — API key from hydapi.nve.no
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const NVE_BASE = 'https://hydapi.nve.no/api/v1'

// Map river names to NVE station IDs
// Parameter 1001 = discharge (vannføring) in m³/s
// Parameter 1000 = water stage (vannstand) in cm
const RIVER_STATIONS = {
  'rauma':        { id: '12.209.0', name: 'Rauma', parameter: '1001' },
  'gaula':        { id: '122.11.0', name: 'Gaula', parameter: '1001' },
  'namsen':       { id: '139.32.0', name: 'Namsen', parameter: '1001' },
  'orkla':        { id: '121.10.0', name: 'Orkla', parameter: '1001' },
  'eira':         { id: '103.1.0',  name: 'Eira', parameter: '1001' },
  'stjordalselva':{ id: '123.31.0', name: 'Stjørdalselva', parameter: '1001' },
  'surna':        { id: '112.8.0',  name: 'Surna', parameter: '1001' },
  'mandalselva':  { id: '22.4.0',   name: 'Mandalselva', parameter: '1001' },
  'laerdal':      { id: '73.2.0',   name: 'Lærdalselvi', parameter: '1001' },
  'alta':         { id: '212.10.0', name: 'Altaelva', parameter: '1001' },
  'vefsna':       { id: '151.16.0', name: 'Vefsna', parameter: '1001' },
  'tana':         { id: '234.18.0', name: 'Tanaelva', parameter: '1001' },
}

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
    const river = url.searchParams.get('river')?.toLowerCase()
    const days = parseInt(url.searchParams.get('days') || '7')

    const NVE_API_KEY = Deno.env.get('NVE_API_KEY')
    if (!NVE_API_KEY) {
      return jsonResponse({ ok: false, error: 'NVE_API_KEY not configured' }, 500)
    }

    // If a specific river is requested
    if (river && RIVER_STATIONS[river]) {
      const station = RIVER_STATIONS[river]
      const data = await fetchStationData(station.id, station.parameter, days, NVE_API_KEY)
      return jsonResponse({
        ok: true,
        river: station.name,
        stationId: station.id,
        data,
        source: 'NVE HydAPI',
        license: 'NLOD / CC BY 3.0',
      })
    }

    // If 'all' is requested — return current level for all rivers
    if (url.searchParams.get('all') === 'true') {
      const results = {}
      const promises = Object.entries(RIVER_STATIONS).map(async ([key, station]) => {
        try {
          const data = await fetchStationData(station.id, station.parameter, 1, NVE_API_KEY)
          const latest = data?.length > 0 ? data[data.length - 1] : null
          results[key] = {
            name: station.name,
            stationId: station.id,
            current: latest?.value || null,
            time: latest?.time || null,
          }
        } catch (e) {
          results[key] = { name: station.name, error: e.message }
        }
      })
      await Promise.all(promises)
      return jsonResponse({ ok: true, rivers: results, source: 'NVE HydAPI' })
    }

    // List available rivers
    return jsonResponse({
      ok: true,
      availableRivers: Object.entries(RIVER_STATIONS).map(([key, s]) => ({
        key, name: s.name, stationId: s.id
      })),
      usage: '?river=rauma&days=7 or ?all=true',
    })

  } catch (e) {
    console.error('[reely-water] Error:', e)
    return jsonResponse({ ok: false, error: String(e) }, 500)
  }
})

async function fetchStationData(stationId, parameter, days, apiKey) {
  const now = new Date()
  const from = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)

  const params = new URLSearchParams({
    StationId: stationId,
    Parameter: parameter,
    ResolutionTime: '60',  // Hourly resolution
    ReferenceTime: `${from.toISOString()}/${now.toISOString()}`,
  })

  const res = await fetch(`${NVE_BASE}/Observations?${params}`, {
    headers: {
      'X-API-Key': apiKey,
      'Accept': 'application/json',
    },
  })

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`NVE API error ${res.status}: ${errText}`)
  }

  const json = await res.json()

  // NVE returns { data: [{ observations: [{time, value, ...}] }] }
  const series = json?.data?.[0]
  if (!series?.observations) return []

  return series.observations.map(obs => ({
    time: obs.time,
    value: obs.value,
    quality: obs.quality,
  }))
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=900', // 15 min cache
    },
  })
}
