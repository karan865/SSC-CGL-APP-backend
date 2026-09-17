import { Router } from 'express';
import {
  startMockTestHandler,
  saveAnswerHandler,
  advanceSectionHandler,
  submitMockTestHandler,
  getMockReviewHandler,
  getMarkedQuestionsHandler,
} from '../controllers/mockTestController';

const router = Router();

router.post('/start', startMockTestHandler);
router.get('/marked-questions', getMarkedQuestionsHandler);
router.post('/:sessionId/answer', saveAnswerHandler);
router.post('/:sessionId/section-lock', advanceSectionHandler);
router.post('/:sessionId/submit', submitMockTestHandler);
router.get('/:sessionId/review', getMockReviewHandler);

export default router;
