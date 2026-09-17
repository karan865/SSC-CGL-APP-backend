import { Router } from 'express';
import {
  getExams,
  getExamStages,
  getStagePapers,
} from '../controllers/examController';

const router = Router();

router.get('/', getExams);
router.get('/:examId/stages', getExamStages);
router.get('/:examId/stages/:stageId/papers', getStagePapers);

export default router;
