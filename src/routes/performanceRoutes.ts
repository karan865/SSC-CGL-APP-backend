import { Router } from 'express';
import {
  getPerformanceHandler,
  getRecommendationsHandler,
  getTopicPerformanceHandler,
} from '../controllers/performanceController';

const router = Router();

// GET /api/performance or /api/performance/summary - Get full user performance analytics
router.get('/', getPerformanceHandler);
router.get('/summary', getPerformanceHandler);

// GET /api/performance/recommendations - Get personalized next practice recommendations
router.get('/recommendations', getRecommendationsHandler);

// GET /api/performance/topics/:topicId - Get specific topic historical analytics
router.get('/topics/:topicId', getTopicPerformanceHandler);

export default router;
