// QuickChart (API 3): el backend limpia la lista, la convierte en texto y construye la URL del QR.
// La imagen la descarga el navegador del usuario directamente desde QuickChart.
import { mergeMeasure } from '../utils/measures.js';

const MAX_ITEMS = 200;
const MAX_TEXT = 900; // un QR con más texto se vuelve difícil de escanear

const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const squash = (v) => String(v ?? '').replace(/\s+/g, ' ').trim();

/** Limpia la lista cruda del frontend: recorta, quita vacíos y duplicados. Acepta "Ajo" o { name, measure }. */
export function cleanItems(raw) {
  if (!Array.isArray(raw)) return [];
  const byKey = new Map();
  for (const entry of raw.slice(0, MAX_ITEMS)) {
    const isObj = entry && typeof entry === 'object';
    const name = squash(isObj ? entry.name : entry).slice(0, 60);
    if (!name) continue;
    const measure = isObj ? squash(entry.measure).slice(0, 40) : '';
    const key = name.toLowerCase();
    const prev = byKey.get(key);
    if (!prev) {
      byKey.set(key, { name: capitalize(name), measure });
    } else if (measure) {
      // El mismo ingrediente en dos recetas: "200 g" y "300 g" se suman a "500 g"; si las unidades son distintas se apilan ("200 g + 1 taza")
      prev.measure = mergeMeasure(prev.measure, measure).slice(0, 60);
    }
  }
  return [...byKey.values()];
}

export function formatList(items, title = '') {
  const header = title ? `Lista de compras: ${title}` : 'Lista de compras';
  const lines = items.map((i) => `- ${i.name}${i.measure ? ` (${i.measure})` : ''}`);
  return [header, ...lines].join('\n');
}

/** Construye la URL del endpoint de QuickChart con el texto ya codificado. */
export function buildQrUrl(text, size = 320) {
  return `https://quickchart.io/qr?text=${encodeURIComponent(text)}&size=${size}&margin=2&ecLevel=M&format=png`;
}

export function buildShoppingList(raw, title = '', { maxText = MAX_TEXT } = {}) {
  const all = cleanItems(raw);
  let items = all;
  let text = formatList(items, title);
  while (text.length > maxText && items.length > 1) {
    items = items.slice(0, -1);
    text = formatList(items, title);
  }
  // Cuanto más texto, más densa es la imagen: se pide más grande para que el celular la lea bien.
  const size = text.length > 1000 ? 640 : text.length > 600 ? 480 : text.length > 350 ? 400 : 320;
  return { items, text, qrUrl: buildQrUrl(text, size), omitted: all.length - items.length };
}
