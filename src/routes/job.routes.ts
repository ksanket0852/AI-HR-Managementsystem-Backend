import { Router } from 'express';
import { jobController } from '../controllers/job.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

// Protect all job routes
router.use(authMiddleware);

router.post('/', jobController.create);
router.get('/', jobController.getAll);
router.get('/search', jobController.search);
router.get('/stats', jobController.stats);
router.get('/:id', jobController.getById);
router.put('/:id', jobController.update);
router.patch('/:id/status', jobController.updateStatus);
router.delete('/:id', jobController.delete);

router.get('/department/:departmentId', jobController.getByDepartment);
router.get('/poster/:posterId', jobController.getByPoster);

export default router;
