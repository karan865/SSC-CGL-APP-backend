import { Router } from 'express';
import {
  startPracticeTest,
  submitAnswer,
  markQuestionHandler,
} from '../controllers/practiceController';

const router = Router();

router.post('/start', startPracticeTest);
router.post('/answer', submitAnswer);
router.post('/mark', markQuestionHandler);

export default router;
