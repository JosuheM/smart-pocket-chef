import { Router } from 'express';
import { requireAuth, requireDb, verifyAdmin } from '../middleware/auth.js';
import { deleteUser, getStats, listUsers, setUserRole } from '../controllers/adminController.js';
import { wrap } from '../utils/http.js';

const router = Router();

// Todo el panel exige, en este orden: base lista, sesión válida (JWT) y rol de administrador (consultado en MySQL)
router.use(requireDb, requireAuth, verifyAdmin);

router.get('/users', wrap(listUsers));
router.put('/users/:id/role', wrap(setUserRole));
router.delete('/users/:id', wrap(deleteUser));
router.get('/stats', wrap(getStats));

export default router;
