// Filtros de dieta y alergias. No se apoyan en la categoría de TheMealDB (que solo dice "Vegetariano" o "Postre"):
// se revisan los ingredientes de cada receta con listas de palabras clave (en inglés, como vienen en el catálogo).
// Es una ayuda orientativa, no un diagnóstico: la pantalla avisa que hay que leer siempre las etiquetas.

export const DIETS = {
  gluten: { label: 'Sin gluten', contains: 'gluten' },
  dairy: { label: 'Sin lácteos', contains: 'lácteos' },
  nuts: { label: 'Sin frutos secos', contains: 'frutos secos' },
};

const rule = (words, safe = []) => ({ find: new RegExp(String.raw`\b(?:${words})\b`, 'i'), safe: safe.length ? new RegExp(String.raw`\b(?:${safe.join('|')})\b`, 'gi') : null });

const RULES = {
  gluten: rule(
    'flour|bread|breadcrumbs?|crumbs?|panko|pasta|spaghetti|macaroni|lasagn[ae]|linguine|penne|fettuccine|tagliatelle|rigatoni|fusilli|orzo|gnocchi|noodles?|ramen|udon|couscous|bulgu?r|barley|rye|semolina|wheat|farro|spelt|seitan|pastry|filo|phyllo|pie crust|dough|biscuits?|crackers?|croissants?|tortillas?|pita|naan|baguette|ciabatta|brioche|buns?|rolls?|cake|cookies?|oats?|oatmeal|beer|lager|ale|malt|soy sauce|soya sauce|worcestershire|stuffing|croutons?|wafers?|digestives?|ladyfingers|sponge|breadsticks?|pretzels?|muffins?|bagels?|waffles?|pancakes?|self[- ]raising|marmite|caramel biscuits?',
    ['gluten[- ]free', 'rice noodles?', 'rice flour', 'corn ?flour', 'corn ?starch', 'potato flour', 'potato starch', 'almond flour', 'coconut flour', 'chickpea flour', 'gram flour', 'tapioca flour', 'buckwheat flour', 'rice paper', 'glass noodles?', 'bean thread noodles?', 'corn tortillas?', 'ginger ale'],
  ),
  dairy: rule(
    'milk|cheese|butter|cream|creme fraiche|yogh?urt|ghee|whey|custard|buttermilk|curds?|paneer|ricotta|mascarpone|parmesan|parmigiano|mozzarella|cheddar|feta|halloumi|brie|gruyere|camembert|gouda|emmental|gorgonzola|stilton|pecorino|manchego|quark|kefir|casein|lactose|ice cream|half and half|half-and-half|dulce de leche|queso|leche|mantequilla',
    ['peanut butter', 'almond butter', 'cashew butter', 'nut butter', 'butter beans?', 'butternut', 'butterscotch', 'cocoa butter', 'shea butter', 'coconut milk', 'coconut cream', 'almond milk', 'soy ?milk', 'soya milk', 'oat milk', 'rice milk', 'cream of tartar', 'dairy[- ]free'],
  ),
  nuts: rule(
    'peanuts?|almonds?|walnuts?|cashews?|pecans?|pistachios?|hazelnuts?|macadamias?|pine ?nuts?|brazil nuts?|chestnuts?|nuts?|groundnuts?|praline|marzipan|nutella|gianduja|amaretto|frangipane',
    ['water chestnuts?', 'nut[- ]free'],
  ),
};

/** ¿Este ingrediente lleva gluten, lácteos o frutos secos? */
export function ingredientFlags(name) {
  const text = String(name ?? '').toLowerCase();
  const flags = {};
  for (const [diet, { find, safe }] of Object.entries(RULES)) {
    flags[diet] = find.test(safe ? text.replace(safe, ' ') : text);
  }
  return flags;
}

/** Marca una receta según sus ingredientes: { gluten, dairy, nuts } (true = lo lleva). */
export function dietFlags(ingredientNames) {
  const flags = { gluten: false, dairy: false, nuts: false };
  for (const name of ingredientNames) {
    const f = ingredientFlags(name);
    for (const diet of Object.keys(flags)) flags[diet] ||= f[diet];
  }
  return flags;
}

/** Lista de ingredientes que la receta lleva, en español ("gluten", "lácteos"…), para mostrarla como aviso. */
export const allergensOf = (flags) => Object.entries(DIETS).filter(([id]) => flags[id]).map(([, d]) => d.contains);

/** De un texto "gluten,dairy" deja solo las dietas que existen. */
export const parseDiet = (value) => [...new Set(String(value ?? '').split(',').map((s) => s.trim()).filter((s) => s in DIETS))];
