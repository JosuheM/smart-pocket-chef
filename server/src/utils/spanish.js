// Categorías, países y medidas de TheMealDB: son listas cerradas, así que se traducen sin gastar cuota de ninguna API.
const CATEGORY = {
  Beef: 'Res', Breakfast: 'Desayuno', Chicken: 'Pollo', Dessert: 'Postre', Goat: 'Cabra',
  Lamb: 'Cordero', Miscellaneous: 'Variado', Pasta: 'Pasta', Pork: 'Cerdo', Seafood: 'Mariscos',
  Side: 'Acompañamiento', Starter: 'Entrada', Vegan: 'Vegano', Vegetarian: 'Vegetariano',
};

// TheMealDB mezcla gentilicios ("Turkish") y nombres de país ("France"): todo se muestra como país en español.
const AREA = {
  American: 'Estados Unidos', 'United States': 'Estados Unidos', USA: 'Estados Unidos', British: 'Reino Unido',
  'United Kingdom': 'Reino Unido', Canadian: 'Canadá', Chinese: 'China', Croatian: 'Croacia', Dutch: 'Países Bajos',
  Netherlands: 'Países Bajos', Egyptian: 'Egipto', Filipino: 'Filipinas', French: 'Francia', France: 'Francia',
  Greek: 'Grecia', Indian: 'India', India: 'India', Irish: 'Irlanda', Italian: 'Italia', Jamaican: 'Jamaica',
  Japanese: 'Japón', Kenyan: 'Kenia', Malaysian: 'Malasia', Mexican: 'México', Moroccan: 'Marruecos',
  Norwegian: 'Noruega', Norway: 'Noruega', Polish: 'Polonia', Portuguese: 'Portugal', Russian: 'Rusia',
  Spanish: 'España', Thai: 'Tailandia', Tunisian: 'Túnez', Turkish: 'Turquía', Ukrainian: 'Ucrania',
  Vietnamese: 'Vietnam', Algerian: 'Argelia', Argentine: 'Argentina', Argentina: 'Argentina', Australian: 'Australia',
  Austrian: 'Austria', Belgian: 'Bélgica', Brazilian: 'Brasil', Chilean: 'Chile', Colombian: 'Colombia',
  Cuban: 'Cuba', Czech: 'Chequia', Danish: 'Dinamarca', Ecuadorean: 'Ecuador', Ethiopian: 'Etiopía',
  German: 'Alemania', Ghanaian: 'Ghana', Hungarian: 'Hungría', Indonesian: 'Indonesia', Iranian: 'Irán',
  Iraqi: 'Irak', Israeli: 'Israel', Lebanese: 'Líbano', Nigerian: 'Nigeria', Pakistani: 'Pakistán',
  Peruvian: 'Perú', 'Puerto Rican': 'Puerto Rico', Romanian: 'Rumanía', 'Saudi Arabian': 'Arabia Saudita',
  Slovakia: 'Eslovaquia', Slovak: 'Eslovaquia', 'South Korean': 'Corea del Sur', Swedish: 'Suecia', Swiss: 'Suiza',
  Syrian: 'Siria', Uruguayan: 'Uruguay', Venezuela: 'Venezuela', Venezuelan: 'Venezuela', Dominican: 'República Dominicana',
  Haitian: 'Haití', Cambodian: 'Camboya', Bangladeshi: 'Bangladés', Bolivian: 'Bolivia', Panamanian: 'Panamá',
  Unknown: '',
};

export const categoryEs = (c) => CATEGORY[c] ?? c;
export const areaEs = (a) => AREA[String(a ?? '').trim()] ?? String(a ?? '').trim();
export const CATEGORIES = Object.keys(CATEGORY);

// Medidas: unidades y palabras frecuentes ("2 tbsp", "3 cloves", "1 large")
const MEASURE_RULES = [
  [/\btablespoons?\b|\btbsp\b|\btbs\b|\btblsp\b/gi, 'cda.'],
  [/\bteaspoons?\b|\btsp\b/gi, 'cdta.'],
  [/\bcups\b/gi, 'tazas'], [/\bcup\b/gi, 'taza'],
  [/\bcloves\b/gi, 'dientes'], [/\bclove\b/gi, 'diente'],
  [/\bgrams?\b/gi, 'g'],
  [/\bounces?\b/gi, 'oz'],
  [/\bpinch(es)?\b/gi, 'pizca'], [/\bdash(es)?\b/gi, 'chorrito'], [/\bhandfull?\b/gi, 'puñado'],
  [/\bbunch(es)?\b/gi, 'manojo'], [/\bsprigs?\b/gi, 'ramitas'], [/\bslices?\b/gi, 'rebanadas'],
  [/\bpieces?\b/gi, 'piezas'], [/\btins?\b|\bcans?\b/gi, 'lata'], [/\bknob\b/gi, 'trozo'],
  [/\bsticks?\b/gi, 'barras'], [/\bsheets?\b/gi, 'láminas'], [/\bpackets?\b|\bpacks?\b/gi, 'paquete'],
  [/\bto taste\b/gi, 'al gusto'], [/\bto serve\b/gi, 'para servir'], [/\bto garnish\b/gi, 'para decorar'],
  [/\bas needed\b/gi, 'al gusto'], [/\bwhole\b/gi, 'entero'], [/\bfresh\b/gi, 'fresco'],
  [/\blarge\b/gi, 'grande'], [/\bmedium\b/gi, 'mediano'], [/\bsmall\b/gi, 'pequeño'],
  [/\bchopped\b/gi, 'picado'], [/\bsliced\b/gi, 'en rodajas'], [/\bdiced\b/gi, 'en cubos'],
  [/\bminced\b/gi, 'picado fino'], [/\bgrated\b/gi, 'rallado'], [/\bfinely\b/gi, 'finamente'],
  [/\bhalf\b/gi, 'medio'], [/\bcloves of\b/gi, 'dientes de'], [/\band\b/gi, 'y'], [/\bof\b/gi, 'de'],
  [/\bplus extra\b/gi, 'más extra'], [/\bbeaten\b/gi, 'batido'], [/\bmelted\b/gi, 'derretido'],
  [/\bpeeled\b/gi, 'pelado'], [/\bcrushed\b/gi, 'triturado'], [/\bsplash\b/gi, 'chorrito'], [/\bdrizzle\b/gi, 'chorrito'],
  [/\bjuice\b/gi, 'jugo'], [/\bzest\b/gi, 'ralladura'], [/\bgarnish\b/gi, 'para decorar'],
  [/\bcooked\b/gi, 'cocido'], [/\bsoftened\b/gi, 'blando'], [/\bcubed\b/gi, 'en cubos'], [/\bground\b/gi, 'molido'],
];

