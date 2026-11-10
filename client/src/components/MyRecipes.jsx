import { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';
import ConfirmDialog from './ConfirmDialog.jsx';
import EmptyState from './EmptyState.jsx';
import RecipeForm, { EMPTY_RECIPE } from './RecipeForm.jsx';

/** Mis recetas: los platos que la persona crea para sí misma. Nadie más los ve. */
export default function MyRecipes({ user, onNeedLogin, onOpen, notify }) {
  const [data, setData] = useState({ recipes: [], total: 0, max: 50 });
  const [loading, setLoading] = useState(Boolean(user));
  const [error, setError] = useState('');
  const [form, setForm] = useState(null); // { id, initial }
  const [opening, setOpening] = useState(null);
  const [toDelete, setToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    api.myRecipes()
      .then(setData)
      .catch((e) => e.status !== 401 && setError(e.message)) // el 401 ya lo avisa el cierre de sesión
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { if (user) load(); }, [user, load]);

  if (!user) {
    return (
      <EmptyState
        title="Tus propias recetas"
        text="Guarda aquí los platos de tu familia o tus inventos. Solo tú los ves, y salen en tus búsquedas, tu despensa y tu plan semanal."
        action={<button className="btn btn-primary" onClick={() => onNeedLogin('Ingresa para crear tus propias recetas.')}>Ingresar</button>}
      />
    );
  }

  const openEdit = async (r) => {
    setOpening(r.id);
    try {
      const full = await api.myRecipeForEdit(r.id);
      setForm({ id: full.id, initial: { ...EMPTY_RECIPE, name: full.name, category: full.category, ingredients: full.ingredients, steps: full.steps } });
    } catch (e) {
      notify(e.message, 'error');
      if (e.status === 404) load();
    } finally {
      setOpening(null);
    }
  };

  const saved = (message) => { setForm(null); notify(message); load(); };

  const confirmDelete = async () => {
    setDeleting(true);
    setDeleteError('');
    try {
      await api.deleteMyRecipe(toDelete.id);
      notify(`Se borró “${toDelete.name}”.`);
      setToDelete(null);
      load();
    } catch (e) {
      if (e.status === 404) { setToDelete(null); load(); } else setDeleteError(e.message);
    } finally {
      setDeleting(false);
    }
  };

  const full = data.total >= data.max;
  return (
    <section className="my-recipes">
      <div className="admin-head">
        <h2 className="section-title">Mis recetas {data.total > 0 && <span className="plan-count">{data.total} de {data.max}</span>}</h2>
        <button className="btn btn-primary" onClick={() => setForm({ id: null, initial: EMPTY_RECIPE })} disabled={full} title={full ? 'Llegaste al máximo de recetas' : undefined}>
          Nueva receta
        </button>
      </div>
      <p className="muted">Solo tú ves estas recetas. También aparecen en tus búsquedas, en tu despensa y en tu plan semanal. No llevan foto.</p>

      {error && <p className="alert" role="alert">{error} <button className="btn-link" onClick={load}>Reintentar</button></p>}

      {loading && data.recipes.length === 0 ? (
        <p className="muted" role="status">Cargando tus recetas…</p>
      ) : data.recipes.length === 0 && !error ? (
        <EmptyState
          title="Aún no tienes recetas propias"
          text="Crea la primera: escribe sus ingredientes con la medida y los pasos, y la encuentras después con el buscador."
          action={<button className="btn btn-primary" onClick={() => setForm({ id: null, initial: EMPTY_RECIPE })}>Crear mi primera receta</button>}
        />
      ) : (
        <div className="table-wrap">
          <table className="admin-table">
            <caption className="sr-only">Mis recetas</caption>
            <thead>
              <tr>
                <th scope="col">Receta</th>
                <th scope="col">Categoría</th>
                <th scope="col">Ingredientes</th>
                <th scope="col">Pasos</th>
                <th scope="col">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {data.recipes.map((r) => (
                <tr key={r.id}>
                  <th scope="row">{r.name}</th>
                  <td>{r.category}</td>
                  <td>{r.ingredients}</td>
                  <td>{r.steps}</td>
                  <td>
                    <div className="admin-actions">
                      <button className="btn" onClick={() => onOpen(r.id)} aria-label={`Ver ${r.name}`}>Ver</button>
                      <button className="btn" onClick={() => openEdit(r)} disabled={opening === r.id} aria-label={`Editar ${r.name}`}>{opening === r.id ? 'Abriendo…' : 'Editar'}</button>
                      <button className="btn btn-danger" onClick={() => { setDeleteError(''); setToDelete(r); }} aria-label={`Borrar ${r.name}`}>Borrar</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {form && (
        <RecipeForm
          title={form.id ? 'Editar mi receta' : 'Nueva receta'}
          submitLabel={form.id ? 'Guardar cambios' : 'Guardar receta'}
          initial={form.initial}
          save={async (body) => {
            if (form.id) await api.updateMyRecipe(form.id, body);
            else await api.createMyRecipe(body);
            return form.id ? 'Receta actualizada.' : 'Receta guardada.';
          }}
          onClose={() => setForm(null)}
          onSaved={saved}
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
          Vas a borrar <strong>{toDelete.name}</strong>. También se quita de tus favoritas y notas.
          <strong> Esta acción no se puede deshacer.</strong>
        </ConfirmDialog>
      )}
    </section>
  );
}
