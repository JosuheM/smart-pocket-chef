import { createHash } from 'node:crypto';
import { config } from '../config.js';
import { getPool, isDbReady } from '../db.js';
import { mapLimit } from '../utils/http.js';

// Traduce texto. Proveedores: DeepL (si hay DEEPL_API_KEY) o MyMemory (gratis, sin registro).
// Si falla o se agota la cuota, se devuelve el texto original: la app nunca se rompe por esto.
// Cada traducción se guarda en memoria y, si hay MySQL, también en la tabla `translations`.
const memory = new Map();
const MAX_MEMORY = 8000;
const MYMEMORY_CHUNK = 450; // MyMemory acepta máximo 500 bytes por petición
let pausedUntil = 0; // si el proveedor falla, se deja de insistir unos minutos

const { enabled, deeplKey, myMemoryEmail } = config.translate;
export const provider = !enabled ? null : deeplKey ? 'deepl' : 'mymemory';

const keyOf = (dir, text) => `${dir}|${text}`;
const hashOf = (dir, text) => createHash('sha1').update(keyOf(dir, text)).digest('hex');

const ENTITIES = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&apos;': "'" };
const decode = (s) => s.replace(/&(?:amp|lt|gt|quot|apos|#39);/g, (m) => ENTITIES[m]);

/** MyMemory a veces devuelve todo en mayúsculas ("POLLO KARAAGE"): se respeta el formato del original. */
function fixCase(src, out) {
  const letters = out.replace(/[^A-Za-zÁÉÍÓÚÑáéíóúñ]/g, '');
  const shouting = letters.length > 3 && out === out.toUpperCase();
  const srcShouting = src === src.toUpperCase();
  if (shouting && !srcShouting) {
    const lower = out.toLowerCase();
    return lower.charAt(0).toUpperCase() + lower.slice(1);
  }
  return out;
}

async function viaDeepL(texts, dir) {
  const host = deeplKey.endsWith(':fx') ? 'api-free.deepl.com' : 'api.deepl.com';
  const [source, target] = dir === 'es|en' ? ['ES', 'EN-US'] : ['EN', 'ES'];
  const res = await fetch(`https://${host}/v2/translate`, {
    method: 'POST',
    headers: { Authorization: `DeepL-Auth-Key ${deeplKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: texts, source_lang: source, target_lang: target }),
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) throw new Error(`DeepL respondió ${res.status}`);
  const data = await res.json();
  return data.translations.map((t) => t.text);
}

function chunk(text) {
  if (text.length <= MYMEMORY_CHUNK) return [text];
  const parts = [];
  let current = '';
  for (const sentence of text.split(/(?<=[.!?])\s+/)) {
    if (current && (current + ' ' + sentence).length > MYMEMORY_CHUNK) { parts.push(current); current = sentence; }
    else current = current ? `${current} ${sentence}` : sentence;
  }
  if (current) parts.push(current);
  return parts.flatMap((p) => (p.length > MYMEMORY_CHUNK ? p.match(new RegExp(`.{1,${MYMEMORY_CHUNK}}`, 'g')) : [p]));
}

async function myMemoryPiece(text, dir) {
  const url = new URL('https://api.mymemory.translated.net/get');
  url.searchParams.set('q', text);
  url.searchParams.set('langpair', dir);
  if (myMemoryEmail) url.searchParams.set('de', myMemoryEmail);
  const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`MyMemory respondió ${res.status}`);
  const data = await res.json();
  const out = data.responseData?.translatedText;
  if (Number(data.responseStatus) !== 200 || !out || /MYMEMORY WARNING/i.test(out)) {
    throw new Error(data.responseDetails || 'MyMemory no pudo traducir (¿cuota diaria agotada?)');
  }
  return decode(out);
}

const viaMyMemory = async (text, dir) =>
  fixCase(text, (await Promise.all(chunk(text).map((p) => myMemoryPiece(p, dir)))).join(' '));

async function readStored(dir, texts) {
  if (!isDbReady() || !texts.length) return;
  try {
    const hashes = texts.map((t) => hashOf(dir, t));
    const [rows] = await getPool().query('SELECT hash, dst FROM translations WHERE hash IN (?)', [hashes]);
    const byHash = new Map(rows.map((r) => [r.hash, r.dst]));
    texts.forEach((t, i) => { if (byHash.has(hashes[i])) memory.set(keyOf(dir, t), byHash.get(hashes[i])); });
  } catch (err) {
    console.warn(`Traducción: no se pudo leer la caché de MySQL (${err.message}).`);
  }
}

async function writeStored(dir, pairs) {
  if (!isDbReady() || !pairs.length) return;
  try {
    const rows = pairs.map(([src, dst]) => [hashOf(dir, src), dir, src, dst, provider]);
    await getPool().query('INSERT IGNORE INTO translations (hash, direction, src, dst, provider) VALUES ?', [rows]);
  } catch (err) {
    console.warn(`Traducción: no se pudo guardar en MySQL (${err.message}).`);
  }
}

/** Traducción que ya está en memoria (sin llamar a ninguna API). */
export const peek = (text, dir = 'en|es') => memory.get(keyOf(dir, String(text ?? '').trim())) ?? null;

/**
 * Traduce una lista de textos, en el mismo orden. `dir` es 'en|es' (por defecto) o 'es|en'.
 * Los repetidos y los ya traducidos (en memoria o en MySQL) no gastan cuota.
 */
export async function translateMany(texts, dir = 'en|es') {
  const clean = texts.map((t) => String(t ?? '').trim());
  let pending = [...new Set(clean.filter((t) => t && !memory.has(keyOf(dir, t))))];

  if (pending.length) {
    await readStored(dir, pending);
    pending = pending.filter((t) => !memory.has(keyOf(dir, t)));
  }

  if (pending.length && provider && Date.now() >= pausedUntil) {
    try {
      let out;
      if (provider === 'deepl') {
        out = await viaDeepL(pending, dir);
      } else {
        out = await mapLimit(pending, 6, (t) => viaMyMemory(t, dir));
      }
      if (memory.size > MAX_MEMORY) memory.clear();
      const saved = [];
      pending.forEach((t, i) => {
        if (out[i] && out[i] !== t) { memory.set(keyOf(dir, t), out[i]); saved.push([t, out[i]]); }
      });
      await writeStored(dir, saved);
    } catch (err) {
      console.warn(`Traducción (${provider}): ${err.message}. Se muestra el texto original.`);
      pausedUntil = Date.now() + 10 * 60 * 1000;
    }
  }
  return clean.map((t) => memory.get(keyOf(dir, t)) ?? t);
}

export const translateOne = async (text, dir = 'en|es') => (await translateMany([text], dir))[0];
