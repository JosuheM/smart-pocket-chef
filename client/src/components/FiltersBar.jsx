const DIETS = [
  ['gluten', 'Sin gluten'],
  ['dairy', 'Sin lácteos'],
  ['nuts', 'Sin frutos secos'],
];

/**
 * Dieta y país. Los filtros de dieta revisan los ingredientes de cada receta (harina, pan, leche, queso, maní…)
 * y descartan las que los llevan; el país filtra por la cocina de origen del catálogo.
 */
export default function FiltersBar({ diet, onDiet, area, onArea, areas }) {
  const toggle = (id) => onDiet(diet.includes(id) ? diet.filter((d) => d !== id) : [...diet, id]);
  return (
    <section className="filters" aria-label="Filtros de dieta y país">
      <div className="chips" role="group" aria-label="Dieta y alergias">
        {DIETS.map(([id, label]) => (
          <button key={id} type="button" className="chip" aria-pressed={diet.includes(id)} onClick={() => toggle(id)}>{label}</button>
        ))}
      </div>
      {areas.length > 0 && (
        <label className="select">
          País
          <select value={area} onChange={(e) => onArea(e.target.value)}>
            <option value="">Todos</option>
            {areas.map((a) => <option key={a.id} value={a.id}>{a.label} ({a.count})</option>)}
          </select>
        </label>
      )}
      {diet.length > 0 && (
        <p className="muted filters-note">
          Filtro orientativo: se basa en los ingredientes de la receta. Si tienes una alergia, revisa siempre las etiquetas de lo que compras.
        </p>
      )}
    </section>
  );
}
