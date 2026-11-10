import { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import { PLAN_MAX, useModal, useSpeech } from '../hooks.js';
import { scaleMeasure } from '../utils/measures.js';
import QRModule from './QRModule.jsx';
import RecipeNotes from './RecipeNotes.jsx';
import ShareDialog from './ShareDialog.jsx';
import KitchenMode from './KitchenMode.jsx';

const SERVINGS = [2, 4, 6]; // las recetas base son para 2 personas

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

export default function RecipeDrawer({ id, haveTerms, pantry, user, diet, plan, isFav, onToggleFav, onAddToList, onNeedLogin, onClose, notify }) {
  const [recipe, setRecipe] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [have, setHave] = useState(new Set()); // índices de ingredientes que el usuario ya tiene
  const [done, setDone] = useState(new Set()); // pasos marcados como hechos
  const [servings, setServings] = useState(2);
  const [qr, setQr] = useState(null);
  const [qrBusy, setQrBusy] = useState(false);
  const [qrError, setQrError] = useState('');
  const [sharing, setSharing] = useState(false);
  const [cooking, setCooking] = useState(false);
  const [reading, setReading] = useState(-1); // paso que se está leyendo en voz alta
  const speech = useSpeech();
  const panelRef = useRef(null);
  const closeRef = useRef(null);

  // Mientras el modo cocina o el diálogo de compartir están encima, Escape no debe cerrar también la receta
  useModal(panelRef, () => { if (!sharing && !cooking) onClose(); });
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

  const changeServings = (n) => { setServings(n); setQr(null); };

  // Las cantidades se multiplican en el navegador: la receta base es para 2 personas
  const scaled = recipe ? recipe.ingredients.map((ing) => ({ ...ing, measure: scaleMeasure(ing.measure, servings / 2) })) : [];
  const indexed = scaled.map((ing, i) => ({ ...ing, i }));
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

  const addToPlan = () => {
    const result = plan.add({ id: recipe.id, name: recipe.name, image: recipe.image }, servings);
    if (result === 'added') notify(`Agregada al plan semanal (${plan.meals.length + 1} de ${PLAN_MAX}).`);
    else if (result === 'exists') notify('Esa receta ya está en tu plan semanal.');
    else notify(`El plan semanal admite hasta ${PLAN_MAX} recetas. Quita alguna para agregar esta.`, 'error');
  };

  const readStep = (i) => {
    if (reading === i && speech.speaking) { speech.stop(); setReading(-1); return; }
    setReading(i);
    speech.speak(recipe.steps[i], () => setReading(-1));
  };

  const closeKitchen = () => { setCooking(false); speech.stop(); setReading(-1); };

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
                  {recipe.allergens?.length > 0 && (
                    <p className="allergens" aria-label="Contiene">
                      Contiene:{' '}
                      {recipe.allergens.map((a) => {
                        const avoided = (a === 'gluten' && diet.includes('gluten')) || (a === 'lácteos' && diet.includes('dairy')) || (a === 'frutos secos' && diet.includes('nuts'));
                        return <span key={a} className="allergen" data-warn={avoided ? '' : undefined}>{avoided ? `⚠ ${a}` : a}</span>;
                      })}
                    </p>
                  )}
                </div>

                <div className="drawer-actions">
                  {recipe.steps.length > 0 && <button className="btn btn-primary" onClick={() => setCooking(true)}>Modo cocina</button>}
                  <button className="btn" aria-pressed={isFav} onClick={() => onToggleFav(recipe)}>
                    {isFav ? 'Quitar de favoritos' : 'Guardar en favoritos'}
                  </button>
                  <button className="btn" aria-pressed={plan.has(recipe.id)} onClick={addToPlan} disabled={plan.has(recipe.id)}>
                    {plan.has(recipe.id) ? 'En el plan semanal' : 'Agregar al plan semanal'}
                  </button>
                  {!recipe.mine && <button className="btn" onClick={() => setSharing(true)}>Compartir</button>}
                  {recipe.youtube && <a className="btn" href={recipe.youtube} target="_blank" rel="noreferrer">Ver video</a>}
                </div>

                <section>
                  <div className="servings-head">
                    <h3>Ingredientes</h3>
                    <div className="servings" role="group" aria-label="Porciones">
                      <span>Para</span>
                      {SERVINGS.map((n) => (
                        <button key={n} type="button" className="chip" aria-pressed={servings === n} onClick={() => changeServings(n)}>
                          {n} personas
                        </button>
                      ))}
                    </div>
                  </div>
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
                      <p className="muted">
                        Toca un paso para marcarlo como hecho.
                        {servings !== 2 && ' Las cantidades que aparecen dentro de los pasos son las de la receta original.'}
                      </p>
                      <ol className="steps">
                        {recipe.steps.map((s, i) => (
                          <li key={i}>
                            <div className="step-row">
                              <button type="button" className="step" aria-pressed={done.has(i)} onClick={() => toggleStep(i)}>{s}</button>
                              {speech.supported && (
                                <button
                                  type="button"
                                  className="step-voice"
                                  aria-pressed={reading === i && speech.speaking}
                                  aria-label={reading === i && speech.speaking ? `Detener lectura del paso ${i + 1}` : `Escuchar el paso ${i + 1}`}
                                  title={reading === i && speech.speaking ? 'Detener' : 'Escuchar paso'}
                                  onClick={() => readStep(i)}
                                >
                                  {reading === i && speech.speaking ? '■' : '🔊'}
                                </button>
                              )}
                            </div>
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

                <RecipeNotes recipe={recipe} user={user} onNeedLogin={onNeedLogin} notify={notify} />
              </div>
            </>
          )}
        </div>
      </aside>

      {sharing && recipe && <ShareDialog recipe={recipe} onClose={() => setSharing(false)} notify={notify} />}
      {cooking && recipe && <KitchenMode recipe={{ ...recipe, ingredients: scaled }} onClose={closeKitchen} notify={notify} />}
    </>
  );
}
