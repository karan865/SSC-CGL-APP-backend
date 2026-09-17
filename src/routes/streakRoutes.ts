import { Router } from 'express';
import { getStreak, completeGoal } from '../controllers/streakController';

const router = Router();

router.get('/', getStreak);
router.post('/complete', completeGoal);

export default router;
