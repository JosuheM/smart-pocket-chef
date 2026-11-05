import { useCallback, useEffect, useRef, useState } from 'react';
import { useModal, useSpeech, useWakeLock } from '../hooks.js';

/**
 * Busca tiempos en el texto de un paso ("20 minutos", "1 a 2 horas", "30 segundos", "media hora") y los devuelve en segundos.
 * Con un rango ("10 a 15 minutos") se toma el mayor. También entiende el inglés por si el paso no se pudo traducir.
 */
const TIME = /(\d+(?:[.,]\d+)?)(?:\s*(?:-|–|a|to|o)\s*(\d+(?:[.,]\d+)?))?\s*(segundos?|segs?\.?|minutos?|mins?\.?|horas?|hrs?\.?|seconds?|secs?|minutes?|hours?)(?![a-záéíóúñ])/gi;
const UNIT_SECONDS = (unit) => (/^h/i.test(unit) ? 3600 : /^m/i.test(unit) ? 60 : 1);

const WORDS = { un: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, quince: 15, veinte: 20, treinta: 30 };
const WORD_TIME = new RegExp(`\\b(${Object.keys(WORDS).join('|')})\\b(?=\\s+(?:segundos?|minutos?|horas?)(?![a-záéíóúñ]))`, 'gi');

export function findTimes(step) {
  const found = new Map();
  // "un minuto", "dos horas": las palabras se pasan a número para poder leer el tiempo
  const text = String(step ?? '').replace(WORD_TIME, (w) => String(WORDS[w.toLowerCase()]));
  for (const m of text.matchAll(TIME)) {
    const value = Number((m[2] ?? m[1]).replace(',', '.'));
    const seconds = Math.round(value * UNIT_SECONDS(m[3]));
    if (seconds >= 5 && seconds <= 12 * 3600 && !found.has(seconds)) found.set(seconds, m[0].trim());
  }
  if (/media hora|half an hour/i.test(text) && !found.has(1800)) found.set(1800, 'media hora');
  return [...found.entries()].slice(0, 3).map(([seconds, label]) => ({ seconds, label }));
}

export const clock = (total) => {
  const s = Math.max(0, Math.ceil(total));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const pad = (n) => String(n).padStart(2, '0');
  return h ? `${h}:${pad(m)}:${pad(s % 60)}` : `${pad(m)}:${pad(s % 60)}`;
};

/** Pitido corto con Web Audio (sin archivos de sonido). */
function beep(ctx) {
  if (!ctx) return;
  for (let i = 0; i < 4; i += 1) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime + i * 0.35);
    gain.gain.exponentialRampToValueAtTime(0.4, ctx.currentTime + i * 0.35 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * 0.35 + 0.25);
    osc.connect(gain).connect(ctx.destination);
    osc.start(ctx.currentTime + i * 0.35);
    osc.stop(ctx.currentTime + i * 0.35 + 0.3);
  }
}

/**
 * Modo cocina: pantalla completa (Fullscreen API), pantalla siempre encendida (Wake Lock), un paso a la vez con letra
 * grande, temporizadores detectados en el texto y lectura en voz alta (Web Speech API).
 */
