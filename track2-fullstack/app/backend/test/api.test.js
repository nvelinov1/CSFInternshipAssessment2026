const { after, before, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'farmtracker-test-'));
process.env.FARMTRACKER_DB_PATH = path.join(tempDir, 'farmtracker.db');

const app = require('../server');
const { db } = require('../db');

let server;
let baseUrl;

before(async () => {
  seedTestData();
  server = await new Promise(resolve => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
  });
  baseUrl = `http://127.0.0.1:${server.address().port}/api`;
});

after(async () => {
  if (server) {
    await new Promise(resolve => server.close(resolve));
  }
  db.close();
  fs.rmSync(tempDir, { recursive: true, force: true });
});

function seedTestData() {
  db.exec('DELETE FROM weights; DELETE FROM health_events; DELETE FROM animals; DELETE FROM paddocks;');

  const northId = db.prepare(
    'INSERT INTO paddocks (name, capacity) VALUES (?, ?)'
  ).run('North Paddock', 50).lastInsertRowid;

  const southId = db.prepare(
    'INSERT INTO paddocks (name, capacity) VALUES (?, ?)'
  ).run('South Paddock', 30).lastInsertRowid;

  const insertAnimal = db.prepare(
    'INSERT INTO animals (name, tag_number, breed, date_of_birth, paddock_id) VALUES (?, ?, ?, ?, ?)'
  );

  const bellaId = insertAnimal.run('Bella', 'TAG-001', 'Merino', '2021-03-14', northId).lastInsertRowid;
  insertAnimal.run('Daisy', 'TAG-002', 'Dorper', '2020-07-22', southId);

  db.prepare(
    'INSERT INTO health_events (animal_id, event_type, notes, date, vet_name) VALUES (?, ?, ?, ?, ?)'
  ).run(bellaId, 'vaccination', 'Routine vaccination', '2024-01-15', 'Dr. Walsh');

  db.prepare(
    'INSERT INTO weights (animal_id, weight_kg, date, notes) VALUES (?, ?, ?, ?)'
  ).run(bellaId, 45.5, '2024-01-10', 'First weight check');
  
  db.prepare(
    'INSERT INTO weights (animal_id, weight_kg, date, notes) VALUES (?, ?, ?, ?)'
  ).run(bellaId, 46.2, '2024-02-10', 'Second weight check');
}

async function get(path) {
  const res = await fetch(baseUrl + path);
  return { status: res.status, body: await res.json() };
}

