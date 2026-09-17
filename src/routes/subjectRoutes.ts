import { Router } from 'express';
import { getSubjects } from '../controllers/subjectController';
import { getTopicsBySubject } from '../controllers/topicController';

const router = Router();

router.get('/', getSubjects);
router.get('/:subjectId/topics', getTopicsBySubject);

export default router;
