import { useCallback, useEffect, useRef, useState } from 'react';

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
        if (measure && !found.measure.split(' + ').includes(measure)) found.measure = found.measure ? `${found.measure} + ${measure}` : measure;
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
