import { useCallback, useEffect, useRef, useState } from 'react';
import { mergeMeasure } from './utils/measures.js';

/** useState que se guarda en localStorage (si el navegador lo bloquea, funciona igual solo en memoria). */
export function useLocalStorage(key, initial) {
  const [value, setValue] = useState(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? initial : JSON.parse(raw);
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* sin almacenamiento */ }
  }, [key, value]);
  return [value, setValue];
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const openModals = []; // la última es la que está encima: solo ella responde al teclado

/** Comportamiento de ventana modal: Escape cierra, Tab queda dentro, se bloquea el scroll y se devuelve el foco. */
export function useModal(containerRef, onClose) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const previous = document.activeElement;
    const container = containerRef.current;
    openModals.push(container);
    document.body.classList.add('no-scroll');

    const onKey = (e) => {
      if (openModals[openModals.length - 1] !== container) return;
      if (e.key === 'Escape') { closeRef.current(); return; }
      if (e.key !== 'Tab' || !container) return;
      const items = [...container.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null);
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      openModals.splice(openModals.indexOf(container), 1);
      if (!openModals.length) document.body.classList.remove('no-scroll');
      if (previous instanceof HTMLElement && document.contains(previous)) previous.focus();
    };
  }, [containerRef]);
}

/** ¿El navegador tiene internet? Se actualiza cuando la conexión vuelve o se cae. */
export function useOnline() {
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));
  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  }, []);
  return online;
}

/** Avisos breves ("Guardada en favoritos") que desaparecen solos. */
export function useToasts() {
  const [toasts, setToasts] = useState([]);
  const next = useRef(1);

  const dismiss = useCallback((id) => setToasts((list) => list.filter((t) => t.id !== id)), []);
  const notify = useCallback((message, tone = 'ok') => {
    const id = next.current++;
    setToasts((list) => [...list.slice(-3), { id, message, tone }]);
    setTimeout(() => dismiss(id), 4000);
  }, [dismiss]);

  return { toasts, notify, dismiss };
}

const strip = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();

/** Lista de compras del visitante: junta los ingredientes de varias recetas y suma las medidas repetidas. */
export function useCart() {
  const [items, setItems] = useLocalStorage('spc_cart', []);

  // Devuelve cuántos ingredientes eran nuevos (los repetidos solo suman medida y receta).
  const add = useCallback((incoming, recipeName = '') => {
    const next = items.map((i) => ({ ...i, recipes: [...i.recipes] }));
    let added = 0;
    for (const { name, measure = '' } of incoming) {
      const key = strip(name);
      if (!key) continue;
      const found = next.find((i) => i.key === key);
      if (found) {
        if (measure) found.measure = mergeMeasure(found.measure, measure); // "200 g" + "300 g" = "500 g"
        if (recipeName && !found.recipes.includes(recipeName)) found.recipes.push(recipeName);
        found.bought = false;
      } else {
        next.push({ key, name, measure, recipes: recipeName ? [recipeName] : [], bought: false });
        added += 1;
      }
    }
    setItems(next);
    return added;
  }, [items, setItems]);

  const toggle = useCallback((key) => setItems((l) => l.map((i) => (i.key === key ? { ...i, bought: !i.bought } : i))), [setItems]);
  const remove = useCallback((key) => setItems((l) => l.filter((i) => i.key !== key)), [setItems]);
  const clearBought = useCallback(() => setItems((l) => l.filter((i) => !i.bought)), [setItems]);
  const clear = useCallback(() => setItems([]), [setItems]);

  return { items, add, toggle, remove, clearBought, clear, pending: items.filter((i) => !i.bought) };
}

export const PLAN_MIN = 3;
export const PLAN_MAX = 7;

/** Plan semanal del visitante: de 3 a 7 recetas, cada una con sus porciones (2, 4 o 6). Se guarda en el navegador. */
export function usePlan() {
  const [meals, setMeals] = useLocalStorage('spc_plan', []);

  // Devuelve 'added', 'exists' o 'full' para que la pantalla avise lo que pasó
  const add = useCallback((recipe, servings = 2) => {
    if (meals.some((m) => m.id === recipe.id)) return 'exists';
    if (meals.length >= PLAN_MAX) return 'full';
    setMeals([...meals, { id: recipe.id, name: recipe.name, image: recipe.image ?? null, servings }]);
    return 'added';
  }, [meals, setMeals]);
  const remove = useCallback((id) => setMeals((l) => l.filter((m) => m.id !== id)), [setMeals]);
  const setServings = useCallback((id, servings) => setMeals((l) => l.map((m) => (m.id === id ? { ...m, servings } : m))), [setMeals]);
  const clear = useCallback(() => setMeals([]), [setMeals]);

  return { meals, add, remove, setServings, clear, has: (id) => meals.some((m) => m.id === id) };
}

