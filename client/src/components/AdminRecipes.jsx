import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import { useModal } from '../hooks.js';
import ConfirmDialog from './ConfirmDialog.jsx';

const CATEGORIES = [
  ['Beef', 'Res'], ['Chicken', 'Pollo'], ['Seafood', 'Mariscos'], ['Pork', 'Cerdo'], ['Lamb', 'Cordero'], ['Goat', 'Cabra'],
  ['Pasta', 'Pasta'], ['Vegetarian', 'Vegetariano'], ['Vegan', 'Vegano'], ['Starter', 'Entrada'], ['Side', 'Acompañamiento'],
  ['Dessert', 'Postre'], ['Breakfast', 'Desayuno'], ['Miscellaneous', 'Variado'],
];
const LABEL = Object.fromEntries(CATEGORIES);

const EMPTY = { name: '', nameEn: '', category: 'Beef', photo: '', ingredients: [{ es: '', measure: '', name: '' }], steps: [''] };

/** Formulario para agregar o corregir un plato. */
function RecipeForm({ id, initial, onClose, onSaved, onForbidden }) {
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
      if (id) await api.adminUpdateRecipe(id, form);
      else await api.adminCreateRecipe(form);
      onSaved(id ? 'Receta corregida.' : 'Plato agregado.');
    } catch (err) {
      if (err.status === 401 || err.status === 403) onForbidden(err);
      else setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="backdrop backdrop-top" onClick={busy ? undefined : onClose} />
      <form ref={ref} className="dialog dialog-wide recipe-form" role="dialog" aria-modal="true" aria-labelledby="recipe-form-title" onSubmit={submit}>
        <h2 id="recipe-form-title">{id ? 'Corregir receta' : 'Agregar plato peruano'}</h2>

        <label className="field">Nombre del plato
          <input value={form.name} onChange={set('name')} required minLength={2} maxLength={160} autoFocus placeholder="Por ejemplo: Parihuela" />
        </label>
        <div className="form-row">
          <label className="field">Categoría
            <select value={form.category} onChange={set('category')}>
              {CATEGORIES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label className="field">Nombre en inglés <small className="muted">(opcional)</small>
            <input value={form.nameEn} onChange={set('nameEn')} maxLength={160} />
          </label>
        </div>
        <label className="field">Búsqueda de la foto en Unsplash <small className="muted">(opcional; si la dejas vacía se usa el nombre)</small>
          <input value={form.photo} onChange={set('photo')} maxLength={160} placeholder="parihuela peruana" />
        </label>

        <fieldset className="form-list">
          <legend>Ingredientes</legend>
          <p className="muted">
            En “clave en inglés” va el nombre con el que el buscador reconoce el ingrediente (por ejemplo <em>chicken</em> para pollo).
            Si la dejas vacía se completa sola con el diccionario.
          </p>
          {form.ingredients.map((ing, i) => (
            <div key={i} className="form-ing">
              <input aria-label={`Ingrediente ${i + 1}`} value={ing.es} onChange={(e) => setItem('ingredients', i, { es: e.target.value })} maxLength={80} placeholder="Ingrediente (español)" />
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
          <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Guardando…' : id ? 'Guardar cambios' : 'Agregar plato'}</button>
        </div>
      </form>
    </>
  );
}

/** Pestaña "Recetas peruanas" del panel: lista, agrega, corrige y borra los platos propios (tabla custom_recipes). */
export default function AdminRecipes({ notify, onForbidden, onChanged }) {
  const [recipes, setRecipes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState(null); // { id, initial }
  const [opening, setOpening] = useState(null); // id de la receta que se está abriendo para editar
  const [toDelete, setToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const fail = useCallback((e, set) => {
    if (e.status === 401 || e.status === 403) onForbidden(e);
    else set(e.message);
  }, [onForbidden]);

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    api.adminRecipes().then((d) => setRecipes(d.recipes)).catch((e) => fail(e, setError)).finally(() => setLoading(false));
  }, [fail]);

  useEffect(() => { load(); }, [load]);

  const openEdit = async (r) => {
    setOpening(r.id);
    try {
      const full = await api.adminRecipe(r.id);
      setForm({
        id: full.id,
        initial: {
          name: full.name, nameEn: full.nameEn === full.name ? '' : full.nameEn, category: full.category, photo: full.photo === full.name ? '' : full.photo,
          ingredients: full.ingredients.map((i) => ({ es: i.es, measure: i.measure, name: i.name })),
          steps: full.steps,
        },
      });
    } catch (e) {
      if (e.status === 404) { notify('Esa receta ya no existe.', 'error'); load(); } else fail(e, (m) => notify(m, 'error'));
    } finally {
      setOpening(null);
    }
  };

  const saved = (message) => { setForm(null); notify(message); load(); onChanged?.(); };

  const confirmDelete = async () => {
    setDeleting(true);
    setDeleteError('');
    try {
      await api.adminDeleteRecipe(toDelete.id);
      notify(`Se borró “${toDelete.name}”.`);
      setToDelete(null);
      load();
      onChanged?.();
    } catch (e) {
      if (e.status === 404) { setToDelete(null); load(); } else fail(e, setDeleteError);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="admin-recipes">
      <div className="admin-head">
        <h3>Recetas peruanas {recipes.length > 0 && <span className="plan-count">{recipes.length}</span>}</h3>
        <button className="btn btn-primary" onClick={() => setForm({ id: null, initial: EMPTY })}>Agregar plato</button>
      </div>
      <p className="muted">Los cambios se ven al instante en el buscador y en “Comida peruana”. Las recetas de TheMealDB no se pueden editar.</p>

      {error && <p className="alert" role="alert">{error} <button className="btn-link" onClick={load}>Reintentar</button></p>}

      <div className="table-wrap">
        <table className="admin-table">
          <caption className="sr-only">Recetas peruanas</caption>
          <thead>
            <tr>
              <th scope="col">ID</th>
              <th scope="col">Plato</th>
              <th scope="col">Categoría</th>
              <th scope="col">Ingredientes</th>
              <th scope="col">Pasos</th>
              <th scope="col">Foto</th>
              <th scope="col">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {recipes.map((r) => (
              <tr key={r.id}>
                <td>{r.id}</td>
                <th scope="row">{r.name}</th>
                <td>{LABEL[r.category] ?? r.category}</td>
                <td>{r.ingredients}</td>
                <td>{r.steps}</td>
                <td className="muted">{r.fixedPhoto ? 'Fija' : 'Automática'}</td>
                <td>
                  <div className="admin-actions">
                    <button className="btn" onClick={() => openEdit(r)} disabled={opening === r.id} aria-label={`Corregir ${r.name}`}>{opening === r.id ? 'Abriendo…' : 'Corregir'}</button>
                    <button className="btn btn-danger" onClick={() => { setDeleteError(''); setToDelete(r); }} aria-label={`Borrar ${r.name}`}>Borrar</button>
                  </div>
                </td>
              </tr>
            ))}
            {!loading && recipes.length === 0 && !error && <tr><td colSpan={7} className="muted">No hay recetas propias. Agrega la primera.</td></tr>}
          </tbody>
        </table>
      </div>
      {loading && <p className="muted" role="status">Cargando recetas…</p>}

      {form && <RecipeForm id={form.id} initial={form.initial} onClose={() => setForm(null)} onSaved={saved} onForbidden={onForbidden} />}

      {toDelete && (
        <ConfirmDialog
          title="¿Borrar esta receta?"
          confirmLabel="Sí, borrar"
          busyLabel="Borrando…"
          busy={deleting}
          error={deleteError}
          onCancel={() => setToDelete(null)}
          onConfirm={confirmDelete}
        >
          Vas a borrar <strong>{toDelete.name}</strong>. Desaparece del buscador y también de las favoritas y notas de quienes la guardaron.
          <strong> Esta acción no se puede deshacer.</strong>
        </ConfirmDialog>
      )}
    </div>
  );
}
