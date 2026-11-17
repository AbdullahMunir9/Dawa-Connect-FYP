import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { adminPermissions, canManageMedicineCatalog } from './adminPermissions.js';
import { normalizeAdminProfileName } from './adminProfile.js';

test('super admins always manage the medicine catalogue', () => {
  const admin = { role: 'superadmin', permissions: { manageMedicineCatalog: false } };
  assert.equal(canManageMedicineCatalog(admin), true);
  assert.deepEqual(adminPermissions(admin), { manageMedicineCatalog: true });
});

test('ordinary admins are denied by default and when explicitly revoked', () => {
  assert.equal(canManageMedicineCatalog({ role: 'admin' }), false);
  assert.equal(canManageMedicineCatalog({ role: 'admin', permissions: { manageMedicineCatalog: false } }), false);
});

test('ordinary admins can manage the catalogue after access is granted', () => {
  const admin = { role: 'admin', permissions: { manageMedicineCatalog: true } };
  assert.equal(canManageMedicineCatalog(admin), true);
  assert.deepEqual(adminPermissions(admin), { manageMedicineCatalog: true });
});

test('every medicine catalogue write route uses the catalogue permission gate', async () => {
  const source = await readFile(new URL('../routes/medicineCatalogRoutes.js', import.meta.url), 'utf8');
  const protectedWrites = [
    "router.post('/import-csv', requireMedicineCatalogWrite",
    "router.post('/', requireMedicineCatalogWrite",
    "router.patch('/:id', requireMedicineCatalogWrite",
    "router.post('/:id/image', requireMedicineCatalogWrite",
    "router.post('/:id/image/import', requireMedicineCatalogWrite",
    "router.delete('/:id/image', requireMedicineCatalogWrite",
  ];

  for (const signature of protectedWrites) {
    assert.ok(source.includes(signature), `Missing permission gate: ${signature}`);
  }
  assert.equal((source.match(/requireMedicineCatalogWrite/g) || []).length, protectedWrites.length + 1);
});

test('admin profile names are trimmed and constrained to 2-80 characters', () => {
  assert.equal(normalizeAdminProfileName('  Ahtisham Admin  '), 'Ahtisham Admin');
  assert.throws(() => normalizeAdminProfileName('A'), /2-80 characters/);
  assert.throws(() => normalizeAdminProfileName('x'.repeat(81)), /2-80 characters/);
});

test('catalogue write middleware returns 403 unless access is granted', async () => {
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-that-is-at-least-32-characters';
  const { requireMedicineCatalogWrite } = await import('../middleware/auth.js');

  function run(admin) {
    let status = null;
    let body = null;
    let nextCalled = false;
    const res = {
      status(value) { status = value; return this; },
      json(value) { body = value; return this; },
    };
    requireMedicineCatalogWrite({ admin }, res, () => { nextCalled = true; });
    return { status, body, nextCalled };
  }

  const denied = run({ role: 'admin', permissions: { manageMedicineCatalog: false } });
  assert.equal(denied.status, 403);
  assert.match(denied.body.message, /has not been granted/);
  assert.equal(denied.nextCalled, false);

  assert.equal(run({ role: 'admin', permissions: { manageMedicineCatalog: true } }).nextCalled, true);
  assert.equal(run({ role: 'superadmin', permissions: { manageMedicineCatalog: false } }).nextCalled, true);
});
