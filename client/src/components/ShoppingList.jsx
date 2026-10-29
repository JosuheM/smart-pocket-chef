import { useState } from 'react';
import { api } from '../api.js';
import EmptyState from './EmptyState.jsx';
import QRModule from './QRModule.jsx';

// "Mi lista de compras": junta los ingredientes de varias recetas y genera un solo QR con lo que falta comprar.
export default function ShoppingList({ cart, user, onSearch, notify }) {
  const { items, pending, toggle, remove, clearBought, clear, add } = cart;
  const [text, setText] = useState('');
  const [qr, setQr] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const reset = () => setQr(null); // la lista cambió: el QR anterior ya no corresponde

  const submit = (e) => {
    e.preventDefault();
    const name = text.trim();
    if (!name) return;
    add([{ name, measure: '' }]);
    setText('');
    reset();
  };

  const makeQr = async () => {
    setBusy(true);
    setError('');
    try {
      setQr(await api.createQr({
        recipeName: 'Mi lista de compras',
        items: pending.map(({ name, measure }) => ({ name, measure })),
      }));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const boughtCount = items.length - pending.length;

  if (!items.length) {
    return (
      <>
        <EmptyState
          title="Tu lista de compras está vacía"
          text="Abre una receta y toca “Agregar a mi lista de compras”. Aquí se juntan los ingredientes de todas tus recetas, con las medidas sumadas."
          action={<button className="btn btn-primary" onClick={onSearch}>Buscar recetas</button>}
        />
        <form className="list-add" onSubmit={submit}>
          <label className="field">O escribe algo que necesites
            <input value={text} onChange={(e) => setText(e.target.value)} maxLength={60} placeholder="Por ejemplo: papel higiénico" />
          </label>
          <button className="btn" type="submit" disabled={!text.trim()}>Agregar</button>
        </form>
      </>
    );
  }

  return (
    <section>
      <h2 className="section-title">Mi lista de compras</h2>
      <p className="muted">{pending.length} por comprar{boughtCount > 0 && `, ${boughtCount} ya en el carrito`}. Se guarda en este dispositivo.</p>

      <form className="list-add" onSubmit={submit}>
        <label className="field">Agregar otro producto
          <input value={text} onChange={(e) => setText(e.target.value)} maxLength={60} placeholder="Por ejemplo: arroz" />
        </label>
        <button className="btn" type="submit" disabled={!text.trim()}>Agregar</button>
      </form>

      <ul className="cart">
        {items.map((it) => (
          <li key={it.key} data-bought={it.bought ? '' : undefined}>
            <label>
              <input type="checkbox" checked={it.bought} onChange={() => { toggle(it.key); reset(); }} />
              <span className="cart-name">{it.name}</span>
              {it.measure && <span className="ing-measure">{it.measure}</span>}
            </label>
            <button className="btn-link" onClick={() => { remove(it.key); reset(); }} aria-label={`Quitar ${it.name} de la lista`}>Quitar</button>
            {it.recipes.length > 0 && <small className="muted">Para: {it.recipes.join(', ')}</small>}
          </li>
        ))}
      </ul>

      <div className="qr-trigger">
        <button className="btn btn-primary" onClick={makeQr} disabled={!pending.length || busy}>
          {busy ? 'Generando…' : `Generar QR (${pending.length})`}
        </button>
        {boughtCount > 0 && <button className="btn" onClick={() => { clearBought(); reset(); }}>Quitar los ya comprados</button>}
        <button className="btn" onClick={() => { if (window.confirm('¿Vaciar toda tu lista de compras?')) { clear(); reset(); notify('Lista vaciada.'); } }}>Vaciar lista</button>
      </div>
      {error && <p className="alert" role="alert">{error}</p>}
      {qr && <QRModule qr={qr} loggedIn={Boolean(user)} notify={notify} />}
    </section>
  );
}
