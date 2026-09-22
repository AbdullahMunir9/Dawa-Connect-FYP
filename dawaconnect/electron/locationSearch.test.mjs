import test from 'node:test'
import assert from 'node:assert/strict'
import { createLocationService, validatePoint, addressFromResult } from './locationSearch.mjs'

const place = { country_code: 'pk', lat: 31.51, lon: 74.34, formatted: 'Liberty Market, Lahore, Punjab, Pakistan', suburb: 'Gulberg', city: 'Lahore', state: 'Punjab' }
function fixture() {
  let time = 10000
  const requests = []
  const service = createLocationService({
    apiKey: () => 'test-key', now: () => time,
    fetcher: async (url) => { requests.push(url); return { ok: true, json: async () => ({ results: [place] }) } }
  })
  return { service, requests, tick: (amount = 1001) => { time += amount } }
}

test('rejects missing, string and out-of-range coordinates without converting null to zero', () => {
  for (const latitude of [null, undefined, '', '31', NaN, Infinity, 91]) {
    assert.throws(() => validatePoint({ latitude, longitude: 74 }), /valid point/)
  }
  assert.throws(() => validatePoint({ latitude: 31, longitude: -181 }), /valid point/)
  assert.deepEqual(validatePoint({ latitude: 0, longitude: 0 }), { latitude: 0, longitude: 0 })
})

test('requires search and confirmation; persists selected point rather than reverse-result coordinates', async () => {
  const { service, requests, tick } = fixture()
  assert.throws(() => service.registrationPayload(1, {}), /Step 2/)
  await assert.rejects(service.confirm(1, { latitude: 31, longitude: 74 }), /Search/)
  tick()
  const results = await service.search(1, 'Liberty Market Lahore')
  assert.equal(results.length, 1)
  assert.equal(requests[0].searchParams.get('filter'), 'countrycode:pk')
  assert.throws(() => service.registrationPayload(1, {}), /Step 2/)
  tick()
  const selected = { latitude: 31.512345, longitude: 74.341234 }
  const confirmed = await service.confirm(1, selected)
  assert.equal(requests[1].searchParams.get('lat'), String(selected.latitude))
  assert.equal(confirmed.latitude, selected.latitude)
  assert.equal(confirmed.longitude, selected.longitude)
  const payload = service.registrationPayload(1, { ...confirmed, addressLine1: 'Forged address', pharmacyName: 'Test' })
  assert.equal(payload.addressLine1, place.formatted)
  assert.equal(payload.pharmacyName, 'Test')
  assert.equal('locationConfirmation' in payload, false)
  assert.throws(() => service.registrationPayload(2, confirmed), /Step 2/)
  assert.throws(() => service.registrationPayload(1, { ...confirmed, longitude: 75 }), /pin has changed/)
  tick(3600001)
  assert.throws(() => service.registrationPayload(1, confirmed), /Step 2/)
})

test('new searches invalidate confirmation and requests are throttled', async () => {
  const { service, tick } = fixture()
  await service.search(1, 'Lahore')
  await assert.rejects(service.search(1, 'Lahore'), /wait a moment/)
  tick()
  const confirmed = await service.confirm(1, { latitude: 31, longitude: 74 })
  tick()
  await service.search(1, 'Karachi')
  assert.throws(() => service.registrationPayload(1, confirmed), /Step 2/)
  service.clear(1)
  tick()
  await assert.rejects(service.confirm(1, { latitude: 31, longitude: 74 }), /Search/)
})

test('missing key, provider errors, network failures and malformed results fail safely', async () => {
  const missing = createLocationService({ apiKey: () => '' })
  await assert.rejects(missing.search(1, 'Lahore'), /GEOAPIFY_API_KEY/)
  for (const status of [401, 403, 429, 500]) {
    const service = createLocationService({ apiKey: () => 'private', fetcher: async () => ({ ok: false, status }) })
    await assert.rejects(service.search(1, 'Lahore'), (error) => !error.message.includes('private'))
  }
  const offline = createLocationService({ apiKey: () => 'private', fetcher: async () => { throw new Error('private URL') } })
  await assert.rejects(offline.search(1, 'Lahore'), /could not be reached/)
  const malformed = createLocationService({ apiKey: () => 'private', fetcher: async () => ({ ok: true, json: async () => ({}) }) })
  await assert.rejects(malformed.search(1, 'Lahore'), /invalid response/)
})

test('missing locality names are not invented, foreign points rejected, empty searches return no places', async () => {
  assert.deepEqual(addressFromResult({ country_code: 'pk', formatted: 'Punjab, Pakistan' }), {
    addressLine1: 'Punjab, Pakistan', area: '', city: '', province: ''
  })
  assert.throws(() => addressFromResult({ ...place, country_code: 'us' }), /Pakistan/)
  const empty = createLocationService({ apiKey: () => 'test', fetcher: async () => ({ ok: true, json: async () => ({ results: [] }) }) })
  assert.deepEqual(await empty.search(1, 'Unknown landmark'), [])
})
