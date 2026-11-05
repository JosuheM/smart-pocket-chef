import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import { useModal } from '../hooks.js';

const PAGE = 25;
const date = (value) => (value ? new Date(value).toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');

const CARDS = [
  ['users', 'Usuarios registrados'],
  ['admins', 'Administradores'],
  ['newThisWeek', 'Nuevos esta semana'],
  ['googleUsers', 'Cuentas de Google'],
  ['pantries', 'Despensas creadas'],
  ['pantryItems', 'Ingredientes en despensas'],
  ['favorites', 'Recetas favoritas'],
  ['cooked', 'Recetas cocinadas'],
  ['notes', 'Notas y calificaciones'],
  ['shoppingLists', 'Listas de compras'],
  ['customRecipes', 'Recetas propias (Perú)'],
];

/** Pide confirmación antes de una acción que no se puede deshacer. */
function ConfirmDialog({ user, busy, error, onCancel, onConfirm }) {
  const ref = useRef(null);
  useModal(ref, onCancel);
  return (
    <>
      <div className="backdrop backdrop-top" onClick={busy ? undefined : onCancel} />
      <div ref={ref} className="dialog" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-text">
        <h2 id="confirm-title">¿Eliminar esta cuenta?</h2>
        <p id="confirm-text">
          Vas a eliminar a <strong>{user.name}</strong> ({user.email}). Se borrarán también sus favoritas, su despensa, sus notas y su historial de compras.
          <strong> Esta acción no se puede deshacer.</strong>
        </p>
        {error && <p className="alert" role="alert">{error}</p>}
        <div className="admin-confirm">
          <button className="btn" onClick={onCancel} disabled={busy} autoFocus>Cancelar</button>
          <button className="btn btn-danger" onClick={onConfirm} disabled={busy}>{busy ? 'Eliminando…' : 'Sí, eliminar'}</button>
        </div>
      </div>
    </>
  );
}

export default function AdminDashboard({ me, notify, onForbidden }) {
  const [stats, setStats] = useState(null);
  const [statsError, setStatsError] = useState('');
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [text, setText] = useState('');
  const [search, setSearch] = useState('');
  const [working, setWorking] = useState(null); // id del usuario con una acción en curso
  const [toDelete, setToDelete] = useState(null);
  const [deleteError, setDeleteError] = useState('');
  const requestId = useRef(0);

  // Si el servidor dice que ya no eres administrador (403), la pantalla se cierra
  const fail = useCallback((e, set) => {
    if (e.status === 403 || e.status === 401) { onForbidden(e); return; }
    set(e.message);
  }, [onForbidden]);

  const loadStats = useCallback(() => {
    setStatsError('');
    api.adminStats().then(setStats).catch((e) => fail(e, setStatsError));
  }, [fail]);

  const loadUsers = useCallback(async (offset = 0, append = false) => {
    const id = ++requestId.current;
    setLoading(true);
    setError('');
    try {
      const data = await api.adminUsers({ search, limit: PAGE, offset });
      if (id !== requestId.current) return;
      setUsers((list) => (append ? [...list, ...data.users] : data.users));
      setTotal(data.total);
      setHasMore(data.hasMore);
    } catch (e) {
      if (id === requestId.current) fail(e, setError);
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [search, fail]);

  useEffect(() => { loadStats(); }, [loadStats]);
  useEffect(() => { loadUsers(0, false); }, [loadUsers]);

  const submitSearch = (e) => { e.preventDefault(); setSearch(text.trim()); };

  const changeRole = async (user) => {
    const role = user.role === 'admin' ? 'user' : 'admin';
    setWorking(user.id);
    try {
      await api.adminSetRole(user.id, role);
      setUsers((list) => list.map((u) => (u.id === user.id ? { ...u, role } : u)));
      notify(role === 'admin' ? `${user.name} ahora es administrador.` : `${user.name} ahora es usuario normal.`);
      loadStats();
    } catch (e) {
      if (e.status === 403 || e.status === 401) onForbidden(e);
      else notify(e.message, 'error');
    } finally {
      setWorking(null);
    }
  };

  const confirmDelete = async () => {
    setWorking(toDelete.id);
    setDeleteError('');
    try {
      await api.adminDeleteUser(toDelete.id);
      setUsers((list) => list.filter((u) => u.id !== toDelete.id));
      setTotal((n) => n - 1);
      notify(`Se eliminó la cuenta de ${toDelete.name}.`);
      setToDelete(null);
      loadStats();
    } catch (e) {
      if (e.status === 403 || e.status === 401) onForbidden(e);
      else if (e.status === 404) { setUsers((list) => list.filter((u) => u.id !== toDelete.id)); setToDelete(null); notify('Esa cuenta ya no existía.'); loadStats(); } else setDeleteError(e.message);
    } finally {
      setWorking(null);
    }
  };

  return (
    <section className="admin">
      <h2 className="section-title">Panel de administración</h2>
      <p className="muted">Sesión de {me.name}. Los cambios se aplican al instante y quedan en el registro del servidor.</p>

      {statsError && <p className="alert" role="alert">{statsError} <button className="btn-link" onClick={loadStats}>Reintentar</button></p>}
      <div className="stat-cards" aria-busy={!stats && !statsError}>
        {CARDS.map(([key, label]) => (
          <div key={key} className="stat-card">
            <strong>{stats ? stats[key].toLocaleString('es') : '…'}</strong>
            <span>{label}</span>
          </div>
        ))}
      </div>

      <div className="admin-head">
        <h3>Usuarios {total > 0 && <span className="plan-count">{total}</span>}</h3>
        <form className="admin-search" onSubmit={submitSearch} role="search">
          <label className="field">Buscar por nombre o correo
            <input value={text} onChange={(e) => setText(e.target.value)} maxLength={60} placeholder="ana, gmail.com…" />
          </label>
          <button className="btn" type="submit">Buscar</button>
          {search && <button className="btn-link" type="button" onClick={() => { setText(''); setSearch(''); }}>Quitar filtro</button>}
        </form>
      </div>

      {error && <p className="alert" role="alert">{error} <button className="btn-link" onClick={() => loadUsers(0, false)}>Reintentar</button></p>}

      <div className="table-wrap">
        <table className="admin-table">
          <caption className="sr-only">Usuarios registrados</caption>
          <thead>
            <tr>
              <th scope="col">ID</th>
              <th scope="col">Nombre</th>
              <th scope="col">Correo</th>
              <th scope="col">Rol</th>
              <th scope="col">Registro</th>
              <th scope="col">Uso</th>
              <th scope="col">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const self = u.id === me.id;
              return (
                <tr key={u.id}>
                  <td>{u.id}</td>
                  <th scope="row">{u.name}{self && <em className="badge">Tú</em>}</th>
                  <td className="admin-email">{u.email}{u.google && <em className="badge" title="Entra con Google">Google</em>}</td>
                  <td><span className="role" data-role={u.role}>{u.role === 'admin' ? 'Administrador' : 'Usuario'}</span></td>
                  <td>{date(u.createdAt)}</td>
                  <td className="muted">{u.pantryItems} en despensa · {u.favorites} favoritas</td>
                  <td>
                    <div className="admin-actions">
                      <button
                        className="btn"
                        onClick={() => changeRole(u)}
                        disabled={self || working === u.id}
                        title={self ? 'No puedes cambiar tu propio rol' : undefined}
                      >
                        {u.role === 'admin' ? 'Quitar admin' : 'Hacer admin'}
                      </button>
                      <button
                        className="btn btn-danger"
                        onClick={() => { setDeleteError(''); setToDelete(u); }}
                        disabled={self || working === u.id}
                        title={self ? 'No puedes eliminar tu propia cuenta' : undefined}
                        aria-label={`Eliminar la cuenta de ${u.name}`}
                      >
                        Eliminar
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {!loading && users.length === 0 && !error && (
              <tr><td colSpan={7} className="muted">{search ? 'Ningún usuario coincide con la búsqueda.' : 'Aún no hay usuarios.'}</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {loading && <p className="muted" role="status">Cargando usuarios…</p>}
      {hasMore && !loading && (
        <div className="more"><button className="btn" onClick={() => loadUsers(users.length, true)}>Mostrar más ({total - users.length})</button></div>
      )}

      {toDelete && (
        <ConfirmDialog
          user={toDelete}
          busy={working === toDelete.id}
          error={deleteError}
          onCancel={() => setToDelete(null)}
          onConfirm={confirmDelete}
        />
      )}
    </section>
  );
}
