import { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import Stars from './Stars.jsx';

const EMPTY = { note: '', rating: null, cooked: false };

/** "Mi cocina": calificación de 1 a 5 estrellas y marca de "ya la cociné" para una receta. Se guarda en MySQL al tocar. */
export default function RecipeNotes({ recipe, user, onNeedLogin, notify }) {
  const [saved, setSaved] = useState(EMPTY); // lo último que confirmó el servidor
  const [loading, setLoading] = useState(Boolean(user));
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState('');
  const alive = useRef(true);

  // En desarrollo, React monta dos veces cada componente: hay que volver a marcarlo como vivo al montar
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  useEffect(() => {
    if (!user) { setLoading(false); setSaved(EMPTY); return undefined; }
    let current = true;
    setLoading(true);
    setLoadError('');
    api.note(recipe.id)
      .then((n) => current && setSaved({ note: n.note ?? '', rating: n.rating ?? null, cooked: Boolean(n.cooked) }))
      .catch((e) => current && e.status !== 401 && setLoadError(e.message))
      .finally(() => current && setLoading(false));
    return () => { current = false; };
  }, [recipe.id, user]);

  const persist = async (patch, message) => {
    if (!user) { onNeedLogin('Ingresa para guardar tus calificaciones.'); return; }
    setBusy(true);
    try {
      // `note` se reenvía tal cual: las notas que ya se habían escrito antes no se pierden
      const out = await api.saveNote(recipe.id, { ...saved, ...patch, name: recipe.name, image: recipe.image });
      if (!alive.current) return;
      setSaved({ note: out.note ?? '', rating: out.rating ?? null, cooked: Boolean(out.cooked) });
      if (message) notify(message);
    } catch (e) {
      if (alive.current) notify(e.message, 'error');
    } finally {
      if (alive.current) setBusy(false);
    }
  };

  return (
    <section className="notes" aria-labelledby="notes-title">
      <h3 id="notes-title">Mi cocina</h3>
      {!user ? (
        <p className="muted">
          Califica la receta y marca cuáles ya cocinaste.{' '}
          <button className="btn-link" onClick={() => onNeedLogin('Ingresa para guardar tus calificaciones.')}>Ingresar</button>
        </p>
      ) : loading ? (
        <p className="muted" role="status">Cargando…</p>
      ) : (
        <div className="notes-body">
          {loadError && <p className="alert" role="alert">{loadError}</p>}
          <label className="check">
            <input
              type="checkbox"
              checked={saved.cooked}
              disabled={busy}
              onChange={(e) => persist({ cooked: e.target.checked }, e.target.checked ? 'Marcada como cocinada.' : 'Ya no figura como cocinada.')}
            />
            Ya la cociné
          </label>
          <div className="notes-rating">
            <span>Mi calificación</span>
            <Stars
              value={saved.rating}
              onChange={(rating) => persist({ rating }, rating ? `Le diste ${rating} ${rating === 1 ? 'estrella' : 'estrellas'}.` : 'Quitaste tu calificación.')}
            />
          </div>
        </div>
      )}
    </section>
  );
}
