import type { Recipe } from './recipes';

type SourceDish = { id: number; name: string; category: string; ingredients: string[]; components: Record<string, string[]> };
const aliases: Record<string, string> = { 'ворчестер': 'соус ворчестер', 'заправка азия': 'соус азия' };
const normalize = (name: string) => name.trim().toLocaleLowerCase('ru-RU').replace(/ё/g, 'е').replace(/\s+/g, ' ');
const keyOf = (name: string) => aliases[normalize(name)] || normalize(name);
const extras = new Set(['песто', 'понзу', 'майонез', 'майонез 78%', 'майонез острый', 'демиглас', 'бешамель', 'гуакамоле', 'чимичурри', 'релиш', 'кетчуп', 'табаско', 'терияки', 'томатная сальса', 'томатная база', 'зеленое масло', 'чесночное масло', 'острое масло', 'масло с розмарином', 'мусс пармезан']);
const isSauce = (name: string) => /соус|^крем (дайкон|из артишоков|черри)$|^крем-бальзамик$/.test(name) || extras.has(name);

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
    const variants = [...entry.variants.values()];
    const recipe: Recipe | null = variants.length > 1 ? { note: 'В техкартах встречаются разные составы. Выберите вариант и сверяйте его с нужным блюдом.', variants: variants.map((v, i) => ({ label: `Вариант ${i + 1}`, ingredients: v.ingredients.map(name => ({ name, quantity: '', note: '' })) })) } : null;
    return {
      id: -index - 1, name: entry.name.charAt(0).toUpperCase() + entry.name.slice(1), category: 'sauces',
      short_description: variants.length ? 'Состав из техкарт меню' : 'Состав необходимо уточнить по техкарте или упаковке',
      ingredients: variants.length === 1 ? variants[0].ingredients : [], components: {} as Record<string, string[]>,
      allergens: [] as string[], service_note: '', badge: 'Соус', color: 'sage', weight: 0, recipe,
      used_in: [...entry.used].sort((a,b) => a.localeCompare(b,'ru')),
      sauce_sources: variants.length > 1 ? variants.map((v,i) => `Вариант ${i+1}: ${[...v.sources].join(', ')}`) : [],
    };
  });
}
