import { useState } from 'react';
import { api } from '../api.js';

const preload = (url) => new Promise((resolve) => {
  const img = new Image();
  img.onload = img.onerror = () => resolve();
  img.src = url;
});

/**
 * Plan B sin internet: muestra qué servicio está caído y qué usa la app en su lugar, y permite guardar
 * en el navegador las recetas peruanas con sus fotos para verlas después sin conexión.
 */
export default function StatusPanel({ feedResults = [], notify }) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');

  const check = async () => {
    setBusy(true);
    setError('');
    try {
      setStatus(await api.status(true));
    } catch (e) {
      setStatus(null);
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && !status) check();
  };

  // Abre cada receta y carga cada foto una vez: el navegador las guarda y después se ven sin conexión.
  const saveOffline = async () => {
    setBusy(true);
    setError('');
    try {
      // Se piden las mismas páginas (de 12) que usa la pantalla, para que luego salgan de la copia guardada
      const first = await api.explore({ area: 'Peruvian' });
      const second = first.hasMore ? await api.explore({ area: 'Peruvian', offset: 12 }) : { results: [] };
      const peruItems = [...first.results, ...second.results];
      const items = [...peruItems, ...feedResults.filter((r) => !peruItems.some((p) => p.id === r.id))];
      await api.hero().then((h) => h?.image && preload(h.image)).catch(() => {});
      let done = 0;
      for (const item of items) {
        setProgress(`Guardando ${done + 1} de ${items.length}…`);
        const detail = await api.recipe(item.id, [], true).catch(() => null);
        await Promise.all([item.image && preload(item.image), detail?.image && preload(detail.image)].filter(Boolean));
        done += 1;
      }
      setProgress('');
      notify(`Listo: ${items.length} recetas con sus fotos guardadas para usar sin internet.`);
    } catch (e) {
      setProgress('');
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const rows = status ? [...Object.values(status.services), status.database] : [];

  return (
    <div className="status">
      <button className="btn-link" onClick={toggle} aria-expanded={open}>
        {open ? 'Ocultar estado de los servicios' : 'Estado de los servicios y modo sin internet'}
      </button>

      {open && (
        <div className="status-body">
          {error && <p className="alert" role="alert">{error}</p>}
          {status && (
            <>
              <ul className="status-list">
                {rows.map((s) => (
                  <li key={s.label} data-up={s.up ? '' : undefined}>
                    <span className="dot" aria-hidden="true" />
                    <strong>{s.label}</strong>
                    <span>{s.up ? (s.ms ? `responde (${s.ms} ms)` : s.note ?? 'activo') : `sin respuesta${s.note ? `: ${s.note}` : ''}`}</span>
                    {!s.up && <em>Plan B: {s.fallback}</em>}
                  </li>
                ))}
              </ul>
              <p className="muted">
                {status.catalog.partial
                  ? 'El catálogo de TheMealDB no se pudo descargar: solo están las recetas propias (peruanas). Conéctate a internet una vez para sincronizarlo.'
                  : `Catálogo local: ${status.catalog.recipes} recetas, disponibles sin internet.`}
              </p>
            </>
          )}
          <div className="status-actions">
            <button className="btn" onClick={check} disabled={busy}>Volver a comprobar</button>
            <button className="btn" onClick={saveOffline} disabled={busy}>Guardar recetas para usar sin internet</button>
          </div>
          {progress && <p className="muted" role="status">{progress}</p>}
        </div>
      )}
    </div>
  );
}
