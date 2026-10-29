import { Router } from 'express';
import {
  exploreRecipes, getRecipe, heroImage, ingredientSuggestions, randomRecipeId, recipeMeta, searchRecipes,
} from '../services/mealdb.js';
import { HttpError, clampInt, wrap } from '../utils/http.js';

const router = Router();
const list = (v) => String(v ?? '').split(',').map((s) => s.trim()).filter(Boolean);
const paging = (q) => ({ limit: clampInt(q.limit, 12, 1, 24), offset: clampInt(q.offset, 0, 0, 2000) });
const flag = (v) => v === '1' || v === 'true';

// GET /api/recipes/search?ingredients=pollo,tomate&mode=any|all&sort=match|missing&category=Chicken&pantry=1&limit=12&offset=0
router.get('/search', wrap(async (req, res) => {
  const terms = list(req.query.ingredients);
  if (!terms.length) throw new HttpError(400, 'Escribe al menos un ingrediente.');
  res.json(await searchRecipes({
    terms,
    mode: req.query.mode,
    sort: req.query.sort,
    category: String(req.query.category ?? ''),
    pantry: flag(req.query.pantry),
    ...paging(req.query),
  }));
}));

// GET /api/recipes/explore?q=lasaña&category=Pasta&area=Peruvian  (por nombre, categoría y/o país)
router.get('/explore', wrap(async (req, res) => {
  const q = String(req.query.q ?? '').trim().slice(0, 60);
  const category = String(req.query.category ?? '');
  const area = String(req.query.area ?? '');
  if (!q && !category && !area) throw new HttpError(400, 'Escribe el nombre de un platillo o elige una categoría.');
  res.json(await exploreRecipes({ q, category, area, ...paging(req.query) }));
}));

// GET /api/recipes/peru  -> atajo: los platos peruanos (propios, TheMealDB no trae ninguno)
router.get('/peru', wrap(async (req, res) => {
  res.json(await exploreRecipes({ q: '', category: String(req.query.category ?? ''), area: 'Peruvian', ...paging(req.query) }));
}));

// GET /api/recipes/ingredients?q=pol  -> sugerencias para el autocompletado
router.get('/ingredients', (req, res) => {
  res.json(ingredientSuggestions(String(req.query.q ?? '').slice(0, 40)));
});

router.get('/meta', wrap(async (req, res) => res.json(await recipeMeta())));

router.get('/random', wrap(async (req, res) => {
  const id = await randomRecipeId();
  if (!id) throw new HttpError(404, 'No hay recetas disponibles.');
  res.json({ id });
}));

// Foto de portada (Unsplash). Responde {} si no hay clave o se agotó la cuota.
router.get('/hero', wrap(async (req, res) => res.json((await heroImage()) ?? {})));

// GET /api/recipes/52772?have=pollo,ajo&pantry=1 -> receta completa, con cada ingrediente marcado como "have"
router.get('/:id', wrap(async (req, res) => {
  if (!/^\d+$/.test(req.params.id)) throw new HttpError(400, 'Identificador de receta inválido.');
  res.json(await getRecipe(req.params.id, list(req.query.have), flag(req.query.pantry)));
}));

export default router;
