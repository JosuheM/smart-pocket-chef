/** minúsculas, sin acentos ni símbolos, espacios simples */
export function normalize(str = '') {
  return String(str)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function singular(word) {
  if (word.length > 4 && word.endsWith('ies')) return `${word.slice(0, -3)}y`;
  if (word.length > 4 && word.endsWith('oes')) return word.slice(0, -2);
  if (word.length > 3 && word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1);
  return word;
}

export const stem = (str) => normalize(str).split(' ').filter(Boolean).map(singular).join(' ');

// Palabras que no cambian el ingrediente: "red onions" sigue siendo cebolla.
const MODIFIERS = new Set([
  'black', 'white', 'red', 'green', 'yellow', 'orange', 'fresh', 'dried', 'dry', 'ground', 'chopped', 'minced',
  'sliced', 'diced', 'crushed', 'grated', 'sea', 'kosher', 'extra', 'virgin', 'unsalted', 'salted', 'plain',
  'whole', 'brown', 'dark', 'light', 'large', 'small', 'sweet', 'raw', 'frozen', 'canned', 'tinned', 'melted',
  'cooked', 'smoked', 'toasted', 'roasted', 'baby', 'freshly', 'finely', 'organic', 'hot', 'cold', 'warm',
  'boiling', 'golden', 'soft', 'heavy', 'double', 'single', 'caster', 'icing', 'granulated', 'powdered',
]);

// Palabras que convierten el ingrediente en otro producto: "tomato sauce" no es "tomato".
const DERIVED = new Set([
  'sauce', 'paste', 'puree', 'ketchup', 'stock', 'powder', 'oil', 'flour', 'vinegar', 'milk', 'cream', 'cheese',
  'butter', 'salt', 'syrup', 'extract', 'jam', 'wine', 'bread', 'noodle', 'cube', 'essence', 'sugar', 'starch',
  'seasoning', 'spice', 'mustard', 'pastry', 'biscuit', 'chocolate', 'yoghurt', 'yogurt', 'pickle', 'dressing',
]);

const hasPrefix = (words, prefix) => prefix.length <= words.length && prefix.every((w, i) => words[i] === w);
const hasSuffix = (words, suffix) =>
  suffix.length <= words.length && suffix.every((w, i) => words[words.length - suffix.length + i] === w);

/**
 * ¿El ingrediente de la receta corresponde a lo que dice tener el usuario? Ambos ya vienen "stemmed".
 * "chicken" ~ "chicken breast", "onion" ~ "red onions", pero "milk" no ~ "coconut milk" ni "tomato" ~ "tomato sauce".
 */
export function stemMatches(userStem, recipeStem) {
  if (!userStem || !recipeStem) return false;
  if (userStem === recipeStem) return true;
  const u = userStem.split(' ');
  const r = recipeStem.split(' ');
  if (hasPrefix(r, u)) return !r.slice(u.length).some((w) => DERIVED.has(w));
  if (hasPrefix(u, r)) return true;
  if (hasSuffix(r, u)) return r.slice(0, r.length - u.length).every((w) => MODIFIERS.has(w));
  if (hasSuffix(u, r)) return u.slice(0, u.length - r.length).every((w) => MODIFIERS.has(w));
  return false;
}

export const ingredientMatches = (userTerm, recipeIngredient) => stemMatches(stem(userTerm), stem(recipeIngredient));
