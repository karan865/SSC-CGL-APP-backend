import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

import { QuestionAttempt } from '../models/QuestionAttempt';
import { Subject } from '../models/Subject';
import { Exam } from '../models/Exam';

export async function backfillAttemptExamIds() {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/ssc-cgl-app';
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(mongoUri);
  }

  const sscExam = await Exam.findOne({ slug: 'ssc-cgl' });
  if (!sscExam) {
    console.error('SSC Exam not found.');
    return;
  }

  // Find all attempts missing examId or where examId is null
  const unassigned = await QuestionAttempt.find({
    $or: [{ examId: { $exists: false } }, { examId: null }],
  });

  console.log(`Found ${unassigned.length} legacy attempts missing examId.`);

  let updatedCount = 0;
  for (const attempt of unassigned) {
    const subDoc = await Subject.findById(attempt.subjectId);
    const targetExamId = subDoc?.examId || sscExam._id;
    attempt.examId = targetExamId as any;
    if (subDoc?.stageId && !attempt.stageId) {
      attempt.stageId = subDoc.stageId as any;
    }
    if (subDoc?.paperId && !attempt.paperId) {
      attempt.paperId = subDoc.paperId as any;
    }
    await attempt.save();
    updatedCount++;
  }

  console.log(`✅ Successfully backfilled ${updatedCount} attempts with correct examId.`);
}

if (require.main === module) {
  backfillAttemptExamIds()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
