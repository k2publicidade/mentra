import test from 'node:test';
import assert from 'node:assert/strict';
import {scryptSync} from 'node:crypto';
import {createApp} from '../server/app.js';
import {zonedInputToISO, toDateTimeInput} from '../src/lib.js';

async function authHarness(t) {
  const app = createApp({dbPath: ':memory:'});
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(async () => {
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    app.locals.db.close();
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = (path, body) => fetch(base + path, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(body),
  });
  return {app, post};
}

test('login preserves leading and trailing password whitespace exactly', async t => {
  const {post} = await authHarness(t);
  const email = 'whitespace@example.test';
  const password = ' \tuma-senha-segura\u00a0 ';
  const registered = await post('/api/auth/register', {name: 'Ana', email, password});
  assert.equal(registered.status, 201);
  const user = (await registered.json()).user;
  const loggedIn = await post('/api/auth/login', {email, password});
  assert.equal(loggedIn.status, 200);
  assert.equal((await loggedIn.json()).user.id, user.id);
  for (const wrong of [password.trim(), password.trimStart(), password.trimEnd()]) {
    const response = await post('/api/auth/login', {email, password: wrong});
    assert.equal(response.status, 401);
    assert.equal((await response.json()).error, 'E-mail ou senha incorretos.');
  }
});

test('login bounds input without imposing the registration minimum on legacy passwords', async t => {
  const {app, post} = await authHarness(t);
  const email = 'legacy@example.test';
  assert.equal((await post('/api/auth/register', {name: 'Ana', email, password: 'uma-senha-segura'})).status, 201);
  const salt = 'review-regression-salt';
  const password = ' short ';
  app.locals.db.prepare('UPDATE users SET password=? WHERE email=?').run(
    `${salt}:${scryptSync(password, salt, 64).toString('hex')}`, email,
  );
  assert.equal((await post('/api/auth/login', {email, password})).status, 200);
  for (const invalid of ['', null, 123, {}, 'x'.repeat(257)]) {
    assert.equal((await post('/api/auth/login', {email, password: invalid})).status, 400);
  }
});

test('login preserves valid all-whitespace passwords and the 256-character boundary', async t => {
  const {post} = await authHarness(t);
  for (const [index, password] of [' '.repeat(10), ` ${'x'.repeat(254)} `].entries()) {
    const email = `boundary${index}@example.test`;
    assert.equal((await post('/api/auth/register', {name: 'Ana', email, password})).status, 201);
    assert.equal((await post('/api/auth/login', {email, password})).status, 200);
  }
});

test('manual input rejects the repeated New York civil minute instead of choosing an instant', () => {
  const value = '2026-11-01T01:30';
  for (const iso of ['2026-11-01T05:30:00.000Z', '2026-11-01T06:30:00.000Z']) {
    assert.equal(toDateTimeInput(iso, 'America/New_York'), value);
  }
  assert.throws(() => zonedInputToISO(value, 'America/New_York'), /Horário ambíguo.*outro horário/);
});

for (const [zone, value, instants] of [
  ['Europe/Berlin', '2026-10-25T02:30', ['2026-10-25T00:30:00.000Z', '2026-10-25T01:30:00.000Z']],
  ['Australia/Lord_Howe', '2026-04-05T01:45', ['2026-04-04T14:45:00.000Z', '2026-04-04T15:15:00.000Z']],
  ['Pacific/Chatham', '2026-04-05T03:00', ['2026-04-04T13:15:00.000Z', '2026-04-04T14:15:00.000Z']],
  ['Antarctica/Troll', '2026-10-25T01:30', ['2026-10-24T23:30:00.000Z', '2026-10-25T01:30:00.000Z']],
]) {
  test(`manual input rejects overlaps in ${zone}`, () => {
    for (const instant of instants) assert.equal(toDateTimeInput(instant, zone), value);
    assert.throws(() => zonedInputToISO(value, zone), /Horário ambíguo.*outro horário/);
  });
}

for (const [zone, value] of [
  ['America/New_York', '2026-03-08T02:30'],
  ['Europe/Berlin', '2026-03-29T02:30'],
  ['Australia/Lord_Howe', '2026-10-04T02:15'],
]) {
  test(`manual input still rejects nonexistent civil minutes in ${zone}`, () => {
    assert.throws(() => zonedInputToISO(value, zone), /Horário inválido.*outro horário/);
  });
}

test('manual input preserves unique times around overlaps and non-DST fractional offsets', () => {
  for (const [zone, value, expected] of [
    ['America/New_York', '2026-11-01T00:30', '2026-11-01T04:30:00.000Z'],
    ['America/New_York', '2026-11-01T02:30', '2026-11-01T07:30:00.000Z'],
    ['Australia/Lord_Howe', '2026-04-05T01:15', '2026-04-04T14:15:00.000Z'],
    ['Australia/Lord_Howe', '2026-04-05T02:00', '2026-04-04T15:30:00.000Z'],
    ['America/Sao_Paulo', '2026-10-09T10:30', '2026-10-09T13:30:00.000Z'],
    ['Asia/Kolkata', '2026-10-09T10:30', '2026-10-09T05:00:00.000Z'],
    ['Asia/Kathmandu', '2026-10-09T10:30', '2026-10-09T04:45:00.000Z'],
    ['UTC', '2026-11-01T01:30', '2026-11-01T01:30:00.000Z'],
  ]) {
    assert.equal(zonedInputToISO(value, zone), expected, `${zone}: ${value}`);
    assert.equal(toDateTimeInput(expected, zone), value);
  }
  assert.equal(zonedInputToISO('', 'UTC'), null);
  assert.throws(() => zonedInputToISO('2026-02-30T10:30', 'UTC'), /Data inválida/);
  assert.throws(() => zonedInputToISO('2026-10-09T10:30:00', 'UTC'), /Data inválida/);
});
