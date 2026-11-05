import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import EmptyState from './EmptyState.jsx';
import { RecipeGrid } from './RecipeGrid.jsx';
import Stars from './Stars.jsx';

const MAX_ITEMS = 60;

/** Mi despensa: ingredientes guardados en la cuenta y el resumen "Hoy puedes cocinar X recetas con lo que tienes". */
export default function PantryView({ user, diet, searchTerms, favIds, onOpen, onToggleFav, onNeedLogin, onSearchWith, onTotal, notify }) {
  const [items, setItems] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [summary, setSummary] = useState(null);
  const [text, setText] = useState('');
  const [options, setOptions] = useState([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [moreBusy, setMoreBusy] = useState(false);
  const [cooked, setCooked] = useState([]);
  const dirty = useRef(false);
  const latest = useRef(0);

  const dietKey = diet.join(',');

  const refresh = useCallback(async () => {
    const id = ++latest.current;
    try {
      const data = await api.pantrySummary({ diet, limit: 12 });
      if (id !== latest.current) return;
      setSummary(data);
      onTotal?.(data.total);
      setError('');
    } catch (e) {
      if (id === latest.current && e.status !== 401) setError(e.message);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dietKey]);

  // Carga la despensa y las recetas cocinadas al entrar
  useEffect(() => {
    if (!user) { setLoaded(false); setItems([]); setSummary(null); return undefined; }
    let alive = true;
    api.pantry()
      .then((d) => { if (alive) { setItems(d.items); setLoaded(true); } })
      .catch((e) => alive && e.status !== 401 && setError(e.message));
    api.notes()
      .then((list) => alive && setCooked(list.filter((n) => n.cooked || n.rating || n.note)))
      .catch(() => {});
    return () => { alive = false; };
  }, [user]);

  // El resumen se recalcula al cargar y cuando cambia la dieta
  useEffect(() => { if (loaded) refresh(); }, [loaded, refresh]);

  // Los cambios en la lista se guardan solos (con una pequeña espera, por si se agregan varios seguidos)
  useEffect(() => {
    if (!loaded || !dirty.current) return undefined;
    const timer = setTimeout(async () => {
      setSaving(true);
      try {
        await api.savePantry(items);
        dirty.current = false;
        await refresh();
      } catch (e) {
        setError(`No pudimos guardar tu despensa. ${e.message}`);
      } finally {
        setSaving(false);
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [items, loaded, refresh]);

  // Sugerencias del buscador de ingredientes
  useEffect(() => {
    const q = text.trim();
    if (q.length < 2) { setOptions([]); return undefined; }
    let alive = true;
    const timer = setTimeout(() => api.suggest(q).then((l) => alive && setOptions(l)).catch(() => {}), 200);
    return () => { alive = false; clearTimeout(timer); };
  }, [text]);

  const change = (next) => { dirty.current = true; setItems(next); };

  const add = (raw) => {
    const names = String(raw).split(',').map((s) => s.trim()).filter(Boolean);
    const next = [...items];
    for (const name of names) {
      if (next.length >= MAX_ITEMS) { notify(`Tu despensa puede tener hasta ${MAX_ITEMS} ingredientes.`, 'error'); break; }
      if (!next.some((x) => x.toLowerCase() === name.toLowerCase())) next.push(name.slice(0, 80));
    }
    if (next.length !== items.length) change(next);
    setText('');
  };

  const showMore = async () => {
    setMoreBusy(true);
    try {
      const data = await api.pantrySummary({ diet, limit: 12, offset: summary.results.length });
      setSummary((s) => ({ ...s, results: [...s.results, ...data.results], hasMore: data.hasMore }));
    } catch (e) {
      notify(e.message, 'error');
    } finally {
      setMoreBusy(false);
    }
  };

  if (!user) {
    return (
      <EmptyState
        title="Tu despensa vive en tu cuenta"
        text="Guarda lo que tienes en casa y te decimos cuántas recetas puedes cocinar hoy, desde cualquier dispositivo."
        action={<button className="btn btn-primary" onClick={() => onNeedLogin('Ingresa para guardar tu despensa.')}>Ingresar</button>}
      />
    );
  }

  const total = summary?.total ?? 0;
  return (
    <section className="pantry-view">
      <h2 className="section-title">Mi despensa</h2>

      {error && <p className="alert" role="alert">{error}</p>}

      <div className="dashboard" aria-live="polite">
        {!loaded || !summary ? (
          <p className="muted">Calculando qué puedes cocinar…</p>
        ) : items.length === 0 ? (
          <p className="dashboard-text">Agrega lo que tienes en casa y te mostramos qué puedes cocinar hoy.</p>
        ) : (
          <>
            <p className="dashboard-text">
              Hoy puedes cocinar <strong className="dashboard-number">{total}</strong> {total === 1 ? 'receta' : 'recetas'} con lo que tienes.
            </p>
            {summary.almost > 0 && (
              <p className="muted">
                Y {summary.almost} {summary.almost === 1 ? 'más' : 'más'} si compras solo 1 o 2 ingredientes.
              </p>
            )}
            {diet.length > 0 && <p className="muted">Se aplican tus filtros de dieta.</p>}
          </>
        )}
      </div>

      <form className="pantry-add" onSubmit={(e) => { e.preventDefault(); if (text.trim()) add(text); }}>
        <label className="field">Agregar ingrediente
          <input
            list="pantry-options"
            value={text}
            maxLength={80}
            placeholder="Por ejemplo: pollo, arroz, cebolla"
            onChange={(e) => setText(e.target.value)}
            autoComplete="off"
          />
          <datalist id="pantry-options">{options.map((o) => <option key={o} value={o} />)}</datalist>
        </label>
        <button className="btn btn-primary" type="submit" disabled={!text.trim()}>Agregar</button>
      </form>

      {items.length > 0 && (
        <>
          <ul className="magnets" aria-label="Ingredientes de tu despensa">
            {items.map((name, i) => (
              <li key={name} className="magnet" data-tone={i % 3 === 1 ? '1' : i % 3 === 2 ? '2' : undefined}>
                {name}
                <button type="button" onClick={() => change(items.filter((x) => x !== name))} aria-label={`Quitar ${name} de la despensa`}>×</button>
              </li>
            ))}
          </ul>
          <div className="pantry-actions">
            <button className="btn" onClick={() => onSearchWith(items)}>Buscar recetas con mi despensa</button>
            <button className="btn-link" onClick={() => change([])}>Vaciar despensa</button>
            {saving && <small className="muted" role="status">Guardando…</small>}
          </div>
        </>
      )}

      {searchTerms.length > 0 && searchTerms.some((t) => !items.some((x) => x.toLowerCase() === t.toLowerCase())) && (
        <p className="pantry-import">
          Tienes {searchTerms.length} {searchTerms.length === 1 ? 'ingrediente' : 'ingredientes'} en el buscador.{' '}
          <button className="btn-link" onClick={() => add(searchTerms.join(','))}>Agregarlos a mi despensa</button>
        </p>
      )}

      {summary && summary.results.length > 0 && (
        <>
          <h3 className="section-title">Puedes cocinar ahora</h3>
          <RecipeGrid recipes={summary.results} favIds={favIds} onOpen={onOpen} onToggleFav={onToggleFav} />
          {summary.hasMore && (
            <div className="more">
              <button className="btn" onClick={showMore} disabled={moreBusy}>{moreBusy ? 'Cargando…' : 'Mostrar más'}</button>
            </div>
          )}
        </>
      )}
      {summary && items.length > 0 && total === 0 && (
        <p className="notice">
          Con estos ingredientes aún no completas ninguna receta. Agrega algunos más o usa “Buscar recetas con mi despensa” para ver cuáles te faltan menos.
        </p>
      )}

      {cooked.length > 0 && (
        <>
          <h3 className="section-title">Mis notas y recetas cocinadas</h3>
          <ul className="cooked">
            {cooked.slice(0, 12).map((n) => (
              <li key={n.mealId}>
                <button className="cooked-open" onClick={() => onOpen(n.mealId)}>
                  <span className="cooked-name">{n.name || `Receta ${n.mealId}`}{n.cooked && <em className="badge">Cocinada</em>}</span>
                  {n.rating && <Stars value={n.rating} readOnly />}
                  {n.note && <small className="muted">“{n.note.length > 90 ? `${n.note.slice(0, 90)}…` : n.note}”</small>}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
