/** Calificación de 1 a 5 estrellas. Tocar la estrella ya marcada quita la calificación. */
export default function Stars({ value, onChange, label = 'Tu calificación', readOnly = false }) {
  if (readOnly) {
    return (
      <span className="stars" role="img" aria-label={value ? `${value} de 5 estrellas` : 'Sin calificar'}>
        {[1, 2, 3, 4, 5].map((n) => <span key={n} className="star" data-on={value >= n ? '' : undefined} aria-hidden="true">★</span>)}
      </span>
    );
  }
  return (
    <div className="stars" role="radiogroup" aria-label={label}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          className="star"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} ${n === 1 ? 'estrella' : 'estrellas'}`}
          data-on={value >= n ? '' : undefined}
          onClick={() => onChange(value === n ? null : n)}
        >
          ★
        </button>
      ))}
    </div>
  );
}
