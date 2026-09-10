'use client';

import { useState } from 'react';
import type { Recipe } from '@/lib/recipes';

export function RecipeCard({ recipe }: { recipe: Recipe }) {
  const [index, setIndex] = useState(0);
  const variant = recipe.variants[index] ?? recipe.variants[0];
  return <section className="recipe-card" aria-label="Технологическая карта">
    <div className="recipe-heading"><p className="eyebrow">Техкарта</p><h3>Состав и количество</h3></div>
    {recipe.variants.length > 1 && <div className="recipe-volume" role="group" aria-label="Объём напитка">
      {recipe.variants.map((item, itemIndex) => <button type="button" key={item.label} aria-pressed={index === itemIndex} onClick={() => setIndex(itemIndex)}>{item.label}</button>)}
    </div>}
    <table className="recipe-table" aria-live="polite">
      <caption className="sr-only">Состав: {variant.label}</caption>
      <thead><tr><th scope="col">Ингредиент</th><th scope="col">Количество</th></tr></thead>
      <tbody>{variant.ingredients.map((item, rowIndex) => <tr key={rowIndex}>
        <th scope="row">{item.name}{item.note && <small>{item.note}</small>}</th><td>{item.quantity}</td>
      </tr>)}</tbody>
    </table>
    {recipe.note && <p className="recipe-note">{recipe.note}</p>}
  </section>;
}

export function RecipeEditor({ initial, category }: { initial?: Recipe | null; category: string }) {
  const [recipe, setRecipe] = useState<Recipe>(() => initial ?? {
    note: '', variants: (category === 'lemonade' ? ['0,4 л', '1 л'] : ['Порция']).map((label) => ({ label, ingredients: [{ name: '', quantity: '', note: '' }] })),
  });
  function updateRow(variantIndex: number, rowIndex: number, field: 'name' | 'quantity' | 'note', value: string) {
    setRecipe((current) => ({ ...current, variants: current.variants.map((variant, i) => i !== variantIndex ? variant : {
      ...variant, ingredients: variant.ingredients.map((item, j) => j !== rowIndex ? item : { ...item, [field]: value }),
    }) }));
  }
  return <div className="recipe-editor">
    <input type="hidden" name="recipe" value={JSON.stringify(recipe)} />
    <h3>Техкарта напитка</h3>
    {recipe.variants.map((variant, variantIndex) => <fieldset key={variantIndex}>
      <legend>{variant.label}</legend>
      <label><span>Объём / порция</span><input required maxLength={80} value={variant.label} onChange={(event) => setRecipe({ ...recipe, variants: recipe.variants.map((item, i) => i === variantIndex ? { ...item, label: event.target.value } : item) })} /></label>
      {variant.ingredients.map((item, rowIndex) => <div className="recipe-edit-row" key={rowIndex}>
        <label><span>Ингредиент</span><input required maxLength={200} value={item.name} onChange={(event) => updateRow(variantIndex, rowIndex, 'name', event.target.value)} /></label>
        <label><span>Количество</span><input maxLength={100} placeholder="25 мл / 40 г / 1 шт." value={item.quantity} onChange={(event) => updateRow(variantIndex, rowIndex, 'quantity', event.target.value)} /></label>
        <label><span>Примечание</span><input maxLength={400} placeholder="Для украшения" value={item.note} onChange={(event) => updateRow(variantIndex, rowIndex, 'note', event.target.value)} /></label>
        <button type="button" className="recipe-remove" disabled={variant.ingredients.length === 1} onClick={() => setRecipe({ ...recipe, variants: recipe.variants.map((part, i) => i === variantIndex ? { ...part, ingredients: part.ingredients.filter((_, j) => j !== rowIndex) } : part) })}>Убрать ингредиент</button>
      </div>)}
      <button type="button" className="secondary-button" disabled={variant.ingredients.length >= 40} onClick={() => setRecipe({ ...recipe, variants: recipe.variants.map((part, i) => i === variantIndex ? { ...part, ingredients: [...part.ingredients, { name: '', quantity: '', note: '' }] } : part) })}>Добавить ингредиент</button>
    </fieldset>)}
    <label><span>Примечание к техкарте</span><textarea maxLength={2000} value={recipe.note} onChange={(event) => setRecipe({ ...recipe, note: event.target.value })} /></label>
  </div>;
}
