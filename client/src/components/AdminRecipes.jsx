import { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';
import ConfirmDialog from './ConfirmDialog.jsx';
import RecipeForm, { CATEGORY_LABEL, EMPTY_RECIPE } from './RecipeForm.jsx';



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
        <button className="btn btn-primary" onClick={() => setForm({ id: null, initial: EMPTY_RECIPE })}>Agregar plato</button>
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
                <td>{CATEGORY_LABEL[r.category] ?? r.category}</td>
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

      {form && (
        <RecipeForm
          title={form.id ? 'Corregir receta' : 'Agregar plato peruano'}
          submitLabel={form.id ? 'Guardar cambios' : 'Agregar plato'}
          initial={form.initial}
          adminFields
          save={async (data) => {
            if (form.id) await api.adminUpdateRecipe(form.id, data);
            else await api.adminCreateRecipe(data);
            return form.id ? 'Receta corregida.' : 'Plato agregado.';
          }}
          onClose={() => setForm(null)}
          onSaved={saved}
          onForbidden={onForbidden}
        />
      )}

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
