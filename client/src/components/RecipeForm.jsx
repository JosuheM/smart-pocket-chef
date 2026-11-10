import { useRef, useState } from 'react';
import { useModal } from '../hooks.js';

export const CATEGORIES = [
  ['Beef', 'Res'], ['Chicken', 'Pollo'], ['Seafood', 'Mariscos'], ['Pork', 'Cerdo'], ['Lamb', 'Cordero'], ['Goat', 'Cabra'],
  ['Pasta', 'Pasta'], ['Vegetarian', 'Vegetariano'], ['Vegan', 'Vegano'], ['Starter', 'Entrada'], ['Side', 'Acompañamiento'],
  ['Dessert', 'Postre'], ['Breakfast', 'Desayuno'], ['Miscellaneous', 'Variado'],
];
export const CATEGORY_LABEL = Object.fromEntries(CATEGORIES);

export const EMPTY_RECIPE = { name: '', nameEn: '', category: 'Beef', photo: '', ingredients: [{ es: '', measure: '', name: '' }], steps: [''] };

/**
 * Formulario para crear o corregir una receta (lo usan el panel de administración y "Mis recetas").
 * `save(form)` guarda y puede lanzar un error con `status`; `onSaved(mensaje)` se llama al terminar bien.
 * Con `adminFields` aparecen el nombre en inglés y la búsqueda de foto, que solo tienen sentido en las recetas peruanas.
 */
export default function RecipeForm({ title, submitLabel, initial, adminFields = false, save, onClose, onSaved, onForbidden }) {
  const [form, setForm] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const ref = useRef(null);
  useModal(ref, busy ? () => {} : onClose);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const setItem = (list, i, patch) => setForm((f) => ({ ...f, [list]: f[list].map((x, k) => (k === i ? (typeof x === 'string' ? patch : { ...x, ...patch }) : x)) }));
  const addItem = (list, blank) => setForm((f) => ({ ...f, [list]: [...f[list], blank] }));
  const removeItem = (list, i) => setForm((f) => ({ ...f, [list]: f[list].filter((_, k) => k !== i) }));
  const moveStep = (i, delta) => setForm((f) => {
    const steps = [...f.steps];
    const j = i + delta;
    if (j < 0 || j >= steps.length) return f;
    [steps[i], steps[j]] = [steps[j], steps[i]];
    return { ...f, steps };
  });

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      onSaved(await save(form));
    } catch (err) {
      if (onForbidden && (err.status === 401 || err.status === 403)) onForbidden(err);
      else setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="backdrop backdrop-top" onClick={busy ? undefined : onClose} />
      <form ref={ref} className="dialog dialog-wide recipe-form" role="dialog" aria-modal="true" aria-labelledby="recipe-form-title" onSubmit={submit}>
        <h2 id="recipe-form-title">{title}</h2>

        <label className="field">Nombre del plato
          <input value={form.name} onChange={set('name')} required minLength={2} maxLength={160} autoFocus placeholder="Por ejemplo: Parihuela" />
        </label>
        <div className="form-row">
          <label className="field">Categoría
            <select value={form.category} onChange={set('category')}>
              {CATEGORIES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          {adminFields && (
            <label className="field">Nombre en inglés <small className="muted">(opcional)</small>
              <input value={form.nameEn} onChange={set('nameEn')} maxLength={160} />
            </label>
          )}
        </div>
        {adminFields && (
          <label className="field">Búsqueda de la foto en Unsplash <small className="muted">(opcional; si la dejas vacía se usa el nombre)</small>
            <input value={form.photo} onChange={set('photo')} maxLength={160} placeholder="parihuela peruana" />
          </label>
        )}

        <fieldset className="form-list">
          <legend>Ingredientes</legend>
          <p className="muted">
            Escribe cada ingrediente con su medida (500 g, 2 cda., 1/2 taza…). La “clave en inglés” es el nombre con el que el buscador
            lo reconoce (por ejemplo <em>chicken</em> para pollo); si la dejas vacía se completa sola.
          </p>
          {form.ingredients.map((ing, i) => (
            <div key={i} className="form-ing">
              <input aria-label={`Ingrediente ${i + 1}`} value={ing.es} onChange={(e) => setItem('ingredients', i, { es: e.target.value })} maxLength={80} placeholder="Ingrediente" />
              <input aria-label={`Medida del ingrediente ${i + 1}`} value={ing.measure} onChange={(e) => setItem('ingredients', i, { measure: e.target.value })} maxLength={60} placeholder="Medida: 500 g, 2 cda." />
              <input aria-label={`Clave en inglés del ingrediente ${i + 1}`} value={ing.name} onChange={(e) => setItem('ingredients', i, { name: e.target.value })} maxLength={80} placeholder="Clave en inglés" />
              <button type="button" className="btn-link" onClick={() => removeItem('ingredients', i)} disabled={form.ingredients.length === 1} aria-label={`Quitar ingrediente ${i + 1}`}>Quitar</button>
            </div>
          ))}
          <button type="button" className="btn" onClick={() => addItem('ingredients', { es: '', measure: '', name: '' })} disabled={form.ingredients.length >= 40}>Agregar ingrediente</button>
        </fieldset>

        <fieldset className="form-list">
          <legend>Preparación</legend>
          {form.steps.map((step, i) => (
            <div key={i} className="form-step">
              <span className="form-step-n">{i + 1}</span>
              <textarea aria-label={`Paso ${i + 1}`} rows={2} value={step} onChange={(e) => setItem('steps', i, e.target.value)} maxLength={700} placeholder="Describe este paso" />
              <div className="form-step-tools">
                <button type="button" className="btn-link" onClick={() => moveStep(i, -1)} disabled={i === 0} aria-label={`Subir el paso ${i + 1}`}>↑</button>
                <button type="button" className="btn-link" onClick={() => moveStep(i, 1)} disabled={i === form.steps.length - 1} aria-label={`Bajar el paso ${i + 1}`}>↓</button>
                <button type="button" className="btn-link" onClick={() => removeItem('steps', i)} disabled={form.steps.length === 1} aria-label={`Quitar el paso ${i + 1}`}>Quitar</button>
              </div>
            </div>
          ))}
          <button type="button" className="btn" onClick={() => addItem('steps', '')} disabled={form.steps.length >= 30}>Agregar paso</button>
        </fieldset>

        {error && <p className="alert" role="alert">{error}</p>}
        <div className="admin-confirm">
          <button type="button" className="btn" onClick={onClose} disabled={busy}>Cancelar</button>
          <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Guardando…' : submitLabel}</button>
        </div>
      </form>
    </>
  );
}
