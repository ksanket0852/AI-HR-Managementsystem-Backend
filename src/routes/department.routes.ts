import { Router } from 'express';
import { departmentController } from '../controllers/department.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

// All department routes are protected
router.use(authMiddleware);

router.post('/', departmentController.create);
router.get('/', departmentController.getAll);
router.get('/:id', departmentController.getById);
router.put('/:id', departmentController.update);
router.delete('/:id', departmentController.delete);

export default router; 