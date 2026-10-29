import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, getToken, setToken, setUnauthorizedHandler } from './api.js';
import { useCart, useLocalStorage, useOnline, useToasts } from './hooks.js';
import Header from './components/Header.jsx';
import SearchBar from './components/SearchBar.jsx';
import ResultsToolbar from './components/ResultsToolbar.jsx';
import { RecipeGrid, RecipeSkeletons } from './components/RecipeGrid.jsx';
import RecipeDrawer from './components/RecipeDrawer.jsx';
import ShoppingList from './components/ShoppingList.jsx';
import AuthDialog from './components/AuthDialog.jsx';
import History from './components/History.jsx';
import EmptyState from './components/EmptyState.jsx';
import Toasts from './components/Toasts.jsx';
import Footer from './components/Footer.jsx';

const MAX_TERMS = 10;

/** Estado inicial desde la URL: ?i=pollo,ajo (ingredientes), ?q=lasaña (nombre), ?c=Pasta (categoría), ?r=52772 (receta). */
function readUrl() {
  const p = new URLSearchParams(location.search);
  const terms = (p.get('i') || '').split(',').map((s) => s.trim()).filter(Boolean).slice(0, MAX_TERMS);
  const r = p.get('r');
  return { terms, q: p.get('q') || '', category: p.get('c') || '', area: p.get('a') || '', recipe: r && /^\d+$/.test(r) ? r : null };
}

const sameBase = (a, b) =>
  Boolean(a) && a.kind === b.kind
  && (a.kind === 'ingredients' ? a.terms.join('|') === b.terms.join('|') : a.q === b.q && (a.area ?? '') === (b.area ?? ''));

