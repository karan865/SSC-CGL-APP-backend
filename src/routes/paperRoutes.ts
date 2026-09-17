import { Router } from 'express';
import { getPaperSubjects } from '../controllers/examController';

const router = Router();

router.get('/:paperId/subjects', getPaperSubjects);

export default router;