// ---------- Libras a gramos / kilos ----------
// TheMealDB mide en libras ("1 lb", "2 Lbs", "4-5 pound", "1lb 8 oz"). Aquí se pasan a g (menos de 1 kg) o a kg.
const QTY = String.raw`\d+(?:[.,]\d+)?\s*[½¼¾⅓⅔⅛]|[½¼¾⅓⅔⅛]|\d+(?:[.,]\d+)?(?:\s+\d+\/\d+)?|\d+\/\d+`; // 1, 1.5, 1/2, 1 1/2, ½, 1½
const FRACTIONS = { '½': 0.5, '¼': 0.25, '¾': 0.75, '⅓': 1 / 3, '⅔': 2 / 3, '⅛': 0.125 };
const LB_UNIT = String.raw`(?:lbs?|pounds?|libras?)(?![a-záéíóúñ])(\.)?`; // el punto se decide aparte: "1 lb. small" lo consume, "1 lb. Then" no
const POUNDS = new RegExp(`(${QTY})(?:\\s*(?:-|–|a|to)\\s*(${QTY}))?\\s*${LB_UNIT}(?:\\s+(${QTY})\\s*oz\\b)?`, 'gi');
const LOWERCASE_NEXT = /^\s+[a-záéíóúñ]/; // sin bandera "i": distingue "lb. small" (abreviatura) de "lb. Then" (fin de oración)
const METRIC_AFTER = /^\s*[/(]\s*\d[\d.,]*\s*(?:g|kg|gr|grams?|gramos?)\b/i; // "1 pound (455 grams)", "2lb/900g"
const METRIC_BEFORE = /\d[\d.,]*\s*(?:g|kg|gr|grams?|gramos?)\s*\/\s*$/i; // "650g/1lb 8 oz", "900g/2lb"
const G_PER_LB = 453.592;
const G_PER_OZ = 28.3495;

const toNumber = (text) => text.trim().replace(',', '.').replace(/[½¼¾⅓⅔⅛]/g, (f) => ` ${FRACTIONS[f]}`).split(/\s+/).filter(Boolean).reduce((sum, part) => {
  if (part.includes('/')) { const [a, b] = part.split('/').map(Number); return sum + a / b; }
  return sum + Number(part);
}, 0);

/** Redondea para que se lea natural: 1 lb = 450 g, 2 lb = 900 g, 3 lb = 1,35 kg. */
function metric(grams) {
  const rounded = grams < 250 ? Math.round(grams / 5) * 5 : Math.round(grams / 25) * 25;
  if (rounded < 1000) return { value: String(rounded), unit: 'g' };
  return { value: String(Math.round(grams / 50) / 20).replace('.', ','), unit: 'kg' };
}

/** Cambia las cantidades en libras de un texto por gramos o kilos. Si ya hay gramos al lado, solo quita las libras. */
export function poundsToMetric(text = '') {
  // "one pound of fish" / "una libra de pollo" -> "1 pound of fish". Solo con "of"/"de" detrás, para no tocar "a pound cake".
  const source = String(text ?? '').replace(/\b(?:one|a|un|una)\s+(pound|lb|libra)(?=\s+(?:of|de)\b)/gi, '1 $1');
  let removed = false;
  const out = source.replace(POUNDS, (match, from, to, dot, oz, offset) => {
    const before = source.slice(Math.max(0, offset - 16), offset);
    const after = source.slice(offset + match.length, offset + match.length + 24);
    // El punto de "lb." es parte de la abreviatura solo si sigue una palabra en minúscula
    const period = dot && !LOWERCASE_NEXT.test(after) ? '.' : '';
    if (METRIC_AFTER.test(after) || METRIC_BEFORE.test(before)) { removed = true; return period; }
    const low = metric(toNumber(from) * G_PER_LB + (oz ? toNumber(oz) * G_PER_OZ : 0));
    if (!to) return `${low.value} ${low.unit}${period}`;
    const high = metric(toNumber(to) * G_PER_LB);
    return (low.unit === high.unit ? `${low.value} a ${high.value} ${high.unit}` : `${low.value} ${low.unit} a ${high.value} ${high.unit}`) + period;
  });
  if (!removed) return out;
  return out // limpia lo que quedó al quitar la parte en libras
    .replace(/\(\s*\)/g, '')
    .replace(/\/(?=\s|$)/g, '')
    .replace(/(^|\s)\/(?=\d)/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .replace(/^\((.+)\)$/, '$1');
}

export function measureEs(measure = '') {
  return MEASURE_RULES.reduce((text, [re, es]) => text.replace(re, es), poundsToMetric(measure)).replace(/\s+/g, ' ').trim();
}
