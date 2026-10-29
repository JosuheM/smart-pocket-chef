import { useEffect, useState } from 'react';
import { api } from '../api.js';
import EmptyState from './EmptyState.jsx';

const fmtDate = (iso) =>
  new Date(iso).toLocaleDateString('es-PE', { day: 'numeric', month: 'long', year: 'numeric' });

export default function History({ user, onNeedLogin, notify }) {
  const [items, setItems] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) { setItems(null); return; }
    setError('');
    api.history().then(setItems).catch((e) => setError(e.message));
  }, [user]);

  const remove = async (id) => {
    try {
      await api.deleteHistory(id);
      setItems((list) => list.filter((x) => x.id !== id));
      notify('Lista eliminada del historial.');
    } catch (e) {
      setError(e.message);
    }
  };

  if (!user) {
    return (
      <EmptyState
        title="Tus listas de compras viven aquí"
        text="Ingresa para guardar cada lista que generes y volver a escanearla cuando quieras."
        action={<button className="btn btn-primary" onClick={onNeedLogin}>Ingresar</button>}
      />
    );
  }
  if (error) return <p className="alert" role="alert">{error}</p>;
  if (!items) return <p className="muted history-status" role="status">Cargando tu historial…</p>;
  if (!items.length) {
    return <EmptyState title="Todavía no generaste listas" text="Abre una receta, marca lo que ya tienes y genera el QR de lo que falta." />;
  }

  return (
    <section>
      <h2 className="section-title">Historial de listas</h2>
      <ul className="history">
        {items.map((it) => (
          <li key={it.id} className="history-item">
            <a href={it.qrUrl} target="_blank" rel="noreferrer" title="Abrir el QR en grande">
              <img src={it.qrUrl} width="96" height="96" loading="lazy" alt={`QR de la lista para ${it.recipeName || 'tu receta'}`} />
            </a>
            <div>
              <h3>{it.recipeName || 'Lista sin receta'}</h3>
              <p className="muted">{fmtDate(it.createdAt)}, {it.items.length} {it.items.length === 1 ? 'ingrediente' : 'ingredientes'}</p>
              <p>{it.items.map((i) => i.name).join(', ')}</p>
              <div className="history-actions">
                <a className="btn-link" href={`https://wa.me/?text=${encodeURIComponent(it.text)}`} target="_blank" rel="noreferrer">Enviar por WhatsApp</a>
                <button className="btn-link" onClick={() => remove(it.id)}>Eliminar</button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
