import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

import { Exam } from '../models/Exam';
import { ExamStage } from '../models/ExamStage';
import { ExamPaper } from '../models/ExamPaper';
import { Subject } from '../models/Subject';
import { Topic } from '../models/Topic';
import { Question } from '../models/Question';
import { ensureSSCExamHierarchy } from './seedExamHierarchy';

export interface MigrationResult {
  examId: mongoose.Types.ObjectId;
  stageId: mongoose.Types.ObjectId;
  paperId: mongoose.Types.ObjectId;
  subjectsMigrated: number;
  topicsMigrated: number;
  questionsMigrated: number;
}

/**
 * Migrates all existing SSC CGL Subjects, Topics, and Questions
 * to link directly to the SSC CGL hierarchy (Exam -> Tier 1 Stage -> Tier 1 Paper).
 *
 * This operation is 100% idempotent and safe to run multiple times.
 */
export async function migrateSSCData(): Promise<MigrationResult> {
  // 1. Ensure hierarchy exists (upsert)
  const { exam, stage, paper } = await ensureSSCExamHierarchy();
  const examId = exam._id as mongoose.Types.ObjectId;
  const stageId = stage._id as mongoose.Types.ObjectId;
  const paperId = paper._id as mongoose.Types.ObjectId;

  console.log(`Resolved Target Hierarchy:`);
  console.log(`- Exam  : ${exam.name} [${exam.slug}] -> ${examId}`);
  console.log(`- Stage : ${stage.name} [${stage.slug}] -> ${stageId}`);
  console.log(`- Paper : ${paper.name} [${paper.slug}] -> ${paperId}\n`);

  // 2. Identify canonical SSC Subject slugs
  const sscSubjectSlugs = [
    'quantitative-aptitude',
    'reasoning',
    'english',
    'general-awareness',
    'quant',
    'general_awareness',
  ];

  // 3. Migrate Subjects
  // Link all subjects matching SSC slugs or without an examId
  const subjectFilter = {
    $or: [
      { slug: { $in: sscSubjectSlugs } },
      { examId: { $exists: false } },
      { examId: null },
    ],
  };

  const subjectUpdateRes = await Subject.updateMany(subjectFilter, {
    $set: {
      examId,
      stageId,
      paperId,
    },
  });

  const allSscSubjects = await Subject.find({ examId });
  const sscSubjectIds = allSscSubjects.map((s) => s._id);

  console.log(`✅ Subjects Migrated: ${subjectUpdateRes.matchedCount} matched, ${subjectUpdateRes.modifiedCount} modified`);
  console.log(`   Total SSC Subjects now linked: ${sscSubjectIds.length}`);

  // 4. Migrate Topics
  // Link all topics that either reference SSC subjects or currently have no examId
  const topicFilter = {
    $or: [
      { subjectId: { $in: sscSubjectIds } },
      { examId: { $exists: false } },
      { examId: null },
    ],
  };

  const topicUpdateRes = await Topic.updateMany(topicFilter, {
    $set: {
      examId,
      stageId,
      paperId,
    },
  });

  const allSscTopics = await Topic.find({ examId });
  const sscTopicIds = allSscTopics.map((t) => t._id);

  console.log(`✅ Topics Migrated: ${topicUpdateRes.matchedCount} matched, ${topicUpdateRes.modifiedCount} modified`);
  console.log(`   Total SSC Topics now linked: ${sscTopicIds.length}`);

  // 5. Migrate Questions
  // Link all questions that belong to SSC subjects/topics or currently have no examId
  const questionFilter = {
    $or: [
      { subjectId: { $in: sscSubjectIds } },
      { topicId: { $in: sscTopicIds } },
      { examId: { $exists: false } },
      { examId: null },
    ],
  };

  const questionUpdateRes = await Question.updateMany(questionFilter, {
    $set: {
      examId,
      stageId,
      paperId,
      exam: 'SSC CGL',
      tier: 1,
    },
  });

  const totalSscQuestions = await Question.countDocuments({ examId });

  console.log(`✅ Questions Migrated: ${questionUpdateRes.matchedCount} matched, ${questionUpdateRes.modifiedCount} modified`);
  console.log(`   Total SSC Questions now linked: ${totalSscQuestions}\n`);

  return {
    examId,
    stageId,
    paperId,
    subjectsMigrated: sscSubjectIds.length,
    topicsMigrated: sscTopicIds.length,
    questionsMigrated: totalSscQuestions,
  };
}

async function runStandalone() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error('❌ MONGODB_URI is not defined in .env');
    process.exit(1);
  }

  console.log('====================================================');
  console.log('🔄 SSC CGL DATA MIGRATION & BACKFILL ENGINE');
  console.log('====================================================\n');

  console.log('Connecting to MongoDB Atlas...');
  await mongoose.connect(mongoUri);
  console.log('✅ Connected to MongoDB successfully.\n');

  const result = await migrateSSCData();

  console.log('====================================================');
  console.log('🎉 SSC DATA MIGRATION SUMMARY');
  console.log('====================================================');
  console.log(`- Linked Exam ID     : ${result.examId}`);
  console.log(`- Linked Stage ID    : ${result.stageId}`);
  console.log(`- Linked Paper ID    : ${result.paperId}`);
  console.log(`- Total Subjects     : ${result.subjectsMigrated}`);
  console.log(`- Total Topics       : ${result.topicsMigrated}`);
  console.log(`- Total Questions    : ${result.questionsMigrated}`);
  console.log('====================================================\n');

  // Perform post-migration integrity verification
  console.log('🔍 Running Post-Migration Integrity Checks...');
  const unmigratedSubjects = await Subject.countDocuments({ examId: null });
  const unmigratedTopics = await Topic.countDocuments({ examId: null });
  const unmigratedQuestions = await Question.countDocuments({ examId: null });

  console.log(`- Unmigrated Subjects  : ${unmigratedSubjects}`);
  console.log(`- Unmigrated Topics    : ${unmigratedTopics}`);
  console.log(`- Unmigrated Questions : ${unmigratedQuestions}`);

  if (unmigratedSubjects === 0 && unmigratedTopics === 0 && unmigratedQuestions === 0) {
    console.log('\n🌟 ZERO ORPHANED DOCUMENTS! All content is cleanly linked to SSC CGL.');
  } else {
    console.warn('\n⚠️ Warning: Some documents remained unlinked.');
  }

  await mongoose.disconnect();
  console.log('\nDisconnected from MongoDB. Migration completed successfully.');
}

if (require.main === module) {
  runStandalone().catch((err) => {
    console.error('Fatal migration error:', err);
    process.exit(1);
  });
}
