import { Router } from 'express';
import {
  getTodayPlanHandler,
  generatePlanHandler,
  startPlanHandler,
  completePlanItemHandler,
  getPlanProgressHandler,
  updateGoalHandler,
} from '../controllers/studyPlanController';

const router = Router();

router.get('/today', getTodayPlanHandler);
router.post('/generate', generatePlanHandler);
router.post('/start', startPlanHandler);
router.post('/item/:itemId/complete', completePlanItemHandler);
router.get('/progress', getPlanProgressHandler);
router.patch('/goal', updateGoalHandler);

export default router;
