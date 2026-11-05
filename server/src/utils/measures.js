// Cantidades de las medidas ("1/2 taza", "200 g", "2 dientes, picados"): escalar a otro número de porciones y sumar
// medidas repetidas de una lista de compras. Hay una copia idéntica en client/src/utils/measures.js (el escalado
// se hace en el navegador al cambiar de porciones); si cambias una, cambia la otra.

const FRACTIONS = { '½': 0.5, '¼': 0.25, '¾': 0.75, '⅓': 1 / 3, '⅔': 2 / 3, '⅛': 0.125 };
const NUM = String.raw`\d+(?:[.,]\d+)?\s*[½¼¾⅓⅔⅛]|[½¼¾⅓⅔⅛]|\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:[.,]\d+)?`; // 1½, ½, 1 1/2, 1/2, 1,5
const LEAD = new RegExp(`^(${NUM})(?:\\s*(?:-|–|a|to)\\s*(${NUM}))?(\\s*)(.*)$`, 'is');
const UNIT = /^([a-zA-ZáéíóúñÁÉÍÓÚÑ]+\.?)(.*)$/s;
const ABOUT = new RegExp(`\\((unos|aprox\\.?|aproximadamente|about)\\s+(\\d+(?:[.,]\\d+)?)`, 'gi'); // "(unos 10 limones)"

const toNumber = (text) => String(text).trim().replace(',', '.').replace(/[½¼¾⅓⅔⅛]/g, (f) => ` ${FRACTIONS[f]}`).split(/\s+/).filter(Boolean)
  .reduce((sum, part) => {
    if (part.includes('/')) { const [a, b] = part.split('/').map(Number); return sum + a / b; }
    return sum + Number(part);
  }, 0);

// Unidades que cambian a plural cuando la cantidad pasa de 1
const PLURALS = {
  diente: 'dientes', taza: 'tazas', rebanada: 'rebanadas', pieza: 'piezas', lata: 'latas', ramita: 'ramitas', paquete: 'paquetes',
  manojo: 'manojos', hoja: 'hojas', pizca: 'pizcas', puñado: 'puñados', barra: 'barras', lámina: 'láminas', grande: 'grandes',
  mediano: 'medianos', pequeño: 'pequeños', entero: 'enteros', trozo: 'trozos', cabeza: 'cabezas', rama: 'ramas', filete: 'filetes',
  loncha: 'lonchas', chorrito: 'chorritos', gajo: 'gajos', sobre: 'sobres', frasco: 'frascos',
};
const SINGULARS = Object.fromEntries(Object.entries(PLURALS).map(([one, many]) => [many, one]));

/** Clave para comparar unidades: "Dientes" y "diente" son lo mismo; "cda." y "cda" también. */
const unitKey = (unit) => {
  const u = unit.toLowerCase().replace(/\.$/, '');
  return SINGULARS[u] ?? u;
};

const quarter = (v) => {
  const q = Math.max(0.25, Math.round(v * 4) / 4);
  const whole = Math.floor(q);
  const frac = ['', '1/4', '1/2', '3/4'][Math.round((q - whole) * 4)];
  return whole && frac ? `${whole} ${frac}` : whole ? String(whole) : frac;
};

const comma = (n) => String(n).replace('.', ',');

/** Escribe una cantidad con el formato que corresponde a su unidad: gramos y mililitros redondeados, kilos y litros con coma, el resto en cuartos. */
function format(value, unit) {
  const key = unitKey(unit);
  if (key === 'g' || key === 'ml') {
    if (value >= 1000) return { text: comma(Math.round(value / 50) / 20), unit: key === 'g' ? 'kg' : 'l' };
    return { text: String(Math.max(5, value < 250 ? Math.round(value / 5) * 5 : Math.round(value / 25) * 25)), unit };
  }
  if (key === 'kg' || key === 'l') {
    if (value < 1) return { text: String(Math.max(5, Math.round((value * 1000) / 25) * 25)), unit: key === 'kg' ? 'g' : 'ml' };
    return { text: comma(Math.round(value * 20) / 20), unit };
  }
  const text = value >= 10 ? String(Math.round(value)) : quarter(value);
  const plural = PLURALS[key];
  return { text, unit: plural ? (value > 1 ? plural : key) : unit };
}

function parse(measure) {
  const m = LEAD.exec(String(measure ?? '').trim());
  if (!m) return null;
  const [, lo, hi, space, rest] = m;
  const u = UNIT.exec(rest);
  return { lo: toNumber(lo), hi: hi ? toNumber(hi) : null, space, unit: u ? u[1] : '', tail: u ? u[2] : rest };
}

const compose = (p, value, hiValue = null) => {
  const lo = format(value, p.unit);
  const hi = hiValue === null ? null : format(hiValue, p.unit);
  let body;
  if (!hi) body = `${lo.text}${p.space}${lo.unit}`;
  else if (hi.unit === lo.unit) body = `${lo.text} a ${hi.text}${p.space}${lo.unit}`;
  else body = `${lo.text}${p.space}${lo.unit} a ${hi.text}${p.space}${hi.unit}`;
  return `${body}${p.tail}`.replace(/\s+/g, ' ').trim();
};

/** "1/2 taza" x 3 -> "1 1/2 tazas"; "200 g" x 2 -> "400 g"; "al gusto" se queda igual. */
export function scaleMeasure(measure, factor) {
  const text = String(measure ?? '');
  if (!factor || factor === 1) return text;
  const p = parse(text);
  if (!p) return text;
  const scaled = compose(p, p.lo * factor, p.hi === null ? null : p.hi * factor);
  return scaled.replace(ABOUT, (_, word, n) => `(${word} ${Math.max(1, Math.round(toNumber(n) * factor))}`);
}

/** Suma dos medidas del mismo ingrediente si tienen la misma unidad ("200 g" + "300 g" = "500 g"); si no, devuelve null. */
export function sumMeasures(a, b) {
  const pa = parse(a);
  const pb = parse(b);
  if (!pa || !pb || pa.hi !== null || pb.hi !== null) return null;
  const base = (p) => {
    const key = unitKey(p.unit);
    if (key === 'kg') return { key: 'g', n: p.lo * 1000 };
    if (key === 'l') return { key: 'ml', n: p.lo * 1000 };
    return { key, n: p.lo };
  };
  const x = base(pa);
  const y = base(pb);
  if (x.key !== y.key || pa.tail.trim().toLowerCase() !== pb.tail.trim().toLowerCase()) return null;
  const unit = x.key === 'g' || x.key === 'ml' ? x.key : pa.unit;
  return compose({ ...pa, unit }, x.n + y.n);
}

/** Junta una medida nueva a las que ya tiene un ingrediente ("200 g + 1 taza"): suma las que son iguales y apila las demás. */
export function mergeMeasure(existing, incoming) {
  if (!incoming) return existing;
  if (!existing) return incoming;
  const parts = existing.split(' + ');
  for (let i = 0; i < parts.length; i += 1) {
    const sum = sumMeasures(parts[i], incoming);
    if (sum) { parts[i] = sum; return parts.join(' + '); }
    if (parts[i] === incoming) return existing; // "al gusto" repetido
  }
  return [...parts, incoming].join(' + ');
}
