// Si la foto no carga (sin internet), se ve el degradado verde en vez de un recuadro vacío.
const FALLBACK_BG = 'linear-gradient(135deg, #14302b, #3f9b6b)';

function HeartIcon({ filled }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round">
      <path d="M12 21s-7-4.4-9.5-9A5.5 5.5 0 0 1 12 6a5.5 5.5 0 0 1 9.5 6c-2.5 4.6-9.5 9-9.5 9z" />
    </svg>
  );
}

export function RecipeCard({ recipe, isFav, onOpen, onToggleFav }) {
  const { id, name, category, area, image, imageCredit, total, matched, missing } = recipe;
  const hasMeter = typeof total === 'number' && total > 0;
  const segments = Math.min(total || 0, 24);
  const filled = hasMeter ? Math.round((matched / total) * segments) : 0;
  const ready = hasMeter && missing === 0;

  return (
    <article
      className="card"
      style={image ? { backgroundImage: `url(${JSON.stringify(image)}), ${FALLBACK_BG}` } : undefined}
      data-noimg={image ? undefined : ''}
    >
      <button className="card-open" onClick={() => onOpen(id)} aria-label={`Ver receta: ${name}`} />

      <div className="card-top">
        {category ? <span className="tag">{category}</span> : <span />}
        <button
          className="fav"
          aria-pressed={isFav}
          aria-label={isFav ? `Quitar ${name} de favoritos` : `Guardar ${name} en favoritos`}
          onClick={() => onToggleFav(recipe)}
        >
          <HeartIcon filled={isFav} />
        </button>
      </div>

      <div className="card-body">
        <h3>{name}</h3>
        {area && <span className="card-area">{area}</span>}
        {hasMeter && (
          <>
            <div className="meter" role="img" aria-label={`Tienes ${matched} de ${total} ingredientes`}>
              {Array.from({ length: segments }, (_, i) => <i key={i} data-on={i < filled ? '' : undefined} />)}
            </div>
            <span className="meter-text">
              {ready ? 'Puedes cocinarla ya' : `Tienes ${matched} de ${total}, te faltan ${missing}`}
            </span>
          </>
        )}
        {imageCredit && (
          <small className="card-credit">
            Foto de <a href={imageCredit.link} target="_blank" rel="noreferrer">{imageCredit.name}</a> en{' '}
            <a href="https://unsplash.com/?utm_source=smart_pocket_chef&utm_medium=referral" target="_blank" rel="noreferrer">Unsplash</a>
          </small>
        )}
      </div>
    </article>
  );
}

export function RecipeSkeletons({ count = 6 }) {
  return (
    <div className="grid" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => <div key={i} className="card skeleton" />)}
    </div>
  );
}

export function RecipeGrid({ recipes, favIds, onOpen, onToggleFav }) {
  return (
    <div className="grid">
      {recipes.map((r) => (
        <RecipeCard key={r.id} recipe={r} isFav={favIds.has(r.id)} onOpen={onOpen} onToggleFav={onToggleFav} />
      ))}
    </div>
  );
}
