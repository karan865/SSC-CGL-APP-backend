import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

import { Exam, IExam } from '../models/Exam';
import { ExamStage, IExamStage } from '../models/ExamStage';
import { ExamPaper, IExamPaper } from '../models/ExamPaper';

export interface SeededSSCExamHierarchy {
  exam: IExam;
  stage: IExamStage;
  paper: IExamPaper;
}

/**
 * Ensures that the root SSC CGL Exam, Stage (Tier 1), and Paper (Tier 1) exist.
 * This operation is 100% idempotent and uses upsert logic.
 */
export async function ensureSSCExamHierarchy(): Promise<SeededSSCExamHierarchy> {
  // 1. Exam: SSC CGL
  const exam = await Exam.findOneAndUpdate(
    { slug: 'ssc-cgl' },
    {
      $set: {
        name: 'SSC CGL',
        slug: 'ssc-cgl',
        description: 'Staff Selection Commission - Combined Graduate Level Examination',
        icon: 'trophy-outline',
        order: 1,
        isActive: true,
      },
    },
    { upsert: true, returnDocument: 'after' }
  );

  // 2. Stage: Tier 1
  const stage = await ExamStage.findOneAndUpdate(
    { examId: exam._id, slug: 'tier-1' },
    {
      $set: {
        examId: exam._id,
        name: 'Tier 1',
        slug: 'tier-1',
        order: 1,
        isActive: true,
      },
    },
    { upsert: true, returnDocument: 'after' }
  );

  // 3. Paper: Tier 1
  const paper = await ExamPaper.findOneAndUpdate(
    { stageId: stage._id, slug: 'tier-1' },
    {
      $set: {
        examId: exam._id,
        stageId: stage._id,
        name: 'Tier 1',
        slug: 'tier-1',
        order: 1,
        totalQuestions: 100,
        totalMarks: 200,
        durationMinutes: 60,
        scoring: {
          correctMarks: 2,
          wrongMarks: -0.5,
          unansweredMarks: 0,
        },
        isActive: true,
      },
    },
    { upsert: true, returnDocument: 'after' }
  );

  return { exam, stage, paper };
}

async function runStandalone() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error('❌ MONGODB_URI is not defined in .env');
    process.exit(1);
  }

  console.log('Connecting to MongoDB Atlas...');
  await mongoose.connect(mongoUri);
  console.log('✅ Connected to MongoDB.\n');

  console.log('Seeding SSC CGL Exam Hierarchy (Idempotent)...');
  const result = await ensureSSCExamHierarchy();

  console.log('\n--- Seeded Hierarchy Summary ---');
  console.log(`Exam  : ${result.exam.name} [slug: ${result.exam.slug}, id: ${result.exam._id}]`);
  console.log(`Stage : ${result.stage.name} [slug: ${result.stage.slug}, id: ${result.stage._id}]`);
  console.log(`Paper : ${result.paper.name} [slug: ${result.paper.slug}, id: ${result.paper._id}]`);
  console.log('Scoring: +2 correct, -0.5 wrong, 0 unanswered');
  console.log('--------------------------------\n');

  await mongoose.disconnect();
  console.log('Disconnected from MongoDB. Seed completed successfully.');
}

if (require.main === module) {
  runStandalone().catch((err) => {
    console.error('Fatal error during hierarchy seed:', err);
    process.exit(1);
  });
}