async function post(path, body) {
  const res = await fetch(baseUrl + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
}

test('GET /api/paddocks returns an array', async () => {
  const { status, body } = await get('/paddocks');
  assert.equal(status, 200);
  assert.ok(Array.isArray(body));
});

test('GET /api/animals returns animals with latest_health_event field', async () => {
  const { status, body } = await get('/animals?page=0&limit=5');
  assert.equal(status, 200);
  assert.ok(Array.isArray(body));
  assert.ok(body.length > 0);
  assert.ok('latest_health_event' in body[0]);
});

test('GET /api/animals/:id returns a single animal', async () => {
  const { body: animals } = await get('/animals?page=0&limit=1');
  const id = animals[0].id;
  const { status, body } = await get(`/animals/${id}`);
  assert.equal(status, 200);
  assert.equal(body.id, id);
});

test('GET /api/animals/:id returns 404 for unknown id', async () => {
  const { status } = await get('/animals/999999');
  assert.equal(status, 404);
});

test('POST /api/animals/:id/health-events creates an event', async () => {
  const { body: animals } = await get('/animals?page=0&limit=1');
  const id = animals[0].id;
  const { status, body } = await post(`/animals/${id}/health-events`, {
    event_type: 'checkup',
    date: '2025-01-10',
    vet_name: 'Dr. Test',
  });
  assert.equal(status, 201);
  assert.equal(body.event_type, 'checkup');
  assert.equal(body.animal_id, id);
});

test('GET /api/animals/:id/weights returns weights array for animal with weights', async () => {
  const { body: animals } = await get('/animals?page=0&limit=1');
  const id = animals[0].id;
  const { status, body } = await get(`/animals/${id}/weights`);
  assert.equal(status, 200);
  assert.ok(Array.isArray(body));
  assert.equal(body.length, 2);
  assert.equal(body[0].animal_id, id);
  assert.equal(body[0].weight_kg, 46.2);
  assert.equal(body[0].date, '2024-02-10');
});

test('GET /api/animals/:id/weights returns empty array for animal without weights', async () => {
  const { body: animals } = await get('/animals?page=0&limit=5');
  const daisyId = animals.find(a => a.name === 'Daisy').id;
  const { status, body } = await get(`/animals/${daisyId}/weights`);
  assert.equal(status, 200);
  assert.ok(Array.isArray(body));
  assert.equal(body.length, 0);
});

test('GET /api/animals/:id/weights returns 404 for unknown animal', async () => {
  const { status, body } = await get('/animals/999999/weights');
  assert.equal(status, 404);
  assert.equal(body.error, 'Animal not found');
});

test('POST /api/animals/:id/weights creates weight successfully', async () => {
  const { body: animals } = await get('/animals?page=0&limit=1');
  const id = animals[0].id;
  const { status, body } = await post(`/animals/${id}/weights`, {
    weight_kg: 47.5,
    date: '2025-01-15',
  });
  assert.equal(status, 201);
  assert.equal(body.weight_kg, 47.5);
  assert.equal(body.date, '2025-01-15');
  assert.equal(body.animal_id, id);
  assert.equal(body.notes, null);
});

test('POST /api/animals/:id/weights creates weight with notes', async () => {
  const { body: animals } = await get('/animals?page=0&limit=1');
  const id = animals[0].id;
  const { status, body } = await post(`/animals/${id}/weights`, {
    weight_kg: 48.0,
    date: '2025-01-20',
    notes: 'Post-shearing weight',
  });
  assert.equal(status, 201);
  assert.equal(body.weight_kg, 48.0);
  assert.equal(body.date, '2025-01-20');
  assert.equal(body.notes, 'Post-shearing weight');
  assert.equal(body.animal_id, id);
});

test('POST /api/animals/:id/weights returns 404 for unknown animal', async () => {
  const { status, body } = await post('/animals/999999/weights', {
    weight_kg: 45.0,
    date: '2025-01-15',
  });
  assert.equal(status, 404);
  assert.equal(body.error, 'Animal not found');
});

test('POST /api/animals/:id/weights returns 400 when date is missing', async () => {
  const { body: animals } = await get('/animals?page=0&limit=1');
  const id = animals[0].id;
  const { status, body } = await post(`/animals/${id}/weights`, {
    weight_kg: 45.0,
  });
  assert.equal(status, 400);
  assert.equal(body.error, 'date is required');
});

test('POST /api/animals/:id/weights returns 422 when weight_kg is missing', async () => {
  const { body: animals } = await get('/animals?page=0&limit=1');
  const id = animals[0].id;
  const { status, body } = await post(`/animals/${id}/weights`, {
    date: '2025-01-15',
  });
  assert.equal(status, 422);
  assert.equal(body.error, 'weight_kg is required and must be positive');
});

test('POST /api/animals/:id/weights returns 422 when weight_kg is zero', async () => {
  const { body: animals } = await get('/animals?page=0&limit=1');
  const id = animals[0].id;
  const { status, body } = await post(`/animals/${id}/weights`, {
    weight_kg: 0,
    date: '2025-01-15',
  });
  assert.equal(status, 422);
  assert.equal(body.error, 'weight_kg is required and must be positive');
});

test('POST /api/animals/:id/weights returns 422 when weight_kg is negative', async () => {
  const { body: animals } = await get('/animals?page=0&limit=1');
  const id = animals[0].id;
  const { status, body } = await post(`/animals/${id}/weights`, {
    weight_kg: -10.5,
    date: '2025-01-15',
  });
  assert.equal(status, 422);
  assert.equal(body.error, 'weight_kg is required and must be positive');
});

test('POST /api/animals/:id/weights returns 422 when weight_kg is not a valid number', async () => {
  const { body: animals } = await get('/animals?page=0&limit=1');
  const id = animals[0].id;
  const { status, body } = await post(`/animals/${id}/weights`, {
    weight_kg: 'invalid',
    date: '2025-01-15',
  });
  assert.equal(status, 422);
  assert.equal(body.error, 'weight_kg is required and must be positive');
});
