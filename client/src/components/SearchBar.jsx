import { useEffect, useId, useRef, useState } from 'react';
import { api } from '../api.js';

const SUGGESTIONS = ['pollo', 'tomate', 'ajo', 'arroz', 'huevos'];
const NAME_IDEAS = ['lasaña', 'sopa', 'pastel', 'curry', 'ensalada'];
const MAX = 10;
const same = (a, b) => a.trim().toLowerCase() === b.trim().toLowerCase();

export default function SearchBar({
  mode, onMode, ingredients, onChange, onSearch, nameValue, onNameChange, onNameSearch, loading, pantry, onPantry,
}) {
  const [text, setText] = useState('');
  const [options, setOptions] = useState([]);
  const [active, setActive] = useState(-1);
  const inputRef = useRef(null);
  const listId = useId();
  const byName = mode === 'name';

  // Autocompletado con los ingredientes que conoce el servidor (en español)
  useEffect(() => {
    const q = text.trim();
    if (byName || !q) { setOptions([]); return undefined; }
    let alive = true;
    const timer = setTimeout(() => {
      api.suggest(q)
        .then((list) => alive && setOptions(list.filter((s) => !ingredients.some((x) => same(x, s)))))
        .catch(() => alive && setOptions([]));
    }, 140);
    return () => { alive = false; clearTimeout(timer); };
  }, [text, ingredients, byName]);

  useEffect(() => setActive(-1), [options]);

  // Agrega uno o varios ingredientes (separados por coma) y devuelve la lista resultante
  const add = (raw) => {
    const next = [...ingredients];
    for (const part of raw.split(',').map((s) => s.trim()).filter(Boolean)) {
      if (next.length < MAX && !next.some((x) => same(x, part))) next.push(part);
    }
    onChange(next);
    setText('');
    setOptions([]);
    return next;
  };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown' && options.length) {
      e.preventDefault();
      setActive((i) => (i + 1) % options.length);
    } else if (e.key === 'ArrowUp' && options.length) {
      e.preventDefault();
      setActive((i) => (i <= 0 ? options.length - 1 : i - 1));
    } else if (e.key === 'Escape' && options.length) {
      e.stopPropagation();
      setOptions([]);
    } else if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      if (active >= 0 && options[active]) add(options[active]);
      else if (text.trim()) add(text);
      else if (e.key === 'Enter' && ingredients.length) onSearch(ingredients);
    } else if (e.key === 'Backspace' && !text && ingredients.length) {
      onChange(ingredients.slice(0, -1));
    }
  };

  const submit = (e) => {
    e.preventDefault();
    if (byName) {
      if (nameValue.trim()) onNameSearch(nameValue.trim());
      return;
    }
    const list = text.trim() ? add(text) : ingredients;
    if (list.length) onSearch(list);
  };

  return (
    <form className="finder" onSubmit={submit}>
      <div className="mode-switch" role="group" aria-label="Tipo de búsqueda">
        <button type="button" aria-pressed={!byName} onClick={() => onMode('ingredients')}>Por ingredientes</button>
        <button type="button" aria-pressed={byName} onClick={() => onMode('name')}>Por nombre</button>
      </div>

      {byName ? (
        <>
          <label className="finder-label" htmlFor="name-input">¿Qué plato quieres cocinar?</label>
          <div className="finder-field">
            <input
              id="name-input"
              value={nameValue}
              onChange={(e) => onNameChange(e.target.value)}
              placeholder="Por ejemplo: lasaña, sopa de pollo, pastel de manzana"
              autoComplete="off"
              maxLength={60}
              enterKeyHint="search"
            />
          </div>
          <div className="finder-actions">
            <p className="suggest">
              Prueba con:{' '}
              {NAME_IDEAS.map((s) => (
                <button type="button" key={s} className="btn-link" onClick={() => onNameSearch(s)}>{s}</button>
              ))}
            </p>
            <button className="btn btn-primary" type="submit" disabled={loading || !nameValue.trim()}>
              {loading ? 'Buscando…' : 'Buscar recetas'}
            </button>
          </div>
        </>
      ) : (
        <>
          <label className="finder-label" htmlFor="ingredient-input">Ingredientes que tienes</label>

          <div className="finder-field" onClick={() => inputRef.current?.focus()}>
            {ingredients.length > 0 && (
              <ul className="magnets" aria-label="Ingredientes agregados">
                {ingredients.map((ing, i) => (
                  <li key={ing} className="magnet" data-tone={i % 3}>
                    <span>{ing}</span>
                    <button
                      type="button"
                      aria-label={`Quitar ${ing}`}
                      onClick={(e) => { e.stopPropagation(); onChange(ingredients.filter((x) => x !== ing)); }}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="combo">
              <input
                id="ingredient-input"
                ref={inputRef}
                role="combobox"
                aria-expanded={options.length > 0}
                aria-controls={listId}
                aria-autocomplete="list"
                aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={onKeyDown}
                onBlur={() => setTimeout(() => setOptions([]), 120)}
                placeholder={ingredients.length ? 'Agrega otro' : 'Por ejemplo: pollo, tomate, ajo'}
                autoComplete="off"
                maxLength={40}
                enterKeyHint="done"
              />
              {options.length > 0 && (
                <ul className="options" id={listId} role="listbox">
                  {options.map((o, i) => (
                    <li
                      key={o}
                      id={`${listId}-${i}`}
                      role="option"
                      aria-selected={i === active}
                      onMouseDown={(e) => { e.preventDefault(); add(o); inputRef.current?.focus(); }}
                    >
                      {o}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <label className="pantry">
            <input type="checkbox" checked={pantry} onChange={(e) => onPantry(e.target.checked)} />
            <span>Tengo lo básico en casa <small>(sal, pimienta, agua y aceite)</small></span>
          </label>

          <div className="finder-actions">
            <p className="muted">Separa con coma o Enter. Hasta {MAX} ingredientes.</p>
            <button className="btn btn-primary" type="submit" disabled={loading || (!ingredients.length && !text.trim())}>
              {loading ? 'Buscando…' : 'Buscar recetas'}
            </button>
          </div>

          {!ingredients.length && !text && (
            <p className="suggest">
              Prueba con:{' '}
              {SUGGESTIONS.map((s) => (
                <button type="button" key={s} className="btn-link" onClick={() => add(s)}>{s}</button>
              ))}
            </p>
          )}
        </>
      )}
    </form>
  );
}
