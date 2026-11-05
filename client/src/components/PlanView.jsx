import { useState } from 'react';
import { api } from '../api.js';
import { PLAN_MAX, PLAN_MIN } from '../hooks.js';
import EmptyState from './EmptyState.jsx';
import QRModule from './QRModule.jsx';

const SERVINGS = [2, 4, 6];

/** Plan semanal: de 3 a 7 recetas, una sola lista de compras con los ingredientes sumados y un solo QR. */
export default function PlanView({ plan, user, cart, onOpen, onSearch, notify }) {
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const { meals } = plan;
  const count = meals.length;
  const ready = count >= PLAN_MIN && count <= PLAN_MAX;

  const changeMeals = (fn) => { setResult(null); fn(); }; // si el plan cambia, el QR anterior ya no corresponde

  const generate = async () => {
    setBusy(true);
    setError('');
    try {
      setResult(await api.planShopping(meals.map(({ id, servings }) => ({ id, servings }))));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const addToList = () => {
    const added = cart.add(result.items, 'Plan semanal');
    notify(`Agregué ${added} ${added === 1 ? 'ingrediente' : 'ingredientes'} a tu lista de compras.`);
  };

  if (count === 0) {
    return (
      <EmptyState
        title="Planifica tu semana"
        text={`Elige de ${PLAN_MIN} a ${PLAN_MAX} recetas y te armamos una sola lista de compras, con los ingredientes repetidos sumados y un solo código QR. Abre una receta y toca “Agregar al plan semanal”.`}
        action={<button className="btn btn-primary" onClick={onSearch}>Buscar recetas</button>}
      />
    );
  }

  return (
    <section className="plan">
      <h2 className="section-title">Plan de la semana <span className="plan-count">{count} de {PLAN_MAX}</span></h2>
      <p className="muted">
        {ready
          ? 'Todo listo: genera la lista de compras de la semana.'
          : `Agrega ${PLAN_MIN - count} ${PLAN_MIN - count === 1 ? 'receta más' : 'recetas más'} (mínimo ${PLAN_MIN}) para generar la lista.`}
        {' '}Las cantidades de cada receta están pensadas para 2 personas y se ajustan a las porciones que elijas.
      </p>

      <ul className="plan-list">
        {meals.map((m) => (
          <li key={m.id} className="plan-item">
            <button
              className="plan-photo"
              onClick={() => onOpen(m.id)}
              style={m.image ? { backgroundImage: `url(${JSON.stringify(m.image)}), linear-gradient(135deg, #14302b, #3f9b6b)` } : undefined}
              aria-label={`Ver receta: ${m.name}`}
            />
            <div className="plan-info">
              <strong>{m.name}</strong>
              <label className="select">
                Porciones
                <select value={m.servings} onChange={(e) => changeMeals(() => plan.setServings(m.id, Number(e.target.value)))}>
                  {SERVINGS.map((n) => <option key={n} value={n}>{n} personas</option>)}
                </select>
              </label>
            </div>
            <button className="btn-link" onClick={() => changeMeals(() => plan.remove(m.id))} aria-label={`Quitar ${m.name} del plan`}>Quitar</button>
          </li>
        ))}
      </ul>

      <div className="plan-actions">
        <button className="btn btn-primary" onClick={generate} disabled={!ready || busy}>
          {busy ? 'Armando la lista…' : 'Generar lista de compras y QR'}
        </button>
        {count < PLAN_MAX && <button className="btn" onClick={onSearch}>Agregar otra receta</button>}
        <button className="btn-link" onClick={() => changeMeals(() => plan.clear())}>Vaciar plan</button>
      </div>
      {error && <p className="alert" role="alert">{error}</p>}

      {result && (
        <div className="plan-result">
          <h3>Compra de la semana ({result.items.length} {result.items.length === 1 ? 'ingrediente' : 'ingredientes'})</h3>
          <QRModule qr={result} loggedIn={Boolean(user)} notify={notify} />
          <div className="qr-trigger">
            <button className="btn" onClick={addToList}>Agregar todo a mi lista de compras</button>
          </div>
        </div>
      )}
    </section>
  );
}
