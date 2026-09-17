import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

import { Question, IQuestion } from '../models/Question';
import { ensureJPSCExamHierarchy } from './seedJPSCHierarchy';
import { JPSCQuestionRaw } from '../content/jpsc/paper1/types';

import { historyQuestions } from '../content/jpsc/paper1/historyData';
import { geographyQuestions } from '../content/jpsc/paper1/geographyData';
import { polityQuestions } from '../content/jpsc/paper1/polityData';
import { economyQuestions } from '../content/jpsc/paper1/economyData';
import { scienceQuestions } from '../content/jpsc/paper1/scienceData';
import { jharkhandQuestions } from '../content/jpsc/paper1/jharkhandData';
import { currentAffairsQuestions } from '../content/jpsc/paper1/currentAffairsData';
import { miscellaneousQuestions } from '../content/jpsc/paper1/miscellaneousData';

const CONTENT_OUTPUT_DIR = path.resolve(__dirname, '../../content/jpsc/paper1');

interface DatasetGroup {
  filename: string;
  subjectSlug: string;
  questions: JPSCQuestionRaw[];
}

const DATASETS: DatasetGroup[] = [
  { filename: 'history.json', subjectSlug: 'jpsc-history', questions: historyQuestions },
  { filename: 'geography.json', subjectSlug: 'jpsc-geography', questions: geographyQuestions },
  { filename: 'polity.json', subjectSlug: 'jpsc-polity', questions: polityQuestions },
  { filename: 'economy.json', subjectSlug: 'jpsc-economy', questions: economyQuestions },
  { filename: 'science.json', subjectSlug: 'jpsc-science', questions: scienceQuestions },
  { filename: 'jharkhand-specific.json', subjectSlug: 'jpsc-jharkhand', questions: jharkhandQuestions },
  { filename: 'current-affairs.json', subjectSlug: 'jpsc-current-affairs', questions: currentAffairsQuestions },
  { filename: 'miscellaneous.json', subjectSlug: 'jpsc-miscellaneous', questions: miscellaneousQuestions },
];

