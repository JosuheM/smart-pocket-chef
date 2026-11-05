import { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import Stars from './Stars.jsx';

const EMPTY = { note: '', rating: null, cooked: false };

/** "Mi cocina": nota personal, calificación de 1 a 5 y marca de "ya la cociné" para una receta. Se guarda en MySQL. */
export default function RecipeNotes({ recipe, user, onNeedLogin, notify }) {
  const [saved, setSaved] = useState(EMPTY); // lo último que confirmó el servidor
  const [draft, setDraft] = useState(EMPTY);
  const [loading, setLoading] = useState(Boolean(user));
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState('');
  const alive = useRef(true);

  // En desarrollo, React monta dos veces cada componente: hay que volver a marcarlo como vivo al montar
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  useEffect(() => {
    if (!user) { setLoading(false); setSaved(EMPTY); setDraft(EMPTY); return undefined; }
    let current = true;
    setLoading(true);
    setLoadError('');
    api.note(recipe.id)
      .then((n) => {
        if (!current) return;
        const value = { note: n.note ?? '', rating: n.rating ?? null, cooked: Boolean(n.cooked) };
        setSaved(value);
        setDraft(value);
      })
      .catch((e) => current && e.status !== 401 && setLoadError(e.message))
      .finally(() => current && setLoading(false));
    return () => { current = false; };
  }, [recipe.id, user]);

  const dirty = draft.note !== saved.note;

  const persist = async (next, message) => {
    if (!user) { onNeedLogin('Ingresa para guardar tus notas y calificaciones.'); return; }
    setDraft(next);
    setBusy(true);
    try {
      const out = await api.saveNote(recipe.id, { ...next, name: recipe.name, image: recipe.image });
      if (!alive.current) return;
      const value = { note: out.note ?? '', rating: out.rating ?? null, cooked: Boolean(out.cooked) };
      setSaved(value);
      setDraft(value);
      if (message) notify(message);
    } catch (e) {
      if (alive.current) { setDraft(saved); notify(e.message, 'error'); }
    } finally {
      if (alive.current) setBusy(false);
    }
  };

  return (
    <section className="notes" aria-labelledby="notes-title">
      <h3 id="notes-title">Mi cocina</h3>
      {!user ? (
        <p className="muted">
          Guarda una nota personal (“le puse menos sal”), califica la receta y marca cuáles ya cocinaste.{' '}
          <button className="btn-link" onClick={() => onNeedLogin('Ingresa para guardar tus notas y calificaciones.')}>Ingresar</button>
        </p>
      ) : loading ? (
        <p className="muted" role="status">Cargando tus notas…</p>
      ) : (
        <div className="notes-body">
          {loadError && <p className="alert" role="alert">{loadError}</p>}
          <label className="check">
            <input type="checkbox" checked={draft.cooked} disabled={busy} onChange={(e) => persist({ ...draft, note: saved.note, cooked: e.target.checked }, e.target.checked ? 'Marcada como cocinada.' : 'Ya no figura como cocinada.')} />
            Ya la cociné
          </label>
          <div className="notes-rating">
            <span>Mi calificación</span>
            <Stars value={draft.rating} onChange={(rating) => persist({ ...draft, note: saved.note, rating }, rating ? `Le diste ${rating} ${rating === 1 ? 'estrella' : 'estrellas'}.` : 'Quitaste tu calificación.')} />
          </div>
          <label className="field">Mi nota
            <textarea
              rows={3}
              maxLength={1000}
              value={draft.note}
              placeholder="Por ejemplo: le puse menos sal y un poco más de ají."
              onChange={(e) => setDraft({ ...draft, note: e.target.value })}
            />
          </label>
          <div className="notes-actions">
            <button className="btn" disabled={busy || !dirty} onClick={() => persist({ ...draft, rating: saved.rating, cooked: saved.cooked }, 'Nota guardada.')}>
              {busy ? 'Guardando…' : 'Guardar nota'}
            </button>
            {dirty && <small className="muted">Tienes cambios sin guardar.</small>}
          </div>
        </div>
      )}
    </section>
  );
}
