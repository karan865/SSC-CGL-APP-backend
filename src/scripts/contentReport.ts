import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

import { Subject } from '../models/Subject';
import { Topic } from '../models/Topic';
import { Question } from '../models/Question';

const CONTENT_DIR = path.resolve(__dirname, '../../content');
const TOPICS_FILE = path.join(CONTENT_DIR, 'topics.json');
const SUBJECTS_FILE = path.join(CONTENT_DIR, 'subjects.json');

async function runReport() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error('❌ MONGODB_URI is not defined in .env');
    process.exit(1);
  }

  console.log('========================================================================');
  console.log('📊 SSC CGL QUESTION BANK QUALITY & COVERAGE REPORT');
  console.log('========================================================================\n');

  await mongoose.connect(mongoUri);

  // 1. Overall Totals
  const totalQuestions = await Question.countDocuments({ isActive: true });
  const totalDraft = await Question.countDocuments({ qaStatus: 'DRAFT', isActive: true });
  const totalReview = await Question.countDocuments({ qaStatus: 'REVIEW', isActive: true });
  const totalVerified = await Question.countDocuments({
    $or: [{ qaStatus: 'VERIFIED' }, { qaStatus: { $exists: false } }],
    isActive: true,
  });
  const totalRejected = await Question.countDocuments({ qaStatus: 'REJECTED' });

  // Difficulty counts
  const easyCount = await Question.countDocuments({ difficulty: 'Easy', isActive: true });
  const mediumCount = await Question.countDocuments({ difficulty: 'Medium', isActive: true });
  const hardCount = await Question.countDocuments({ difficulty: 'Hard', isActive: true });

  // Question Type counts
  const pyqCount = await Question.countDocuments({ questionType: 'PYQ', isActive: true });
  const pyqInspiredCount = await Question.countDocuments({
    $or: [{ questionType: 'PYQ_INSPIRED' }, { questionType: { $exists: false } }],
    isActive: true,
  });
  const samplePaperCount = await Question.countDocuments({ questionType: 'SAMPLE_PAPER', isActive: true });
  const relatedPracticeCount = await Question.countDocuments({ questionType: 'RELATED_PRACTICE', isActive: true });

  console.log('📈 GLOBAL INVENTORY SUMMARY:');
  console.log('------------------------------------------------------------------------');
  console.log(`Total Active Questions : ${totalQuestions}`);
  console.log(`- Easy                 : ${easyCount} (${totalQuestions > 0 ? ((easyCount / totalQuestions) * 100).toFixed(1) : 0}%)`);
  console.log(`- Medium               : ${mediumCount} (${totalQuestions > 0 ? ((mediumCount / totalQuestions) * 100).toFixed(1) : 0}%)`);
  console.log(`- Hard                 : ${hardCount} (${totalQuestions > 0 ? ((hardCount / totalQuestions) * 100).toFixed(1) : 0}%)`);
  console.log('\nCONTENT PROVENANCE / QUESTION TYPES:');
  console.log(`- Official PYQ         : ${pyqCount}`);
  console.log(`- PYQ Inspired         : ${pyqInspiredCount}`);
  console.log(`- Sample Paper         : ${samplePaperCount}`);
  console.log(`- Related Practice     : ${relatedPracticeCount}`);
  console.log('\nCONTENT QA STATUS:');
  console.log(`- Verified (Live)      : ${totalVerified}`);
  console.log(`- Under Review         : ${totalReview}`);
  console.log(`- Draft                : ${totalDraft}`);
  console.log(`- Rejected             : ${totalRejected}`);
  console.log('------------------------------------------------------------------------\n');

  // 2. Subject Breakdown
  const subjects = await Subject.find().sort({ order: 1 });
  console.log('📚 SECTION-WISE SUMMARY:');
  console.log('------------------------------------------------------------------------');
  for (const sub of subjects) {
    const count = await Question.countDocuments({ subjectId: sub._id, isActive: true });
    console.log(`${sub.name.padEnd(35)} : ${count.toString().padStart(4)} questions`);
  }
  console.log('------------------------------------------------------------------------\n');

  // 3. Topic Coverage Grid
  console.log('🎯 TOPIC COVERAGE & READINESS MATRIX:');
  console.log('Legend: 🔴 RED (<25 Qs) | 🟡 YELLOW (25-49 Qs) | 🟢 GREEN (50+ Qs)');
  console.log('================================================================================================');
  console.log(
    `${'Subject'.padEnd(16)} | ${'Topic Name'.padEnd(30)} | ${'Total'.padStart(5)} | ${'Easy'.padStart(4)} | ${'Med'.padStart(4)} | ${'Hard'.padStart(4)} | ${'Verified'.padStart(8)} | ${'Coverage Status'.padEnd(12)}`
  );
  console.log('================================================================================================');

  let redTopicsCount = 0;
  let yellowTopicsCount = 0;
  let greenTopicsCount = 0;

  for (const sub of subjects) {
    const topics = await Topic.find({ subjectId: sub._id }).sort({ order: 1 });
    for (const top of topics) {
      const qTotal = await Question.countDocuments({ topicId: top._id, isActive: true });
      const qEasy = await Question.countDocuments({ topicId: top._id, difficulty: 'Easy', isActive: true });
      const qMed = await Question.countDocuments({ topicId: top._id, difficulty: 'Medium', isActive: true });
      const qHard = await Question.countDocuments({ topicId: top._id, difficulty: 'Hard', isActive: true });
      const qVer = await Question.countDocuments({
        topicId: top._id,
        $or: [{ qaStatus: 'VERIFIED' }, { qaStatus: { $exists: false } }],
        isActive: true,
      });

      let statusBadge = '🔴 RED';
      if (qTotal >= 50) {
        statusBadge = '🟢 GREEN';
        greenTopicsCount++;
      } else if (qTotal >= 25) {
        statusBadge = '🟡 YELLOW';
        yellowTopicsCount++;
      } else {
        redTopicsCount++;
      }

      console.log(
        `${sub.slug.slice(0, 15).padEnd(16)} | ${top.name.slice(0, 29).padEnd(30)} | ${qTotal.toString().padStart(5)} | ${qEasy.toString().padStart(4)} | ${qMed.toString().padStart(4)} | ${qHard.toString().padStart(4)} | ${qVer.toString().padStart(8)} | ${statusBadge.padEnd(12)}`
      );
    }
  }
  console.log('================================================================================================\n');

  console.log('📌 TOPIC READINESS SUMMARY:');
  console.log(`- 🟢 Production-Ready (50+ Qs)   : ${greenTopicsCount} topics`);
  console.log(`- 🟡 Good Coverage (25-49 Qs)     : ${yellowTopicsCount} topics`);
  console.log(`- 🔴 Gaps / Needs Content (<25 Qs): ${redTopicsCount} topics`);
  console.log('========================================================================\n');

  await mongoose.disconnect();
}

runReport().catch((err) => {
  console.error('Fatal report error:', err);
  process.exit(1);
});
