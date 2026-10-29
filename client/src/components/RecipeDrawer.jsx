import { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import { useModal } from '../hooks.js';
import QRModule from './QRModule.jsx';

function IngredientGroup({ title, kind, items, checked, onToggle, empty }) {
  return (
    <div className="ing-group" data-kind={kind}>
      <h4>{title} ({items.length})</h4>
      {items.length === 0 ? (
        <p className="muted">{empty}</p>
      ) : (
        <ul className="ing-list">
          {items.map(({ name, measure, staple, i }) => (
            <li key={i}>
              <label>
                <input type="checkbox" checked={checked} onChange={() => onToggle(i)} />
                <span className="ing-name">{name}{staple && <em className="badge">Básico</em>}</span>
                {measure && <span className="ing-measure">{measure}</span>}
              </label>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function RecipeDrawer({ id, haveTerms, pantry, user, isFav, onToggleFav, onAddToList, onClose, notify }) {
  const [recipe, setRecipe] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [have, setHave] = useState(new Set()); // índices de ingredientes que el usuario ya tiene
  const [done, setDone] = useState(new Set()); // pasos marcados como hechos
  const [qr, setQr] = useState(null);
  const [qrBusy, setQrBusy] = useState(false);
  const [qrError, setQrError] = useState('');
  const panelRef = useRef(null);
  const closeRef = useRef(null);

  useModal(panelRef, onClose);
  useEffect(() => { closeRef.current?.focus(); }, []);

  useEffect(() => {
    let alive = true;
    api.recipe(id, haveTerms, pantry)
      .then((r) => {
        if (!alive) return;
        setRecipe(r);
        setHave(new Set(r.ingredients.flatMap((ing, i) => (ing.have ? [i] : []))));
      })
      .catch((e) => alive && setLoadError(e.message));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const toggle = (i) => {
    setHave((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
    setQr(null); // la lista cambió: el QR anterior ya no corresponde
  };

  const toggleStep = (i) => setDone((prev) => {
    const next = new Set(prev);
    if (next.has(i)) next.delete(i); else next.add(i);
    return next;
  });

  const indexed = recipe ? recipe.ingredients.map((ing, i) => ({ ...ing, i })) : [];
  const missing = indexed.filter((x) => !have.has(x.i));
  const owned = indexed.filter((x) => have.has(x.i));
  const items = missing.map(({ name, measure }) => ({ name, measure }));

  const makeQr = async () => {
    setQrBusy(true);
    setQrError('');
    try {
      setQr(await api.createQr({ recipeId: recipe.id, recipeName: recipe.name, items }));
    } catch (e) {
      setQrError(e.message);
    } finally {
      setQrBusy(false);
    }
  };

  const addToList = () => {
    const added = onAddToList(items, recipe.name);
    notify(added === items.length
      ? `Agregué ${added} ${added === 1 ? 'ingrediente' : 'ingredientes'} a tu lista de compras.`
      : 'Tu lista de compras ya tenía algunos de estos ingredientes: sumé las medidas.');
  };

  const shareLink = async () => {
    const url = `${location.origin}${location.pathname}?r=${id}`;
    try {
      if (navigator.share) await navigator.share({ title: recipe.name, url });
      else { await navigator.clipboard.writeText(url); notify('Enlace de la receta copiado.'); }
    } catch { /* cancelado */ }
  };

  return (
    <>
      <div className="backdrop" onClick={onClose} />
      <aside ref={panelRef} className="drawer" role="dialog" aria-modal="true" aria-label={recipe ? recipe.name : 'Detalle de la receta'}>
        <button ref={closeRef} className="drawer-close" onClick={onClose} aria-label="Cerrar receta">×</button>

        <div className="drawer-scroll">
          {!recipe && !loadError && <p className="drawer-status" role="status">Cargando receta…</p>}
          {loadError && <p className="alert drawer-status" role="alert">{loadError}</p>}

          {recipe && (
            <>
              <div
                className="drawer-photo"
                data-empty={recipe.image ? undefined : ''}
                style={recipe.image ? { backgroundImage: `url(${JSON.stringify(recipe.image)}), linear-gradient(135deg, #14302b, #3f9b6b)` } : undefined}
              >
                {recipe.imageCredit && (
                  <small>
                    Foto de <a href={recipe.imageCredit.link} target="_blank" rel="noreferrer">{recipe.imageCredit.name}</a> en{' '}
                    <a href="https://unsplash.com/?utm_source=smart_pocket_chef&utm_medium=referral" target="_blank" rel="noreferrer">Unsplash</a>
                  </small>
                )}
              </div>

              <div className="drawer-content">
                <div>
                  <h2>{recipe.name}</h2>
                  <p className="drawer-meta">{[recipe.category, recipe.area].filter(Boolean).join(' · ')}</p>
                </div>

                <div className="drawer-actions">
                  <button className="btn" aria-pressed={isFav} onClick={() => onToggleFav(recipe)}>
                    {isFav ? 'Quitar de favoritos' : 'Guardar en favoritos'}
                  </button>
                  {recipe.youtube && <a className="btn" href={recipe.youtube} target="_blank" rel="noreferrer">Ver video</a>}
                  <button className="btn" onClick={shareLink}>Compartir</button>
                </div>

                <section>
                  <h3>Ingredientes</h3>
                  <p className="muted">Marca los que ya tienes. Lo demás va a tu lista de compras.</p>
                  <IngredientGroup title="Te falta comprar" kind="missing" items={missing} checked={false} onToggle={toggle} empty="Ya tienes todo lo necesario." />
                  <IngredientGroup title="Ya los tienes" kind="owned" items={owned} checked onToggle={toggle} empty="Aún no marcaste ningún ingrediente." />
                </section>

                <section>
                  <h3>Lista para el celular</h3>
                  <p className="muted">Genera un código QR con lo que te falta y escanéalo en el supermercado, o suma estos ingredientes a tu lista con otras recetas.</p>
                  <div className="qr-trigger">
                    <button className="btn btn-primary" onClick={makeQr} disabled={!missing.length || qrBusy}>
                      {qrBusy ? 'Generando…' : 'Generar QR de la lista'}
                    </button>
                    <button className="btn" onClick={addToList} disabled={!missing.length}>Agregar a mi lista de compras</button>
                  </div>
                  {qrError && <p className="alert" role="alert">{qrError}</p>}
                  {qr && <QRModule qr={qr} loggedIn={Boolean(user)} notify={notify} />}
                </section>

                <section>
                  <h3>Preparación</h3>
                  {recipe.steps.length ? (
                    <>
                      <p className="muted">Toca un paso para marcarlo como hecho.</p>
                      <ol className="steps">
                        {recipe.steps.map((s, i) => (
                          <li key={i}>
                            <button type="button" className="step" aria-pressed={done.has(i)} onClick={() => toggleStep(i)}>{s}</button>
                          </li>
                        ))}
                      </ol>
                    </>
                  ) : (
                    <p className="muted">Esta receta no trae instrucciones.</p>
                  )}
                  {recipe.translationFailed && (
                    <p className="notice" role="status">
                      No pudimos traducir esta receta ahora: el servicio de traducción no respondió o llegó a su límite diario.
                      Se muestra en inglés; vuelve a abrirla más tarde y saldrá en español.
                    </p>
                  )}
                  {recipe.translation && !recipe.translationFailed && (
                    <p className="muted translation-note">
                      Receta traducida automáticamente del inglés; algunas frases pueden sonar literales.
                      {recipe.source && <> Original: <a href={recipe.source} target="_blank" rel="noreferrer">fuente</a>.</>}
                    </p>
                  )}
                </section>
              </div>
            </>
          )}
        </div>
      </aside>
    </>
  );
}
