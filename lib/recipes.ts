export type RecipeIngredient = { name: string; quantity: string; note: string };
export type RecipeVariant = { label: string; ingredients: RecipeIngredient[] };
export type Recipe = { variants: RecipeVariant[]; note: string };

export const drinkCategories = ['lemonade', 'milkshakes', 'tea'] as const;
export function isDrink(category: string) {
  return (drinkCategories as readonly string[]).includes(category);
}

export function recipeIngredients(recipe: Recipe) {
  return [...new Set(recipe.variants.flatMap((variant) => variant.ingredients.map((item) => item.name.trim().toLocaleLowerCase('ru-RU'))))];
}

export function validRecipe(value: unknown): value is Recipe {
  if (!value || typeof value !== 'object') return false;
  const recipe = value as Recipe;
  const text = (value: unknown, max: number, required = false) => typeof value === 'string' && value.length <= max && (!required || value.trim().length > 0);
  return text(recipe.note, 2000) && Array.isArray(recipe.variants) && recipe.variants.length > 0 && recipe.variants.length <= 4
    && new Set(recipe.variants.map((variant) => variant?.label)).size === recipe.variants.length
    && recipe.variants.every((variant) => variant && text(variant.label, 80, true) && Array.isArray(variant.ingredients)
      && variant.ingredients.length > 0 && variant.ingredients.length <= 40
      && variant.ingredients.every((item) => item && text(item.name, 200, true) && text(item.quantity, 100) && text(item.note, 400)));
}
