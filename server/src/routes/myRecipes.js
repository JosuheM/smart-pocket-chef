import { Router } from 'express';
import { requireAuth, requireDb } from '../middleware/auth.js';
import { createMine, deleteMine, editMine, listMine, showMine, updateMine } from '../controllers/myRecipesController.js';
import { wrap } from '../utils/http.js';

const router = Router();
router.use(requireDb, requireAuth);

router.get('/', wrap(listMine));
router.post('/', wrap(createMine));
router.get('/:id/edit', wrap(editMine));
router.get('/:id', wrap(showMine));
router.put('/:id', wrap(updateMine));
router.delete('/:id', wrap(deleteMine));

export default router;
