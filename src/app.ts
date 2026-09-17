import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { errorHandler } from './middleware/errorHandler';
import { notFound } from './middleware/notFound';

import healthRoutes from './routes/healthRoutes';
import examRoutes from './routes/examRoutes';
import stageRoutes from './routes/stageRoutes';
import paperRoutes from './routes/paperRoutes';
import subjectRoutes from './routes/subjectRoutes';
import practiceRoutes from './routes/practiceRoutes';
import mockTestRoutes from './routes/mockTestRoutes';
import performanceRoutes from './routes/performanceRoutes';
import revisionRoutes from './routes/revisionRoutes';
import studyPlanRoutes from './routes/studyPlanRoutes';
import streakRoutes from './routes/streakRoutes';

const app = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Rate limiting (generous window to support 100-question interactive mock tests)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000,
});
app.use('/api', limiter);

// Routes
app.use('/api/health', healthRoutes);
app.use('/api/exams', examRoutes);
app.use('/api/stages', stageRoutes);
app.use('/api/papers', paperRoutes);
app.use('/api/subjects', subjectRoutes);
app.use('/api/practice', practiceRoutes);
app.use('/api/mock-tests', mockTestRoutes);
app.use('/api/performance', performanceRoutes);
app.use('/api/revision', revisionRoutes);
app.use('/api/study-plan', studyPlanRoutes);
app.use('/api/streak', streakRoutes);

// Error Handling
app.use(notFound);
app.use(errorHandler);

export default app;
