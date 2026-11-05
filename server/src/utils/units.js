import { QTY, metric, poundsToMetric, toNumber } from './spanish.js';

// ---------- Onzas a gramos / mililitros y grados Fahrenheit a Celsius ----------
// TheMealDB mezcla unidades inglesas en medidas ("8 oz", "16 ounces") y en pasos ("Preheat oven to 350°F").
// toMetric() las pasa a unidades métricas con expresiones regulares; si el texto ya trae el valor métrico al lado
// ("175g/6oz", "200°C (400°F)"), solo quita la parte inglesa.

const G_PER_OZ = 28.3495;
const ML_PER_FL_OZ = 29.5735;
const LOWERCASE_NEXT = /^\s+[a-záéíóúñ]/; // "4 oz. ground" (abreviatura) frente a "4 oz. Then" (fin de oración)

const OZ_UNIT = String.raw`(fl\.?\s*oz|fluid\s+ounces?|ounces?|ozs?)(?![a-záéíóúñ])(\.)?`;
const OUNCES = new RegExp(`(${QTY})(?:\\s*(?:-|–|a|to)\\s*(${QTY}))?\\s*${OZ_UNIT}`, 'gi');
const METRIC_WORD = String.raw`(?:g|kg|gr|grams?|gramos?|ml|cl|l|litres?|liters?|litros?)`;
const METRIC_AFTER = new RegExp(String.raw`^\s*[/(]\s*\d[\d.,]*\s*${METRIC_WORD}\b`, 'i'); // "8 ounces (230 grams)"
const METRIC_BEFORE = new RegExp(String.raw`\d[\d.,]*\s*${METRIC_WORD}\s*\/\s*$`, 'i'); // "175g/6oz", "50-55 g/ 1.7-1.9 oz"

function metricVolume(ml) {
  const rounded = ml < 250 ? Math.round(ml / 5) * 5 : Math.round(ml / 25) * 25;
  if (rounded < 1000) return { value: String(rounded), unit: 'ml' };
  return { value: String(Math.round(ml / 50) / 20).replace('.', ','), unit: 'l' };
}

function tidy(text) {
  return text // limpia lo que queda al quitar la parte inglesa
    .replace(/\(\s*\)/g, '')
    .replace(/\/(?=\s|$)/g, '')
    .replace(/(^|\s)\/(?=\d)/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .replace(/^\((.+)\)$/, '$1');
}

/** "8 oz" -> "225 g"; "8 fl oz" -> "235 ml"; "175g/6oz" -> "175g". */
export function ouncesToMetric(text = '') {
  const source = String(text ?? '');
  let removed = false;
  const out = source.replace(OUNCES, (match, from, to, unit, dot, offset) => {
    const before = source.slice(Math.max(0, offset - 16), offset);
    const after = source.slice(offset + match.length, offset + match.length + 24);
    const period = dot && !LOWERCASE_NEXT.test(after) ? '.' : '';
    if (METRIC_AFTER.test(after) || METRIC_BEFORE.test(before)) { removed = true; return period; }
    const liquid = /^(fl|fluid)/i.test(unit);
    const convert = (n) => (liquid ? metricVolume(toNumber(n) * ML_PER_FL_OZ) : metric(toNumber(n) * G_PER_OZ));
    const low = convert(from);
    if (!to) return `${low.value} ${low.unit}${period}`;
    const high = convert(to);
    return (low.unit === high.unit ? `${low.value} a ${high.value} ${high.unit}` : `${low.value} ${low.unit} a ${high.value} ${high.unit}`) + period;
  });
  // "3.5 oz (100 grams) Feta": al quitar las onzas, los gramos que quedan entre paréntesis pasan a ser la cantidad
  return removed ? tidy(out).replace(new RegExp(String.raw`\((\d[\d.,]*\s*${METRIC_WORD}\b[^()]*)\)`, 'gi'), '$1') : out;
}

const DEG = String.raw`(?:\s*(?:°|º|˚)\s*|\s+(?:degrees?|grados)\s+)`; // "350°", "350 º", "350 degrees ", "350 grados "
const TEMP_C = String.raw`\d{2,3}(?:\s*(?:°|º|˚)\s*|\s+(?:degrees?|grados)\s+)C\b`; // ya en Celsius
const TEMP_F_ONE = String.raw`(\d{2,3})(${DEG})?F(?:ahrenheit)?\b`;
// Con la palabra "F" suelta ("350 F") solo se acepta de 100 en adelante, para no confundirla con otra cosa
const BARE_F = new RegExp(String.raw`(\d{3})\s+F(?:ahrenheit)?\b`, 'g');
const FAHRENHEIT_RANGE = new RegExp(String.raw`(\d{2,3})(?:\s*(?:°|º|˚)\s*F?)?\s*(?:-|–|to|a)\s*(\d{2,3})${DEG}F(?:ahrenheit)?\b`, 'gi');
const FAHRENHEIT = new RegExp(TEMP_F_ONE, 'gi');
// "200°C (400°F)" y "400ºF (200ºC)": se queda el Celsius
const C_THEN_F = new RegExp(String.raw`(${TEMP_C})\s*\(\s*\d{2,3}(?:\s*(?:°|º|˚)\s*|\s+(?:degrees?|grados)\s+)?F(?:ahrenheit)?\s*\)`, 'gi');
const F_THEN_C = new RegExp(String.raw`\d{2,3}(?:\s*(?:°|º|˚)\s*|\s+(?:degrees?|grados)\s+)?F(?:ahrenheit)?\s*\(\s*(${TEMP_C})\s*\)`, 'gi');

const celsius = (f) => Math.round((((Number(f) - 32) * 5) / 9) / 5) * 5; // de 5 en 5: 350°F = 175 °C

/** "350°F", "350 degrees F", "350 F", "350-375°F" -> "175 °C", "175 a 190 °C". Si ya está en Celsius, quita los Fahrenheit. */
export function fahrenheitToCelsius(text = '') {
  return String(text ?? '')
    .replace(C_THEN_F, '$1')
    .replace(F_THEN_C, '$1')
    .replace(FAHRENHEIT_RANGE, (_, a, b) => `${celsius(a)} a ${celsius(b)} °C`)
    .replace(FAHRENHEIT, (match, n, deg) => (deg || Number(n) >= 100 ? `${celsius(n)} °C` : match))
    .replace(BARE_F, (_, n) => `${celsius(n)} °C`);
}

/** Pasa libras, onzas y grados Fahrenheit del texto a gramos, mililitros, kilos y grados Celsius. */
export const toMetric = (text = '') => fahrenheitToCelsius(ouncesToMetric(poundsToMetric(text)));
