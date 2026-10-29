// Resumen y filtros de los resultados. Todo se calcula en el servidor: aquí solo se pide otra vez con otros parámetros.
export default function ResultsToolbar({ feed, onChange }) {
  const { query, total, facets = [], unknown = [], loading } = feed;
  const byIngredients = query.kind === 'ingredients';
  const title = byIngredients
    ? `${total} ${total === 1 ? 'receta' : 'recetas'} para tu cocina`
    : query.area === 'Peruvian'
      ? `${total} platos de la cocina peruana`
      : `${total} ${total === 1 ? 'receta' : 'recetas'}${query.q ? ` para “${query.q}”` : ''}`;

  return (
    <div className="toolbar" aria-busy={loading}>
      <div className="toolbar-head">
        <h2 className="section-title" aria-live="polite">{title}</h2>
        {byIngredients && (
          <div className="toolbar-controls">
            <label className="check">
              <input
                type="checkbox"
                checked={query.mode === 'all'}
                onChange={(e) => onChange({ mode: e.target.checked ? 'all' : 'any' })}
              />
              Solo con todos mis ingredientes
            </label>
            <label className="select">
              Ordenar por
              <select value={query.sort} onChange={(e) => onChange({ sort: e.target.value })}>
                <option value="match">Más ingredientes míos</option>
                <option value="missing">Menos por comprar</option>
              </select>
            </label>
          </div>
        )}
      </div>

      {unknown.length > 0 && (
        <p className="notice" role="status">
          No reconocimos {unknown.length === 1 ? 'este ingrediente' : 'estos ingredientes'}: <strong>{unknown.join(', ')}</strong>.
          Prueba con otro nombre (por ejemplo, “pechuga de pollo” en vez de “filete”) o revisa cómo está escrito.
        </p>
      )}

      {facets.length > 1 && (
        <div className="chips" role="group" aria-label="Filtrar por categoría">
          <button type="button" className="chip" aria-pressed={!query.category} onClick={() => onChange({ category: '' })}>Todas</button>
          {facets.map((f) => (
            <button key={f.id} type="button" className="chip" aria-pressed={query.category === f.id} onClick={() => onChange({ category: f.id })}>
              {f.label} <span>{f.count}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
