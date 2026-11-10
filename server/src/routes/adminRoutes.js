import { Router } from 'express';
import { requireAuth, requireDb, verifyAdmin } from '../middleware/auth.js';
import { deleteUser, getStats, listUsers, setUserRole } from '../controllers/adminController.js';
import { createRecipe, deleteRecipe, getRecipeById, listRecipes, updateRecipe } from '../controllers/adminRecipesController.js';
import { wrap } from '../utils/http.js';

const router = Router();

// Todo el panel exige, en este orden: base lista, sesión válida (JWT) y rol de administrador (consultado en MySQL)
router.use(requireDb, requireAuth, verifyAdmin);

router.get('/users', wrap(listUsers));
router.put('/users/:id/role', wrap(setUserRole));
router.delete('/users/:id', wrap(deleteUser));
router.get('/stats', wrap(getStats));

// Recetas propias (comida peruana)
router.get('/recipes', wrap(listRecipes));
router.get('/recipes/:id', wrap(getRecipeById));
router.post('/recipes', wrap(createRecipe));
router.put('/recipes/:id', wrap(updateRecipe));
router.delete('/recipes/:id', wrap(deleteRecipe));

export default router;