export default function App() {
  const initial = useRef(null);
  if (initial.current === null) initial.current = readUrl();

  const [user, setUser] = useState(null);
  const [authDialog, setAuthDialog] = useState(null); // null | { notice }
  const [view, setView] = useState('search'); // search | favorites | list | history
  const [searchMode, setSearchMode] = useState('ingredients'); // ingredients | name
  const [pantry, setPantry] = useLocalStorage('spc_pantry', true);
  const [ingredients, setIngredients] = useLocalStorage('spc_ingredients', []);
  const [prefs, setPrefs] = useState({ mode: 'any', sort: 'match' });
  const [nameText, setNameText] = useState('');
  const [feed, setFeed] = useState(null);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState(initial.current.recipe);
  const [favorites, setFavorites] = useState([]);
  const [hero, setHero] = useState(null);
  const [categories, setCategories] = useState([]);
  const [peruCount, setPeruCount] = useState(0);
  const [partialCatalog, setPartialCatalog] = useState(false);
  const online = useOnline();
  const cart = useCart();
  const { toasts, notify, dismiss } = useToasts();
  const requestId = useRef(0);
  const feedRef = useRef(null);
  feedRef.current = feed;

  const favIds = useMemo(() => new Set(favorites.map((f) => f.mealId)), [favorites]);

  // ---------- Sesión ----------
  useEffect(() => {
    setUnauthorizedHandler(() => {
      setToken(null);
      setUser(null);
      setAuthDialog({ notice: 'Tu sesión venció. Ingresa de nuevo para continuar.' });
    });
    if (!getToken()) return;
    api.me().then((d) => setUser(d.user)).catch((e) => {
      // Solo una respuesta 401 significa "sesión inválida". Si la base o el servidor fallan, la sesión se conserva.
      if (e.status === 401) setToken(null);
      else notify(`${e.message} Tu sesión sigue guardada.`, 'error');
    });
  }, []);

  useEffect(() => {
    if (!user) { setFavorites([]); return; }
    api.favorites().then(setFavorites).catch((e) => {
      setFavorites([]);
      if (e.status !== 401) notify(`No pudimos cargar tus favoritas. ${e.message}`, 'error'); // el 401 ya lo avisa el cierre de sesión
    });
  }, [user]);

  // ---------- Datos de apoyo (portada de Unsplash y categorías) ----------
  useEffect(() => {
    api.hero().then((h) => h?.image && setHero(h)).catch(() => {});
    api.meta().then((m) => { setCategories(m.categories); setPeruCount(m.peru ?? 0); setPartialCatalog(Boolean(m.partial)); }).catch(() => {});
  }, []);

  // ---------- Búsqueda ----------
  const runQuery = useCallback(async (query, append = false) => {
    const id = ++requestId.current;
    setError('');
    setFeed((f) => {
      if (append && f) return { ...f, loadingMore: true };
      const keep = sameBase(f?.query, query);
      return { query, results: [], total: 0, hasMore: false, facets: keep ? f.facets : [], unknown: [], loading: true };
    });
    try {
      const page = { offset: append ? feedRef.current.results.length : 0, limit: 12 };
      const data = query.kind === 'ingredients'
        ? await api.search({ ingredients: query.terms, mode: query.mode, sort: query.sort, category: query.category, pantry: query.pantry, ...page })
        : await api.explore({ q: query.q, category: query.category, area: query.area, ...page });
      if (id !== requestId.current) return;
      setFeed((f) => ({
        query,
        results: append && f ? [...f.results, ...data.results] : data.results,
        total: data.total,
        hasMore: data.hasMore,
        facets: data.facets,
        unknown: data.unknown ?? [],
        loading: false,
        loadingMore: false,
      }));
    } catch (e) {
      if (id !== requestId.current) return;
      setError(e.message);
      setFeed((f) => (append && f ? { ...f, loadingMore: false } : null));
    }
  }, []);

  // Si la URL trae una búsqueda, se ejecuta al abrir la página
  useEffect(() => {
    const { terms, q, category, area } = initial.current;
    if (terms.length) {
      setIngredients(terms);
      runQuery({ kind: 'ingredients', terms, mode: 'any', sort: 'match', category: '', pantry });
    } else if (q || category || area) {
      if (q) { setSearchMode('name'); setNameText(q); }
      runQuery({ kind: 'explore', q, category, area });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // La URL refleja la búsqueda y la receta abierta, para poder compartirla o recargar la página
  useEffect(() => {
    const p = new URLSearchParams();
    const q = feed?.query;
    if (q?.kind === 'ingredients') p.set('i', q.terms.join(','));
    else if (q?.kind === 'explore') {
      if (q.q) p.set('q', q.q);
      if (q.category) p.set('c', q.category);
      if (q.area) p.set('a', q.area);
    }
    if (selectedId) p.set('r', selectedId);
    const s = p.toString();
    history.replaceState(null, '', s ? `?${s}` : location.pathname);
  }, [feed?.query, selectedId]);

  const searchIngredients = (list) => {
    setIngredients(list);
    runQuery({ kind: 'ingredients', terms: list, ...prefs, category: '', pantry });
  };
  const searchName = (q) => {
    setNameText(q);
    runQuery({ kind: 'explore', q, category: '' });
  };
  const exploreCategory = (category) => runQuery({ kind: 'explore', q: '', category });
  const explorePeru = () => { setView('search'); runQuery({ kind: 'explore', q: '', category: '', area: 'Peruvian' }); };
  const refine = (patch) => {
    if ('mode' in patch || 'sort' in patch) setPrefs((p) => ({ ...p, ...patch }));
    runQuery({ ...feed.query, ...patch });
  };
  const changePantry = (value) => {
    setPantry(value);
    if (feed?.query.kind === 'ingredients') runQuery({ ...feed.query, pantry: value });
  };
  const surprise = async () => {
    try {
      setSelectedId((await api.random()).id);
    } catch (e) {
      setError(e.message);
    }
  };

  // ---------- Favoritos y cuenta ----------
  const openLogin = (notice) => setAuthDialog({ notice });

  const toggleFavorite = async (recipe) => {
    if (!user) { openLogin('Ingresa para guardar tus recetas favoritas.'); return; }
    const entry = { mealId: recipe.id, name: recipe.name, image: recipe.image, category: recipe.category, area: recipe.area };
    try {
      if (favIds.has(recipe.id)) {
        await api.removeFavorite(recipe.id);
        setFavorites((f) => f.filter((x) => x.mealId !== recipe.id));
        notify('Quitada de tus favoritas.');
      } else {
        await api.addFavorite(entry);
        setFavorites((f) => [entry, ...f]);
        notify('Guardada en tus favoritas.');
      }
    } catch (e) {
      notify(e.message, 'error');
    }
  };

  const handleAuth = ({ token, user: u }, isNew) => {
    setToken(token);
    setUser(u);
    setAuthDialog(null);
    notify(isNew ? `¡Cuenta creada! Bienvenido, ${u.name.split(' ')[0]}.` : `Hola de nuevo, ${u.name.split(' ')[0]}.`);
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    if (view === 'favorites' || view === 'history') setView('search');
    notify('Cerraste sesión.');
  };

  const goTo = (v) => { setView(v); setError(''); window.scrollTo({ top: 0 }); };

  const favoriteCards = favorites.map((f) => ({ id: f.mealId, name: f.name, image: f.image, category: f.category, area: f.area }));
  const gridProps = { favIds, onOpen: setSelectedId, onToggleFav: toggleFavorite };

  const noResults = () => {
    const q = feed.query;
    if (q.kind === 'ingredients' && q.mode === 'all') {
      return {
        title: 'Ninguna receta lleva todos esos ingredientes',
        text: 'Prueba quitando algunos o muestra las recetas que usan al menos uno.',
        action: <button className="btn btn-primary" onClick={() => refine({ mode: 'any' })}>Mostrar recetas con alguno</button>,
      };
    }
    if (q.category) {
      return {
        title: 'No hay recetas en esa categoría',
        text: 'Prueba con otra categoría o quita el filtro.',
        action: <button className="btn btn-primary" onClick={() => refine({ category: '' })}>Ver todas</button>,
      };
    }
    return q.kind === 'ingredients'
      ? { title: 'No encontramos recetas con esos ingredientes', text: 'Prueba con menos ingredientes o con uno más común, como pollo, arroz o huevos.' }
      : { title: 'No encontramos ese platillo', text: 'Prueba con otra palabra, por ejemplo “pollo”, “sopa” o “pastel”.' };
  };

  return (
    <>
      <a className="skip" href="#contenido">Saltar al contenido</a>
      <Header user={user} view={view} onView={goTo} onLogin={() => openLogin()} onLogout={logout} listCount={cart.pending.length} />

      <main id="contenido">
        {!online && (
          <p className="offline" role="status">
            Sin conexión a internet. Las recetas y las fotos que ya guardaste, las recetas peruanas, tu lista de compras y el QR local siguen funcionando.
          </p>
        )}
        {partialCatalog && (
          <p className="notice" role="status">
            El catálogo de TheMealDB aún no se descargó (no había internet). Por ahora solo están las recetas peruanas; conéctate una vez para tener todas.
          </p>
        )}
        {error && <p className="alert" role="alert">{error}</p>}

        {view === 'search' && (
          <>
            <section className="hero" style={hero ? { '--hero': `url(${JSON.stringify(hero.image)})` } : undefined} data-photo={hero ? '' : undefined}>
              <div className="hero-inner">
                <h1>¿Qué tienes en el refrigerador?</h1>
                <p className="hero-lead">
                  Escribe tus ingredientes y te mostramos qué puedes cocinar hoy, con lo que ya tienes y lo que te falta comprar.
                </p>
                <SearchBar
                  mode={searchMode}
                  onMode={setSearchMode}
                  ingredients={ingredients}
                  onChange={setIngredients}
                  onSearch={searchIngredients}
                  nameValue={nameText}
                  onNameChange={setNameText}
                  onNameSearch={searchName}
                  loading={Boolean(feed?.loading)}
                  pantry={pantry}
                  onPantry={changePantry}
                />
              </div>
              {hero?.credit && (
                <small className="hero-credit">
                  Foto de <a href={hero.credit.link} target="_blank" rel="noreferrer">{hero.credit.name}</a> en{' '}
                  <a href="https://unsplash.com/?utm_source=smart_pocket_chef&utm_medium=referral" target="_blank" rel="noreferrer">Unsplash</a>
                </small>
              )}
            </section>

            {feed ? (
              <section>
                <ResultsToolbar feed={feed} onChange={refine} />
                {feed.loading ? (
                  <RecipeSkeletons />
                ) : feed.results.length === 0 ? (
                  <EmptyState {...noResults()} />
                ) : (
                  <>
                    <RecipeGrid recipes={feed.results} {...gridProps} />
                    {feed.hasMore && (
                      <div className="more">
                        <button className="btn" onClick={() => runQuery(feed.query, true)} disabled={feed.loadingMore}>
                          {feed.loadingMore ? 'Cargando…' : `Mostrar más (${feed.total - feed.results.length})`}
                        </button>
                      </div>
                    )}
                  </>
                )}
              </section>
            ) : (
              <section className="explore">
                {peruCount > 0 && (
                  <button className="peru" onClick={explorePeru}>
                    <strong>Comida peruana</strong>
                    <span>{peruCount} platos clásicos: lomo saltado, ceviche, ají de gallina y más</span>
                  </button>
                )}
                <div className="explore-head">
                  <h2 className="section-title">¿Sin ideas? Explora</h2>
                  <button className="btn" onClick={surprise}>Sorpréndeme</button>
                </div>
                {categories.length > 0 && (
                  <div className="chips" role="group" aria-label="Explorar por categoría">
                    {categories.map((c) => (
                      <button key={c.id} type="button" className="chip" aria-pressed="false" onClick={() => exploreCategory(c.id)}>
                        {c.label} <span>{c.count}</span>
                      </button>
                    ))}
                  </div>
                )}
                <ol className="steps-intro">
                  <li><strong>Escribe</strong> lo que tienes en casa.</li>
                  <li><strong>Elige</strong> una receta y marca lo que ya tienes.</li>
                  <li><strong>Escanea</strong> el QR con lo que falta en el supermercado.</li>
                </ol>
              </section>
            )}
          </>
        )}

        {view === 'favorites' && (
          <section>
            {!user ? (
              <EmptyState
                title="Tus recetas favoritas viven aquí"
                text="Ingresa para guardar recetas y encontrarlas desde cualquier dispositivo."
                action={<button className="btn btn-primary" onClick={() => openLogin('Ingresa para ver tus favoritas.')}>Ingresar</button>}
              />
            ) : favorites.length === 0 ? (
              <EmptyState title="Aún no tienes favoritas" text="Toca el corazón de una receta para guardarla." action={<button className="btn btn-primary" onClick={() => goTo('search')}>Buscar recetas</button>} />
            ) : (
              <>
                <h2 className="section-title">Tus favoritas ({favorites.length})</h2>
                <RecipeGrid recipes={favoriteCards} {...gridProps} />
              </>
            )}
          </section>
        )}

        {view === 'list' && <ShoppingList cart={cart} user={user} onSearch={() => goTo('search')} notify={notify} />}

        {view === 'history' && (
          <History user={user} onNeedLogin={() => openLogin('Ingresa para ver tu historial de compras.')} notify={notify} />
        )}
      </main>

      <Footer feedResults={feed?.results} notify={notify} />

      {selectedId && (
        <RecipeDrawer
          key={selectedId}
          id={selectedId}
          haveTerms={ingredients}
          pantry={pantry}
          user={user}
          isFav={favIds.has(selectedId)}
          onToggleFav={toggleFavorite}
          onAddToList={cart.add}
          onClose={() => setSelectedId(null)}
          notify={notify}
        />
      )}
      {authDialog && <AuthDialog notice={authDialog.notice} onClose={() => setAuthDialog(null)} onAuth={handleAuth} />}
      <Toasts toasts={toasts} onDismiss={dismiss} />
    </>
  );
}