const SPANISH_VOICES = ['es-PE', 'es-MX', 'es-US', 'es-419', 'es-AR', 'es-CO', 'es-ES'];

/** Lectura en voz alta con la Web Speech API del propio navegador (sin servicios de pago). */
export function useSpeech() {
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';
  const [speaking, setSpeaking] = useState(false);
  const voice = useRef(null);
  const run = useRef(0); // cada lectura nueva invalida los avisos de la anterior

  useEffect(() => {
    if (!supported) return undefined;
    const synth = window.speechSynthesis;
    const pick = () => {
      const voices = synth.getVoices();
      const byLang = (lang) => voices.find((v) => v.lang.replace('_', '-').toLowerCase() === lang.toLowerCase());
      voice.current = SPANISH_VOICES.map(byLang).find(Boolean) ?? voices.find((v) => v.lang.toLowerCase().startsWith('es')) ?? null;
    };
    pick();
    synth.addEventListener?.('voiceschanged', pick);
    return () => { synth.removeEventListener?.('voiceschanged', pick); synth.cancel(); };
  }, [supported]);

  const stop = useCallback(() => {
    if (!supported) return;
    run.current += 1;
    window.speechSynthesis.cancel();
    setSpeaking(false);
  }, [supported]);

  // Chrome corta las lecturas largas: el texto se divide en frases y se encolan una tras otra
  const speak = useCallback((text, onEnd) => {
    if (!supported || !text) return false;
    const synth = window.speechSynthesis;
    synth.cancel();
    const id = (run.current += 1);
    const parts = String(text).match(/[^.!?;:]+[.!?;:]*\s*/g)?.map((s) => s.trim()).filter(Boolean) ?? [String(text)];
    parts.forEach((part, i) => {
      const u = new SpeechSynthesisUtterance(part);
      u.lang = voice.current?.lang || 'es-ES';
      if (voice.current) u.voice = voice.current;
      u.rate = 0.95;
      if (i === parts.length - 1) u.onend = () => { if (run.current === id) { setSpeaking(false); onEnd?.(); } };
      u.onerror = () => { if (run.current === id) setSpeaking(false); };
      synth.speak(u);
    });
    setSpeaking(true);
    return true;
  }, [supported]);

  return { supported, speaking, speak, stop };
}

/** Mantiene la pantalla encendida mientras `active` (Wake Lock API). Devuelve 'on', 'off' o 'unsupported'. */
export function useWakeLock(active) {
  const [state, setState] = useState('off');
  useEffect(() => {
    if (!active) return undefined;
    if (typeof navigator === 'undefined' || !('wakeLock' in navigator)) { setState('unsupported'); return undefined; }
    let lock = null;
    let cancelled = false;
    const request = async () => {
      try {
        lock = await navigator.wakeLock.request('screen');
        if (cancelled) { lock.release().catch(() => {}); return; }
        setState('on');
        lock.addEventListener('release', () => setState('off'));
      } catch {
        setState('off'); // el navegador lo rechazó (por ejemplo, con poca batería)
      }
    };
    // El navegador suelta el bloqueo al cambiar de pestaña: se pide otra vez al volver
    const onVisible = () => { if (document.visibilityState === 'visible') request(); };
    request();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      lock?.release().catch(() => {});
    };
  }, [active]);
  return state;
}

/** Botón "Instalar app": el navegador avisa con beforeinstallprompt cuando la PWA se puede instalar. */
export function useInstallPrompt() {
  const [prompt, setPrompt] = useState(null);
  useEffect(() => {
    const onPrompt = (e) => { e.preventDefault(); setPrompt(e); };
    const onInstalled = () => setPrompt(null);
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);
  const install = useCallback(async () => {
    if (!prompt) return;
    prompt.prompt();
    await prompt.userChoice.catch(() => {});
    setPrompt(null);
  }, [prompt]);
  return { canInstall: Boolean(prompt), install };
}
