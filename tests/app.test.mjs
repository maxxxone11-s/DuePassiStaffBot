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
const recipes = loadSource('lib/recipes.ts');
const drinkSeeds = JSON.parse(readFileSync(join(root, 'data/drinks.json'), 'utf8'));
const loadRoute = () => loadSource('app/api/app/route.ts', { '@/lib/db': database, '@/lib/recipes': recipes, '@/data/drinks.json': drinkSeeds });
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
    assert.equal(new Set(initial.dishes.map((dish) => dish.category)).size, 16);
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

  await t.test('drink migration adds 15 recipes without changing the existing menu', async () => {
    await database.getDb().prepare("DELETE FROM dishes WHERE category IN ('lemonade', 'milkshakes', 'tea')").run();
    await database.getDb().prepare("DELETE FROM app_settings WHERE key = 'drinks_seed_v1'").run();
    const before = await get();
    route = loadRoute();
    const after = await get();
    assert.deepEqual(after.dishes.filter((dish) => !recipes.isDrink(dish.category)), before.dishes);
    assert.deepEqual(after.staff, before.staff);
    assert.deepEqual(after.attempts, before.attempts);
    for (const category of recipes.drinkCategories) {
      const drinks = after.dishes.filter((dish) => dish.category === category);
      assert.equal(drinks.length, 5);
      assert.ok(drinks.every((drink) => recipes.validRecipe(drink.recipe)));
    }
  });

  await t.test('photo quantities stay independent for both lemonade volumes', async () => {
    const drinks = (await get()).dishes;
    const strawberry = drinks.find((dish) => dish.category === 'lemonade' && dish.name === 'Клубника-лемонграсс');
    assert.deepEqual(strawberry.recipe.variants.map((v) => v.label), ['0,4 л', '1 л']);
    assert.deepEqual(strawberry.recipe.variants.map((v) => v.ingredients.map((i) => i.quantity)), [
      ['25 мл', '20 мл', '15 мл', '30 г', '20 г'],
      ['35 мл', '40 мл', '20 мл', '70 г', '30 г'],
    ]);
    const fruity = drinks.find((dish) => dish.name === 'Фруктовый');
    assert.equal(fruity.recipe.variants[1].ingredients.find((i) => i.name === 'Фреш лимона').quantity, '15 мл');
    const oreo = drinks.find((dish) => dish.name === 'Орео');
    assert.deepEqual(oreo.recipe.variants[0].ingredients.filter((i) => i.name === 'Печенье Орео').map((i) => i.quantity), ['2 шт.', '1 шт.']);
    const mango = drinks.find((dish) => dish.name === 'Тропический с манго');
    assert.equal(mango.recipe.variants[0].ingredients.find((i) => i.name === 'Ананас консервированный').quantity, '');
  });

  await t.test('admin quantity edits and renames survive restart and old clients', async () => {
    const before = await get();
    const drink = before.dishes.find((dish) => dish.category === 'lemonade');
    drink.name = 'Лимонад после правки';
    drink.recipe.variants[0].ingredients[0].quantity = '26 мл';
    assert.equal((await post({ action: 'saveDish', ...drink })).status, 200);
    route = loadRoute();
    const updated = await get();
    assert.equal(updated.dishes.length, before.dishes.length);
    assert.deepEqual(updated.dishes.find((dish) => dish.id === drink.id).recipe, drink.recipe);
    const legacyEdit = { ...drink };
    delete legacyEdit.recipe;
    assert.equal((await post({ action: 'saveDish', ...legacyEdit })).status, 200);
    assert.deepEqual((await get()).dishes.find((dish) => dish.id === drink.id).recipe, drink.recipe);
    for (const recipe of [{ variants: [] }, { variants: [null], note: '' }, { variants: [{ label: '1 л', ingredients: [] }], note: '' }]) {
      assert.equal((await post({ action: 'saveDish', ...drink, recipe })).status, 400);
    }
    assert.deepEqual((await get()).dishes.find((dish) => dish.id === drink.id).recipe, drink.recipe);
  });

  await t.test('obsolete syrup note is removed without overwriting edited quantities', async () => {
    const tea = (await get()).dishes.find((dish) => dish.name === 'Смородина-мандарин');
    const syrup = tea.recipe.variants[0].ingredients.find((item) => item.name === 'Сироп смородина (ежевика)');
    syrup.quantity = '65 мл';
    syrup.note = 'В карте указаны оба варианта сиропа';
    tea.recipe.note = 'Сохранить примечание администратора';
    assert.equal((await post({ action: 'saveDish', ...tea })).status, 200);
    await database.getDb().prepare("DELETE FROM app_settings WHERE key = 'remove_syrup_note_v1'").run();
    route = loadRoute();
    const updated = (await get()).dishes.find((dish) => dish.id === tea.id);
    syrup.note = '';
    assert.deepEqual(updated.recipe, tea.recipe);
    route = loadRoute();
    assert.deepEqual((await get()).dishes.find((dish) => dish.id === tea.id).recipe, tea.recipe);
  });

  await t.test('logout invalidates the saved session', async () => {
    assert.equal((await post({ action: 'logout' })).status, 200);
    assert.equal((await get()).user, null);
    assert.equal((await post({ action: 'attempt', score: 15, total: 15 })).status, 401);
  });
});