export default function KitchenMode({ recipe, onClose, notify }) {
  const steps = recipe.steps;
  const [index, setIndex] = useState(0);
  const [timers, setTimers] = useState([]); // { key, label, total, remaining, endsAt, running, done, step }
  const [autoRead, setAutoRead] = useState(false);
  const [showIngredients, setShowIngredients] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const ref = useRef(null);
  const audio = useRef(null);
  const wake = useWakeLock(true);
  const speech = useSpeech();
  const fullscreenAvailable = typeof document !== 'undefined' && Boolean(document.documentElement.requestFullscreen);

  useModal(ref, onClose);

  // ---------- Pantalla completa ----------
  useEffect(() => {
    const onChange = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onChange);
    ref.current?.requestFullscreen?.().catch(() => {}); // algunos navegadores lo rechazan: el modo cocina igual ocupa toda la ventana
    return () => {
      document.removeEventListener('fullscreenchange', onChange);
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    };
  }, []);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else ref.current?.requestFullscreen?.().catch(() => notify('Tu navegador no permitió la pantalla completa.', 'error'));
  };

  // ---------- Pasos ----------
  const go = useCallback((delta) => setIndex((i) => Math.min(steps.length - 1, Math.max(0, i + delta))), [steps.length]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
      if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); go(1); }
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); go(-1); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [go]);

  // ---------- Voz ----------
  const read = () => (speech.speaking ? speech.stop() : speech.speak(steps[index]));
  useEffect(() => {
    if (autoRead) speech.speak(steps[index]);
    else speech.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, autoRead]);

  // ---------- Temporizadores ----------
  const ring = useCallback((timer) => {
    beep(audio.current);
    navigator.vibrate?.([300, 150, 300, 150, 300]);
    notify(`¡Tiempo cumplido! ${timer.label} (paso ${timer.step + 1}).`);
  }, [notify]);

  const timersRef = useRef(timers);
  timersRef.current = timers;
  const anyRunning = timers.some((t) => t.running);
  useEffect(() => {
    if (!anyRunning) return undefined;
    const id = setInterval(() => {
      const now = Date.now();
      // Se calcula con la copia actual (no dentro del actualizador) para que cada aviso suene una sola vez
      const finished = timersRef.current.filter((t) => t.running && t.endsAt <= now);
      setTimers((list) => list.map((t) => {
        if (!t.running) return t;
        const remaining = Math.ceil((t.endsAt - now) / 1000);
        return remaining > 0 ? { ...t, remaining } : { ...t, remaining: 0, running: false, done: true };
      }));
      finished.forEach(ring);
    }, 500);
    return () => clearInterval(id);
  }, [anyRunning, ring]);

  const startTimer = ({ seconds, label }) => {
    // El navegador solo deja sonar audio después de un toque del usuario: el contexto se crea aquí
    if (!audio.current && (window.AudioContext || window.webkitAudioContext)) {
      audio.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    audio.current?.resume?.();
    const key = `${index}-${seconds}`;
    setTimers((list) => [
      ...list.filter((t) => t.key !== key),
      { key, label, total: seconds, remaining: seconds, endsAt: Date.now() + seconds * 1000, running: true, done: false, step: index },
    ]);
  };
  const pauseTimer = (key) => setTimers((list) => list.map((t) => (t.key === key ? { ...t, running: false } : t)));
  const resumeTimer = (key) => setTimers((list) => list.map((t) => (t.key === key ? { ...t, running: true, endsAt: Date.now() + t.remaining * 1000 } : t)));
  const dropTimer = (key) => setTimers((list) => list.filter((t) => t.key !== key));
  useEffect(() => () => { audio.current?.close?.().catch(() => {}); }, []);

  const times = findTimes(steps[index]);
  const last = index === steps.length - 1;

  return (
    <div ref={ref} className="kitchen" role="dialog" aria-modal="true" aria-label={`Modo cocina: ${recipe.name}`}>
      <header className="kitchen-bar">
        <div>
          <strong>{recipe.name}</strong>
          <span className="kitchen-count" aria-live="polite">Paso {index + 1} de {steps.length}</span>
        </div>
        <div className="kitchen-tools">
          {wake === 'on' && <span className="kitchen-chip" title="La pantalla no se apagará">Pantalla activa</span>}
          {wake === 'unsupported' && <span className="kitchen-chip" data-warn="" title="Tu navegador no permite mantener la pantalla encendida">Se puede apagar</span>}
          {recipe.ingredients?.length > 0 && (
            <button className="kitchen-btn" aria-pressed={showIngredients} onClick={() => setShowIngredients((v) => !v)}>Ingredientes</button>
          )}
          {fullscreenAvailable && <button className="kitchen-btn" onClick={toggleFullscreen}>{fullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}</button>}
          <button className="kitchen-btn" onClick={onClose}>Cerrar</button>
        </div>
      </header>

      <div className="kitchen-progress" role="progressbar" aria-valuemin={1} aria-valuemax={steps.length} aria-valuenow={index + 1} aria-label="Avance de la receta">
        <i style={{ width: `${((index + 1) / steps.length) * 100}%` }} />
      </div>

      <main className="kitchen-main">
        {showIngredients ? (
          <ul className="kitchen-ings">
            {recipe.ingredients.map((ing, i) => (
              <li key={i}><span>{ing.name}</span>{ing.measure && <em>{ing.measure}</em>}</li>
            ))}
          </ul>
        ) : (
          <p className="kitchen-step" key={index}>{steps[index]}</p>
        )}

        {!showIngredients && times.length > 0 && (
          <div className="kitchen-times">
            {times.map((t) => {
              const timer = timers.find((x) => x.key === `${index}-${t.seconds}`);
              if (!timer) return <button key={t.seconds} className="kitchen-btn kitchen-btn-main" onClick={() => startTimer(t)}>Iniciar temporizador: {t.label}</button>;
              return (
                <div key={t.seconds} className="kitchen-timer" data-done={timer.done ? '' : undefined}>
                  <strong aria-label={`Quedan ${clock(timer.remaining)}`}>{timer.done ? '¡Listo!' : clock(timer.remaining)}</strong>
                  {!timer.done && (timer.running
                    ? <button className="kitchen-btn" onClick={() => pauseTimer(timer.key)}>Pausar</button>
                    : <button className="kitchen-btn" onClick={() => resumeTimer(timer.key)}>Seguir</button>)}
                  <button className="kitchen-btn" onClick={() => startTimer(t)}>Reiniciar</button>
                  <button className="kitchen-btn" onClick={() => dropTimer(timer.key)}>Quitar</button>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {timers.filter((t) => t.step !== index).length > 0 && (
        <ul className="kitchen-others" aria-label="Otros temporizadores">
          {timers.filter((t) => t.step !== index).map((t) => (
            <li key={t.key} data-done={t.done ? '' : undefined}>
              <button className="kitchen-chip" onClick={() => setIndex(t.step)}>Paso {t.step + 1}: {t.done ? '¡listo!' : clock(t.remaining)}</button>
              <button className="kitchen-x" onClick={() => dropTimer(t.key)} aria-label={`Quitar temporizador del paso ${t.step + 1}`}>×</button>
            </li>
          ))}
        </ul>
      )}

      <footer className="kitchen-nav">
        <button className="kitchen-btn kitchen-btn-big" onClick={() => go(-1)} disabled={index === 0}>← Anterior</button>
        <div className="kitchen-voice">
          {speech.supported ? (
            <>
              <button className="kitchen-btn" onClick={read} aria-pressed={speech.speaking}>{speech.speaking ? 'Detener voz' : 'Escuchar paso'}</button>
              <label className="kitchen-check">
                <input type="checkbox" checked={autoRead} onChange={(e) => setAutoRead(e.target.checked)} />
                Leer cada paso
              </label>
            </>
          ) : (
            <small>Tu navegador no tiene lectura en voz alta.</small>
          )}
        </div>
        {last
          ? <button className="kitchen-btn kitchen-btn-big kitchen-btn-main" onClick={onClose}>¡Terminé!</button>
          : <button className="kitchen-btn kitchen-btn-big kitchen-btn-main" onClick={() => go(1)}>Siguiente →</button>}
      </footer>
    </div>
  );
}
