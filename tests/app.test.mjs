import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, dirname, join } from 'node:path';
import { createRequire } from 'node:module';
import { compileFunction } from 'node:vm';
import test from 'node:test';
import ts from 'typescript';
import { NextRequest } from 'next/server.js';

// Execute the actual route against isolated SQLite, without a running server or
// touching the developer's database. TypeScript transpilation only removes types.
const root = resolve(import.meta.dirname, '..');
process.env.DATABASE_PATH = join(mkdtempSync(join(tmpdir(), 'duepassi-test-')), 'app.sqlite');
process.env.ADMIN_ACCESS_CODE = 'test-admin';
process.env.EMPLOYEE_ACCESS_CODE = 'test-employee';

function loadSource(file, dependencies = {}) {
  const filename = join(root, file);
  const source = ts.transpileModule(readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const loadedModule = { exports: {} };
  const require = createRequire(filename);
  compileFunction(source, ['exports', 'require', 'module', '__filename', '__dirname'], { filename })(
    loadedModule.exports, (id) => dependencies[id] ?? require(id), loadedModule, filename, dirname(filename),
  );
  return loadedModule.exports;
}

const database = loadSource('lib/db.ts');
const loadRoute = () => loadSource('app/api/app/route.ts', { '@/lib/db': database });
let route = loadRoute();
let cookie = '';
const request = (body) => new NextRequest('http://localhost/api/app', {
  ...(body === undefined ? {} : { method: 'POST', body: JSON.stringify(body) }),
  headers: { 'Content-Type': 'application/json', cookie },
});
const get = async () => (await route.GET(request())).json();
const post = (body) => route.POST(request(body));

test('menu, upgrade preservation, sessions and result retries', async (t) => {
  let initial;
  await t.test('concurrent first requests seed the menu once and require login', async () => {
    const responses = await Promise.all(Array.from({ length: 8 }, () => get()));
    assert.ok(responses.every((data) => data.user === null && data.dishes.length === 0));
    const response = await post({ action: 'join', code: 'test-admin' });
    assert.equal(response.status, 200);
    cookie = response.headers.get('set-cookie').split(';')[0];
    initial = await get();
    assert.equal(initial.user.role, 'admin');
    assert.equal(new Set(initial.dishes.map((dish) => dish.category)).size, 13);
    assert.equal(new Set(initial.dishes.map((dish) => `${dish.category}:${dish.name}`)).size, initial.dishes.length);
  });

  await t.test('renamed dishes survive requests and a fresh route initialization', async () => {
    const dish = initial.dishes.find((item) => item.category === 'crudo');
    // This name was previously deleted unconditionally by initDb.
    const renamed = { ...dish, name: 'Сибас крудо' };
    assert.equal((await post({ action: 'saveDish', ...renamed })).status, 200);
    route = loadRoute();
    const updated = await get();
    assert.equal(updated.dishes.length, initial.dishes.length);
    assert.equal(updated.dishes.find((item) => item.id === dish.id).name, renamed.name);
    assert.equal(updated.dishes.some((item) => item.name === dish.name), false);
  });

  await t.test('invalid scores do not enter the results table', async () => {
    for (const [score, total] of [[-1, 15], [16, 15], [0, 0], [1.5, 15], [1, 16], ['1', 15], [null, 15]]) {
      assert.equal((await post({ action: 'attempt', score, total })).status, 400);
    }
    assert.equal((await get()).attempts.length, 0);
  });

  await t.test('retry after a lost response creates exactly one result', async () => {
    const body = { action: 'attempt', score: 12, total: 15, requestId: crypto.randomUUID() };
    const responses = await Promise.all([post(body), post(body), post(body)]);
    assert.ok(responses.every((response) => response.status === 200));
    assert.equal((await get()).attempts.length, 1);
  });

  await t.test('old clients can save and an existing unmarked menu is preserved', async () => {
    assert.equal((await post({ action: 'attempt', score: 8, total: 15 })).status, 200);
    await database.getDb().prepare("DELETE FROM app_settings WHERE key = 'menu_seed_v1'").run();
    const before = await get();
    route = loadRoute();
    const after = await get();
    assert.deepEqual(after.dishes, before.dishes);
    assert.deepEqual(after.attempts, before.attempts);
    assert.equal(after.user.id, before.user.id);
  });

  await t.test('malformed request bodies receive a client error', async () => {
    for (const body of [null, [], 'text']) assert.equal((await post(body)).status, 400);
    const response = await route.POST(new NextRequest('http://localhost/api/app', { method: 'POST', body: '{' }));
    assert.equal(response.status, 400);
  });

  await t.test('logout invalidates the saved session', async () => {
    assert.equal((await post({ action: 'logout' })).status, 200);
    assert.equal((await get()).user, null);
    assert.equal((await post({ action: 'attempt', score: 15, total: 15 })).status, 401);
  });
});
