import { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';

const SCRIPT = 'https://accounts.google.com/gsi/client';
let configPromise = null;
let scriptPromise = null;

// El servidor entrega el ID de cliente de Google (no es secreto): así no hay que recompilar el frontend para activarlo
const loadConfig = () => (configPromise ??= api.authConfig().catch(() => { configPromise = null; return { googleClientId: null }; }));

function loadScript() {
  if (window.google?.accounts?.id) return Promise.resolve();
  scriptPromise ??= new Promise((resolve, reject) => {
    const tag = Object.assign(document.createElement('script'), { src: SCRIPT, async: true, defer: true });
    tag.onload = resolve;
    tag.onerror = () => { scriptPromise = null; tag.remove(); reject(new Error('script')); };
    document.head.append(tag);
  });
  return scriptPromise;
}

/** Botón oficial "Continuar con Google" (Google Identity Services). No aparece si el servidor no tiene GOOGLE_CLIENT_ID. */
export default function GoogleButton({ onCredential, disabled }) {
  const box = useRef(null);
  const handler = useRef(onCredential);
  handler.current = onCredential;
  const [state, setState] = useState('loading'); // loading | ready | off | failed

  useEffect(() => {
    let alive = true;
    (async () => {
      const { googleClientId } = await loadConfig();
      if (!alive) return;
      if (!googleClientId) { setState('off'); return; }
      try {
        await loadScript();
      } catch {
        if (alive) setState('failed');
        return;
      }
      if (!alive || !box.current) return;
      window.google.accounts.id.initialize({
        client_id: googleClientId,
        callback: (response) => handler.current(response.credential),
        ux_mode: 'popup',
      });
      window.google.accounts.id.renderButton(box.current, { theme: 'outline', size: 'large', text: 'continue_with', shape: 'pill', locale: 'es', width: 320 });
      setState('ready');
    })();
    return () => { alive = false; };
  }, []);

  if (state === 'off') return null;
  return (
    <div className="google" aria-disabled={disabled ? 'true' : undefined} data-busy={disabled ? '' : undefined}>
      <div className="google-or"><span>o</span></div>
      <div ref={box} className="google-box" />
      {state === 'loading' && <small className="muted">Cargando acceso con Google…</small>}
      {state === 'failed' && <small className="muted">No pudimos cargar el acceso con Google (revisa tu conexión). Puedes usar tu correo.</small>}
    </div>
  );
}
