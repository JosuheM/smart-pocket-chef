const TABS = [
  ['search', 'Buscar'],
  ['favorites', 'Favoritas'],
  ['list', 'Mi lista'],
  ['history', 'Historial'],
];

export default function Header({ user, view, onView, onLogin, onLogout, listCount }) {
  return (
    <header className="topbar">
      <button className="brand" onClick={() => onView('search')} aria-label="Smart Pocket Chef, ir al inicio">
        <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true">
          <path d="M4 5h20v10a10 10 0 0 1-20 0z" fill="#f3d34a" stroke="#14302b" strokeWidth="2" strokeLinejoin="round" />
          <path d="M8 10h12" stroke="#14302b" strokeWidth="2" strokeDasharray="2 3" strokeLinecap="round" />
        </svg>
        Smart Pocket Chef
      </button>

      <nav className="nav" aria-label="Secciones">
        {TABS.map(([id, label]) => (
          <button key={id} onClick={() => onView(id)} aria-current={view === id ? 'page' : undefined}>
            {label}
            {id === 'list' && listCount > 0 && <span className="count" aria-label={`${listCount} por comprar`}>{listCount}</span>}
          </button>
        ))}
      </nav>

      <div className="account">
        {user ? (
          <>
            <span>Hola, {user.name.split(' ')[0]}</span>
            <button className="btn" onClick={onLogout}>Salir</button>
          </>
        ) : (
          <button className="btn" onClick={onLogin}>Ingresar</button>
        )}
      </div>
    </header>
  );
}