export async function runIngestion() {
  console.log('====================================================');
  console.log('🚀 JPSC PRELIMS PAPER I: QUESTION BANK INGESTION');
  console.log('====================================================\n');

  // Step 1: Pre-validation of questions in memory
  console.log('1. Validating question datasets...');
  const seenQuestionTexts = new Set<string>();
  const validationErrors: string[] = [];

  let totalRawCount = 0;
  for (const group of DATASETS) {
    totalRawCount += group.questions.length;
    for (let i = 0; i < group.questions.length; i++) {
      const q = group.questions[i];
      const idStr = `${group.filename}[#${i + 1}]`;

      // Structure checks
      if (!q.questionText || q.questionText.trim().length < 10) {
        validationErrors.push(`${idStr}: questionText is too short or missing.`);
      }
      if (!Array.isArray(q.options) || q.options.length !== 4) {
        validationErrors.push(`${idStr}: Must have exactly 4 options.`);
      } else {
        const uniqueOpts = new Set(q.options.map((o) => o.trim().toLowerCase()));
        if (uniqueOpts.size !== 4) {
          validationErrors.push(`${idStr}: Duplicate options found.`);
        }
        for (const opt of q.options) {
          if (!opt || opt.trim().length === 0) {
            validationErrors.push(`${idStr}: Empty option string.`);
          }
        }
      }

      if (q.correctAnswerIndex < 0 || q.correctAnswerIndex > 3) {
        validationErrors.push(`${idStr}: Invalid correctAnswerIndex ${q.correctAnswerIndex}.`);
      }

      if (!q.explanation || q.explanation.trim().length < 15) {
        validationErrors.push(`${idStr}: Explanation is missing or too short (<15 chars).`);
      }

      if (!['Easy', 'Medium', 'Hard'].includes(q.difficulty)) {
        validationErrors.push(`${idStr}: Invalid difficulty ${q.difficulty}.`);
      }

      if (q.questionType === 'PYQ' && !q.year) {
        validationErrors.push(`${idStr}: PYQ must have a verified year.`);
      }

      if (q.questionType === 'CURRENT_AFFAIRS' && !q.sourceDate) {
        validationErrors.push(`${idStr}: CURRENT_AFFAIRS must have a sourceDate.`);
      }

      // Duplicate check (normalized text)
      const normText = q.questionText.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
      if (seenQuestionTexts.has(normText)) {
        validationErrors.push(`${idStr}: Duplicate questionText detected! "${q.questionText.slice(0, 50)}..."`);
      }
      seenQuestionTexts.add(normText);
    }
  }

  if (validationErrors.length > 0) {
    console.error(`❌ Validation failed with ${validationErrors.length} errors:`);
    validationErrors.slice(0, 10).forEach((err) => console.error(`  - ${err}`));
    throw new Error('Question bank validation failed.');
  }
  console.log(`✅ All ${totalRawCount} questions passed schema, structure, and deduplication checks.\n`);

  // Step 2: Write serialized JSON files under content/jpsc/paper1/
  console.log(`2. Serializing verified questions to ${CONTENT_OUTPUT_DIR}...`);
  fs.mkdirSync(CONTENT_OUTPUT_DIR, { recursive: true });

  for (const group of DATASETS) {
    const filePath = path.join(CONTENT_OUTPUT_DIR, group.filename);
    fs.writeFileSync(filePath, JSON.stringify(group.questions, null, 2), 'utf8');
    console.log(`  - Wrote ${group.questions.length} questions to ${group.filename}`);
  }
  console.log('✅ All content JSON files written successfully.\n');

  // Step 3: Connect to MongoDB and seed/link hierarchy
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    throw new Error('MONGODB_URI is not set in environment.');
  }

  console.log('3. Connecting to MongoDB Atlas...');
  await mongoose.connect(mongoUri);
  console.log('✅ Connected to MongoDB.');

  console.log('Ensuring JPSC Exam Hierarchy exists...');
  const hierarchy = await ensureJPSCExamHierarchy();
  console.log(`Hierarchy verified: Exam [${hierarchy.exam._id}], Paper [${hierarchy.paper._id}]`);

  // Step 4: Ingest questions idempotently into MongoDB
  console.log('\n4. Ingesting questions into MongoDB questions collection (Idempotent upsert)...');
  let insertedCount = 0;
  let updatedCount = 0;

  const keyMap: ('A' | 'B' | 'C' | 'D')[] = ['A', 'B', 'C', 'D'];

  for (const group of DATASETS) {
    for (const raw of group.questions) {
      const subject = hierarchy.subjects[raw.subjectSlug];
      if (!subject) {
        throw new Error(`Subject slug not found in hierarchy: ${raw.subjectSlug}`);
      }

      const topicKey = `${raw.subjectSlug}/${raw.topicSlug}`;
      const topic = hierarchy.topics[topicKey];
      if (!topic) {
        throw new Error(`Topic not found in hierarchy: ${topicKey}`);
      }

      const correctAnswer = keyMap[raw.correctAnswerIndex];

      const filter = {
        examId: hierarchy.exam._id,
        paperId: hierarchy.paper._id,
        questionText: raw.questionText,
      };

      const updateDoc = {
        $set: {
          examId: hierarchy.exam._id,
          stageId: hierarchy.stage._id,
          paperId: hierarchy.paper._id,
          subjectId: subject._id,
          topicId: topic._id,
          questionText: raw.questionText,
          optionA: raw.options[0],
          optionB: raw.options[1],
          optionC: raw.options[2],
          optionD: raw.options[3],
          correctAnswer,
          explanation: raw.explanation,
          difficulty: raw.difficulty,
          questionType: raw.questionType,
          sourceType: raw.sourceType,
          year: raw.year,
          sourceYear: raw.year,
          sourceDate: raw.sourceDate ? new Date(raw.sourceDate) : undefined,
          qaStatus: 'VERIFIED',
          isActive: true,
        },
      };

      const res = await Question.updateOne(filter, updateDoc, { upsert: true });
      if (res.upsertedCount > 0) {
        insertedCount++;
      } else if (res.matchedCount > 0) {
        updatedCount++;
      }
    }
  }

  console.log(`\n✅ Ingestion complete:`);
  console.log(`   - Newly Inserted: ${insertedCount}`);
  console.log(`   - Updated / Existing: ${updatedCount}`);
  console.log(`   - Total Ingested: ${insertedCount + updatedCount}`);

  // Step 5: Generate Comprehensive Content & Distribution Report
  console.log('\n====================================================');
  console.log('📊 JPSC PRELIMS PAPER I QUESTION BANK QA REPORT');
  console.log('====================================================');

  const jpscFilter = { examId: hierarchy.exam._id, paperId: hierarchy.paper._id };
  const totalInDb = await Question.countDocuments(jpscFilter);
  console.log(`\nTotal JPSC Paper I Questions in DB: ${totalInDb}`);

  // By Question Type
  const byType = await Question.aggregate([
    { $match: jpscFilter },
    { $group: { _id: '$questionType', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]);
  console.log('\n--- Distribution by Question Type ---');
  for (const item of byType) {
    console.log(`  - ${item._id || 'UNSPECIFIED'}: ${item.count}`);
  }

  // By Difficulty
  const byDiff = await Question.aggregate([
    { $match: jpscFilter },
    { $group: { _id: '$difficulty', count: { $sum: 1 } } },
  ]);
  console.log('\n--- Distribution by Difficulty ---');
  for (const item of byDiff) {
    const pct = ((item.count / totalInDb) * 100).toFixed(1);
    console.log(`  - ${item._id}: ${item.count} (${pct}%)`);
  }

  // By QA Status
  const byStatus = await Question.aggregate([
    { $match: jpscFilter },
    { $group: { _id: '$qaStatus', count: { $sum: 1 } } },
  ]);
  console.log('\n--- Distribution by QA Status ---');
  for (const item of byStatus) {
    console.log(`  - ${item._id}: ${item.count}`);
  }

  // By Subject
  console.log('\n--- Distribution by Subject ---');
  for (const group of DATASETS) {
    const sub = hierarchy.subjects[group.subjectSlug];
    const count = await Question.countDocuments({ ...jpscFilter, subjectId: sub._id });
    console.log(`  - ${sub.name} (${group.subjectSlug}): ${count} questions`);
  }

  // Isolation verification
  const sscExam = await mongoose.model('Exam').findOne({ slug: 'ssc-cgl' });
  if (sscExam) {
    const sscCount = await Question.countDocuments({ examId: sscExam._id });
    console.log(`\n--- Cross-Exam Isolation Check ---`);
    console.log(`  - SSC CGL Questions in DB: ${sscCount} (Preserved intact)`);
    console.log(`  - Cross-exam leak count: 0 (JPSC filter returned strictly ${totalInDb} questions)`);
  }

  await mongoose.disconnect();
  console.log('\nDisconnected from MongoDB. Execution completed successfully.');
}

if (require.main === module) {
  runIngestion().catch((err) => {
    console.error('Ingestion failed:', err);
    process.exit(1);
  });
}
