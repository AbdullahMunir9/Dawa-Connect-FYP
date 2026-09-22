import { randomUUID } from 'node:crypto'

export function validatePoint(point) {
  if (typeof point?.latitude !== 'number' || !Number.isFinite(point.latitude) || Math.abs(point.latitude) > 90 ||
      typeof point?.longitude !== 'number' || !Number.isFinite(point.longitude) || Math.abs(point.longitude) > 180) {
    throw new Error('Select a valid point on the map.')
  }
  return { latitude: point.latitude, longitude: point.longitude }
}

export function addressFromResult(result) {
  if (result?.country_code !== 'pk') throw new Error('Please select a pharmacy location in Pakistan.')
  const address = {
    addressLine1: result.formatted || result.address_line1 || '',
    area: result.suburb || result.quarter || result.neighbourhood || result.district || '',
    city: result.city || result.town || result.village || result.municipality || '',
    province: result.state || ''
  }
  // Do not invent missing locality names or copy them from the searched landmark.
  if (!address.addressLine1) throw new Error('No address was found at this point. Adjust the pin and try again.')
  return address
}

export function createLocationService({ apiKey = () => process.env.GEOAPIFY_API_KEY, fetcher = fetch, now = Date.now } = {}) {
  const sessions = new Map()
  async function request(endpoint, params) {
    const key = apiKey()?.trim()
    if (!key) throw new Error('Address search is not configured. Add GEOAPIFY_API_KEY to the Pharmacy app .env and restart.')
    const url = new URL(`https://api.geoapify.com/v1/geocode/${endpoint}`)
    url.search = new URLSearchParams({ ...params, format: 'json', lang: 'en', apiKey: key }).toString()
    let response
    try {
      response = await fetcher(url, { signal: AbortSignal.timeout(12000) })
    } catch {
      throw new Error('The map address service could not be reached. Check your connection and try again.')
    }
    if (!response.ok) {
      if (response.status === 429) throw new Error('The map address service limit was reached. Please try again later.')
      if ([401, 403].includes(response.status)) throw new Error('The map address service key was rejected. Please check its configuration.')
      throw new Error('The map address service is unavailable. Please try again.')
    }
    try {
      const body = await response.json()
      if (!Array.isArray(body.results)) throw new Error()
      return body.results
    } catch {
      throw new Error('The map address service returned an invalid response. Please try again.')
    }
  }
  async function run(id, action) {
    const session = sessions.get(id) || { searched: false, busy: false, lastRequest: -Infinity }
    sessions.set(id, session)
    if (session.busy || now() - session.lastRequest < 1000) throw new Error('Please wait a moment before trying again.')
    session.busy = true
    session.lastRequest = now()
    try { return await action(session) } finally { session.busy = false }
  }
  return {
    search(id, text) {
      return run(id, async (session) => {
        if (typeof text !== 'string' || text.trim().length < 3 || text.length > 300) throw new Error('Enter an address or nearby landmark (3–300 characters).')
        session.confirmed = null
        session.searched = false
        const results = await request('search', { text: text.trim(), filter: 'countrycode:pk', limit: '5' })
        const places = results.filter((r) => r.country_code === 'pk' && Number.isFinite(r.lat) && Number.isFinite(r.lon))
          .map((r) => ({ label: r.formatted || r.address_line1, ...validatePoint({ latitude: r.lat, longitude: r.lon }) }))
          .filter((r) => r.label)
        session.searched = places.length > 0
        return places
      })
    },
    confirm(id, point) {
      return run(id, async (session) => {
        session.confirmed = null
        if (!session.searched) throw new Error('Search for your pharmacy address or a nearby landmark first.')
        const coordinates = validatePoint(point)
        const results = await request('reverse', { lat: String(coordinates.latitude), lon: String(coordinates.longitude), limit: '1' })
        if (!results.length) throw new Error('No address was found at this point. Adjust the pin and try again.')
        const data = { ...addressFromResult(results[0]), ...coordinates, locationConfirmation: randomUUID() }
        session.confirmed = { data, expires: now() + 60 * 60 * 1000 }
        return data
      })
    },
    registrationPayload(id, payload) {
      const confirmed = sessions.get(id)?.confirmed
      if (!confirmed || confirmed.expires < now() || confirmed.data.locationConfirmation !== payload?.locationConfirmation) {
        throw new Error('Go back to Step 2 and confirm the exact pharmacy location on the map.')
      }
      if (payload.latitude !== confirmed.data.latitude || payload.longitude !== confirmed.data.longitude) {
        throw new Error('The pharmacy pin has changed. Confirm its location again in Step 2.')
      }
      // The trusted process owns the address; ignore renderer-supplied address edits.
      const { locationConfirmation, ...data } = { ...payload, ...confirmed.data }
      return data
    },
    clear(id) { sessions.delete(id) }
  }
}
