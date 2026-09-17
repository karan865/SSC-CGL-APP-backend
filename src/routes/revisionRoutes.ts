import { Router } from 'express';
import {
  getRevisionSummaryHandler,
  getDueRevisionsHandler,
  startRevisionHandler,
  submitRevisionAnswerHandler,
  getRevisionStatsHandler,
} from '../controllers/revisionController';

const router = Router();

router.get('/', getRevisionSummaryHandler);
router.get('/summary', getRevisionSummaryHandler);
router.get('/due', getDueRevisionsHandler);
router.post('/start', startRevisionHandler);
router.post('/answer', submitRevisionAnswerHandler);
router.get('/stats', getRevisionStatsHandler);

export default router;
