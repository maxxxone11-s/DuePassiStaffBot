type SourceDish = { id: number; name: string; category: string; ingredients: string[]; components: Record<string, string[]> };
const aliases: Record<string, string> = { 'ворчестер': 'соус ворчестер', 'заправка азия': 'соус азия' };
const normalize = (name: string) => name.trim().toLocaleLowerCase('ru-RU').replace(/ё/g, 'е').replace(/\s+/g, ' ');
const keyOf = (name: string) => aliases[normalize(name)] || normalize(name);
const extras = new Set(['песто', 'понзу', 'майонез', 'майонез 78%', 'майонез острый', 'демиглас', 'бешамель', 'гуакамоле', 'чимичурри', 'релиш', 'кетчуп', 'табаско', 'терияки', 'томатная сальса', 'томатная база', 'зеленое масло', 'чесночное масло', 'острое масло', 'масло с розмарином', 'мусс пармезан']);
const isSauce = (name: string) => /соус|^крем (дайкон|из артишоков|черри)$|^крем-бальзамик$/.test(name) || extras.has(name);

// Only the sauce's ingredients are inspected, never the allergens of its dishes.
const ingredientAllergens: [RegExp, string][] = [
  [/молоко|сливки|сливочное масло|масло сливочное|сметана|пармезан|сыр креметте|моцарелла|горгонзола|дорблю|страчателла|блю чиз/, 'молочные продукты'],
  [/яйц|желток|яичный белок|майонез/, 'яйцо'],
  [/тунец|тунца|анчоус|лосось|семга|хондаши|хандаш|стружка тунца/, 'рыба'],
  [/кревет|краб|ракообраз/, 'ракообразные'],
  [/вонголе|гребешок|кальмар|мидии|устриц|устричн/, 'моллюски'],
  [/соев|мисо/, 'соя'],
  [/горчиц|горчичн/, 'горчица'],
  [/кунжут/, 'кунжут'],
  [/сельдере/, 'сельдерей'],
  [/грецкий орех|орех грецкий/, 'грецкий орех'],
  [/кедровый орех|орех кедровый/, 'кедровый орех'],
  [/арахис/, 'арахис'],
  [/фисташк/, 'фисташки'],
  [/миндал/, 'миндаль'],
  [/фундук/, 'фундук'],
  [/пшенич|хлеб|сухари|панировоч|ржан|ячмен|^мука$/, 'глютен'],
];

export function buildSauces(dishes: SourceDish[]) {
  const entries = new Map<string, { name: string; variants: Map<string, { ingredients: string[]; sources: Set<string> }>; used: Set<string> }>();
  const ensure = (raw: string) => {
    const key = keyOf(raw);
    if (!isSauce(key)) return;
    if (!entries.has(key)) entries.set(key, { name: aliases[normalize(raw)] || raw, variants: new Map(), used: new Set() });
    return entries.get(key)!;
  };
  const originals = dishes.filter(d => d.category !== 'sauces');
  for (const dish of originals) {
    for (const raw of [...dish.ingredients, ...Object.keys(dish.components), ...Object.values(dish.components).flat()]) ensure(raw);
    for (const [raw, ingredients] of Object.entries(dish.components)) {
      const entry = ensure(raw);
      if (!entry || !ingredients.length) continue;
      const fingerprint = JSON.stringify(ingredients.map(normalize).sort());
      if (!entry.variants.has(fingerprint)) entry.variants.set(fingerprint, { ingredients, sources: new Set() });
      entry.variants.get(fingerprint)!.sources.add(dish.name);
    }
  }
  for (const dish of originals) {
    const visited = new Set<string>();
    const visit = (raw: string) => {
      const key = keyOf(raw);
      if (visited.has(key)) return;
      visited.add(key);
      const entry = entries.get(key);
      if (entry) entry.used.add(dish.name);
      // Prefer this dish's own composition; otherwise use known compositions of
      // the named preparation. A visited set also handles cyclic references.
      const local = Object.entries(dish.components).find(([name]) => keyOf(name) === key)?.[1];
      const nested = local ?? (entry ? [...entry.variants.values()].flatMap(v => v.ingredients) : []);
      nested.forEach(visit);
    };
    dish.ingredients.forEach(visit);
    Object.values(dish.components).flat().forEach(visit);
  }
  return [...entries.values()].filter(e => e.used.size).sort((a, b) => a.name.localeCompare(b.name, 'ru')).map((entry, index) => {
    const ingredients = [...entry.variants.values()].sort((a, b) => b.ingredients.length - a.ingredients.length)[0]?.ingredients ?? [];
    const allergens = new Set<string>();
    const checked = new Set<string>();
    const inspect = (raw: string) => {
      const key = keyOf(raw);
      if (checked.has(key)) return;
      checked.add(key);
      for (const [pattern, allergen] of ingredientAllergens) if (pattern.test(key)) allergens.add(allergen);
      const nested = entries.get(key);
      if (nested?.variants.size) {
        [...nested.variants.values()].sort((a, b) => b.ingredients.length - a.ingredients.length)[0].ingredients.forEach(inspect);
      }
    };
    // Include the named base too (e.g. mustard dressing whose incomplete
    // ingredient list accidentally omits mustard, or purchased soy sauce).
    inspect(entry.name);
    return {
      id: -index - 1, name: entry.name.charAt(0).toUpperCase() + entry.name.slice(1), category: 'sauces',
      short_description: '',
      ingredients, components: {} as Record<string, string[]>,
      allergens: [...allergens], service_note: '', badge: 'Соус', color: 'sage', weight: 0, recipe: null,
      used_in: [...entry.used].sort((a,b) => a.localeCompare(b,'ru')),
    };
  });
}
