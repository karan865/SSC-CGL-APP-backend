import { Router } from 'express';
import { getStagePapers } from '../controllers/examController';

const router = Router();

router.get('/:stageId/papers', getStagePapers);

export default router;
