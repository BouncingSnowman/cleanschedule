/**
 * Veckoplan — send-push Edge Function
 *
 * Sends push notifications to subscribed users.
 *
 * POST /send-push
 * Body:
 *   { type: 'assigned' | 'unscheduled', employee_email: string, title: string, body: string }
 *
 * Environment variables:
 *   VAPID_PRIVATE_KEY — base64url-encoded ECDSA P-256 private key
 *   SUPABASE_URL — automatically set
 *   SUPABASE_SERVICE_ROLE_KEY — automatically set
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const VAPID_SUBJECT = 'mailto:ingeholberg@gmail.com'
const VAPID_PUBLIC_KEY = 'BJC_-JfmMRGUnnkfibR52IGARups1q-t-jOGLee8FoA8G_oHH-v9QNf3PrqGrmz_gVWCLAzwSZN8A1gd72q4E_c'

serve(async (req) => {
  // CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    })
  }

  try {
    const { type, employee_email, title, body: msgBody } = await req.json()

    const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')!
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // 1. Look up the user by employee email
    // Find auth user whose email matches the employee
    const usersRes = await fetch(
      `${SUPABASE_URL}/auth/v1/admin/users`,
      {
        headers: {
          'apikey': SUPABASE_SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
      }
    )
    const usersData = await usersRes.json()
    const matchingUser = usersData.users?.find(
      (u: any) => u.email?.toLowerCase() === employee_email?.toLowerCase()
    )

    if (!matchingUser) {
      return jsonResponse({ ok: false, error: 'No user found for email' }, 404)
    }

    // 2. Get push subscriptions for this user
    const field = type === 'assigned' ? 'notify_assigned' : 'notify_unscheduled'
    const subsRes = await fetch(
      `${SUPABASE_URL}/rest/v1/push_subscriptions?user_id=eq.${matchingUser.id}&${field}=eq.true`,
      {
        headers: {
          'apikey': SUPABASE_SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
      }
    )
    const subscriptions = await subsRes.json()

    if (!subscriptions?.length) {
      return jsonResponse({ ok: true, sent: 0, reason: 'No subscriptions' })
    }

    // 3. Send push to each subscription
    let sent = 0
    for (const sub of subscriptions) {
      try {
        await sendWebPush(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.keys_p256dh, auth: sub.keys_auth },
          },
          JSON.stringify({ title: title || 'Veckoplan', body: msgBody || '' }),
          VAPID_PRIVATE_KEY
        )
        sent++
      } catch (e) {
        console.error('Push send error:', e)
      }
    }

    return jsonResponse({ ok: true, sent })
  } catch (e) {
    console.error('Error:', e)
    return jsonResponse({ ok: false, error: String(e) }, 500)
  }
})

function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  })
}

// --- Web Push Implementation (RFC 8291 / RFC 8188) ---

async function sendWebPush(
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
  payload: string,
  vapidPrivateKeyB64: string
) {
  // Generate VAPID JWT
  const vapidHeaders = await generateVapidHeaders(
    subscription.endpoint,
    vapidPrivateKeyB64
  )

  // Encrypt payload using RFC 8291
  const encrypted = await encryptPayload(
    payload,
    subscription.keys.p256dh,
    subscription.keys.auth
  )

  // Send to push service
  const res = await fetch(subscription.endpoint, {
    method: 'POST',
    headers: {
      'Authorization': vapidHeaders.authorization,
      'TTL': '86400',
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      'Urgency': 'normal',
    },
    body: encrypted,
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Push failed: ${res.status} ${text}`)
  }
}

async function generateVapidHeaders(endpoint: string, privateKeyB64: string) {
  const audience = new URL(endpoint).origin
  const now = Math.floor(Date.now() / 1000)

  const header = { typ: 'JWT', alg: 'ES256' }
  const claims = {
    aud: audience,
    exp: now + 86400,
    sub: VAPID_SUBJECT,
  }

  const headerB64 = b64urlEncode(new TextEncoder().encode(JSON.stringify(header)))
  const claimsB64 = b64urlEncode(new TextEncoder().encode(JSON.stringify(claims)))
  const unsignedToken = `${headerB64}.${claimsB64}`

  // Import private key
  const privateKeyBytes = b64urlDecode(privateKeyB64)
  const keyData = await crypto.subtle.importKey(
    'pkcs8',
    buildPkcs8(privateKeyBytes),
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  )

  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    keyData,
    new TextEncoder().encode(unsignedToken)
  )

  // Convert DER signature to raw r||s format
  const rawSig = derToRaw(new Uint8Array(signature))
  const sigB64 = b64urlEncode(rawSig)
  const jwt = `${unsignedToken}.${sigB64}`

  return {
    authorization: `vapid t=${jwt}, k=${VAPID_PUBLIC_KEY}`,
  }
}

async function encryptPayload(
  payload: string,
  clientPubB64: string,
  clientAuthB64: string
) {
  const clientPubKey = b64urlDecode(clientPubB64)
  const clientAuth = b64urlDecode(clientAuthB64)

  // Generate ephemeral ECDH key pair
  const localKeyPair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveBits']
  )

  // Export local public key (uncompressed)
  const localPubKeyRaw = new Uint8Array(
    await crypto.subtle.exportKey('raw', localKeyPair.publicKey)
  )

  // Import client public key
  const clientKey = await crypto.subtle.importKey(
    'raw',
    clientPubKey,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    []
  )

  // Derive shared secret
  const sharedSecret = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: 'ECDH', public: clientKey },
      localKeyPair.privateKey,
      256
    )
  )

  // Derive encryption key using HKDF (RFC 8291)
  const salt = crypto.getRandomValues(new Uint8Array(16))

  // PRK = HKDF-Extract(clientAuth, sharedSecret)
  const prkKey = await crypto.subtle.importKey(
    'raw', clientAuth, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  )
  const prk = new Uint8Array(await crypto.subtle.sign('HMAC', prkKey, sharedSecret))

  // IKM info = "WebPush: info\0" + clientPubKey + localPubKey
  const infoPrefix = new TextEncoder().encode('WebPush: info\0')
  const ikmInfo = concatBytes(infoPrefix, clientPubKey, localPubKeyRaw)
  const ikm = await hkdfExpand(prk, ikmInfo, 32)

  // Content encryption key
  const cekInfo = new TextEncoder().encode('Content-Encoding: aes128gcm\0')
  const prkCek = await hkdfExtract(salt, ikm)
  const cek = await hkdfExpand(prkCek, cekInfo, 16)

  // Nonce
  const nonceInfo = new TextEncoder().encode('Content-Encoding: nonce\0')
  const nonce = await hkdfExpand(prkCek, nonceInfo, 12)

  // Encrypt with AES-128-GCM
  const encKey = await crypto.subtle.importKey(
    'raw', cek, { name: 'AES-GCM' }, false, ['encrypt']
  )

  // Pad payload (RFC 8188: delimiter byte \x02 then padding)
  const payloadBytes = new TextEncoder().encode(payload)
  const padded = new Uint8Array(payloadBytes.length + 1)
  padded.set(payloadBytes)
  padded[payloadBytes.length] = 2 // delimiter

  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: nonce, tagLength: 128 },
      encKey,
      padded
    )
  )

  // Build aes128gcm header: salt(16) + rs(4) + idlen(1) + keyid(65) + ciphertext
  const rs = 4096
  const header = new Uint8Array(16 + 4 + 1 + localPubKeyRaw.length)
  header.set(salt, 0)
  new DataView(header.buffer).setUint32(16, rs)
  header[20] = localPubKeyRaw.length
  header.set(localPubKeyRaw, 21)

  return concatBytes(header, ciphertext)
}

// --- Crypto Helpers ---

function b64urlEncode(bytes: Uint8Array): string {
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function b64urlDecode(str: string): Uint8Array {
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/') + '=='.slice(0, (4 - str.length % 4) % 4)
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function concatBytes(...arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((s, a) => s + a.length, 0)
  const result = new Uint8Array(total)
  let offset = 0
  for (const arr of arrays) { result.set(arr, offset); offset += arr.length }
  return result
}

async function hkdfExtract(salt: Uint8Array, ikm: Uint8Array): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw', salt, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  )
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, ikm))
}

async function hkdfExpand(prk: Uint8Array, info: Uint8Array, length: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw', prk, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  )
  const infoWithCounter = concatBytes(info, new Uint8Array([1]))
  const okm = new Uint8Array(await crypto.subtle.sign('HMAC', key, infoWithCounter))
  return okm.slice(0, length)
}

// Build PKCS8 wrapper for a raw 32-byte EC private key
function buildPkcs8(rawKey: Uint8Array): Uint8Array {
  // PKCS8 prefix for P-256 ECDSA key
  const prefix = new Uint8Array([
    0x30, 0x41, 0x02, 0x01, 0x00, 0x30, 0x13, 0x06,
    0x07, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02, 0x01,
    0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03,
    0x01, 0x07, 0x04, 0x27, 0x30, 0x25, 0x02, 0x01,
    0x01, 0x04, 0x20,
  ])
  return concatBytes(prefix, rawKey)
}

// Convert DER-encoded ECDSA signature to raw r||s (64 bytes)
function derToRaw(der: Uint8Array): Uint8Array {
  // DER: 0x30 <len> 0x02 <rlen> <r> 0x02 <slen> <s>
  let offset = 2 // skip 0x30 <len>
  // Read r
  offset++ // skip 0x02
  const rLen = der[offset++]
  const r = der.slice(offset, offset + rLen)
  offset += rLen
  // Read s
  offset++ // skip 0x02
  const sLen = der[offset++]
  const s = der.slice(offset, offset + sLen)

  // Pad/trim to 32 bytes each
  const raw = new Uint8Array(64)
  raw.set(r.length > 32 ? r.slice(r.length - 32) : r, 32 - Math.min(r.length, 32))
  raw.set(s.length > 32 ? s.slice(s.length - 32) : s, 64 - Math.min(s.length, 32))
  return raw
}
