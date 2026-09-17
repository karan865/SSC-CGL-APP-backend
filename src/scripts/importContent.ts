import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

import { Subject } from '../models/Subject';
import { Topic } from '../models/Topic';
import { Question } from '../models/Question';
import { loadValidationContext, validateQuestion } from '../services/validation/contentValidator';

// Resolve paths
const CONTENT_DIR = path.resolve(__dirname, '../../content');
const SUBJECTS_FILE = path.join(CONTENT_DIR, 'subjects.json');
const TOPICS_FILE = path.join(CONTENT_DIR, 'topics.json');
const QUESTIONS_DIR = path.join(CONTENT_DIR, 'questions');

interface RawQuestion {
  questionText: string;
  options: string[];
  correctAnswerIndex: number;
  explanation: string;
  difficulty?: 'Easy' | 'Medium' | 'Hard';
  questionType?: 'PYQ' | 'PYQ_INSPIRED' | 'SAMPLE_PAPER' | 'RELATED_PRACTICE';
  sourceType?: 'OFFICIAL_PYQ' | 'INTERNAL' | 'REFERENCE_BOOK' | 'EXAM_MEMORY';
  qaStatus?: 'DRAFT' | 'REVIEW' | 'VERIFIED' | 'REJECTED';
  year?: number;
  exam?: string;
  tier?: number;
  shift?: string;
  source?: string;
  sourceUrl?: string;
  subjectSlug?: string;
  topicSlug?: string;
}

/**
 * Shuffles an array of 4 options using Fisher-Yates and returns optionA-D and the new correctAnswer letter.
 */
function shuffleAndFormatOptions(
  options: string[],
  correctIndex: number
): {
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctAnswer: 'A' | 'B' | 'C' | 'D';
} {
  const correctText = options[correctIndex];
  const shuffled = [...options];

  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = shuffled[i];
    shuffled[i] = shuffled[j];
    shuffled[j] = temp;
  }

  const keys: ('A' | 'B' | 'C' | 'D')[] = ['A', 'B', 'C', 'D'];
  const newIndex = shuffled.indexOf(correctText);
  const newCorrectAnswer = keys[newIndex >= 0 ? newIndex : 0];

  return {
    optionA: shuffled[0],
    optionB: shuffled[1],
    optionC: shuffled[2],
    optionD: shuffled[3],
    correctAnswer: newCorrectAnswer,
  };
}

/**
 * Lightweight CSV parser for simple question spreadsheets.
 */
function parseCsv(content: string): RawQuestion[] {
  const lines = content
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length <= 1) return [];

  const questions: RawQuestion[] = [];
  // Skip header row
  for (let i = 1; i < lines.length; i++) {
    // Regex for CSV split handling quotes
    const regex = /(?:,|\n|^)("(?:(?:"")*[^"]*)*"|[^",\n]*|(?:\n|$))/g;
    const matches: string[] = [];
    let match: RegExpExecArray | null;
    while ((match = regex.exec(lines[i])) !== null) {
      let val = match[1];
      if (val === undefined) continue;
      if (val.startsWith('"') && val.endsWith('"')) {
        val = val.slice(1, -1).replace(/""/g, '"');
      }
      matches.push(val.trim());
      if (regex.lastIndex >= lines[i].length) break;
    }

    if (matches.length >= 7) {
      const qText = matches[0];
      const opt1 = matches[1];
      const opt2 = matches[2];
      const opt3 = matches[3];
      const opt4 = matches[4];
      const correctIdx = parseInt(matches[5], 10) || 0;
      const explanation = matches[6] || '';
      const difficulty = (matches[7] as any) || 'Medium';
      const year = matches[8] ? parseInt(matches[8], 10) : undefined;

      questions.push({
        questionText: qText,
        options: [opt1, opt2, opt3, opt4],
        correctAnswerIndex: correctIdx,
        explanation,
        difficulty: ['Easy', 'Medium', 'Hard'].includes(difficulty) ? difficulty : 'Medium',
        year,
      });
    }
  }
  return questions;
}

async function runImporter() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error('❌ MONGODB_URI is not defined in .env');
    process.exit(1);
  }

  console.log('====================================================');
  console.log('🚀 SSC CGL QUESTION BANK CONTENT IMPORTER');
  console.log('====================================================\n');

  console.log('Connecting to MongoDB Atlas...');
  await mongoose.connect(mongoUri);
  console.log('✅ Connected to MongoDB successfully.\n');

  // 1. Sync Subjects
  const subjectSlugToId = new Map<string, mongoose.Types.ObjectId>();
  if (fs.existsSync(SUBJECTS_FILE)) {
    const subjectsData = JSON.parse(fs.readFileSync(SUBJECTS_FILE, 'utf8'));
    console.log(`Syncing ${subjectsData.length} canonical subjects from subjects.json...`);
    for (const s of subjectsData) {
      let doc = await Subject.findOne({ slug: s.slug });
      if (!doc && Array.isArray(s.aliases)) {
        doc = await Subject.findOne({ slug: { $in: s.aliases } });
      }

      if (doc) {
        doc.name = s.name;
        doc.slug = s.slug;
        doc.description = s.description;
        doc.order = s.order ?? 0;
        doc.isActive = s.isActive ?? true;
        await doc.save();
      } else {
        doc = await Subject.create({
          name: s.name,
          slug: s.slug,
          description: s.description,
          order: s.order ?? 0,
          isActive: s.isActive ?? true,
        });
      }

      // If duplicate legacy subjects exist under aliases, merge topics & questions to canonical subject
      if (Array.isArray(s.aliases)) {
        for (const alias of s.aliases) {
          const duplicateSubject = await Subject.findOne({ slug: alias, _id: { $ne: doc._id } });
          if (duplicateSubject) {
            await Topic.updateMany({ subjectId: duplicateSubject._id }, { $set: { subjectId: doc._id } });
            await Question.updateMany({ subjectId: duplicateSubject._id }, { $set: { subjectId: doc._id } });
            await Subject.deleteOne({ _id: duplicateSubject._id });
          }
        }
      }

      subjectSlugToId.set(s.slug, doc._id as mongoose.Types.ObjectId);
      if (Array.isArray(s.aliases)) {
        for (const alias of s.aliases) {
          subjectSlugToId.set(alias, doc._id as mongoose.Types.ObjectId);
        }
      }
    }
    console.log('✅ Canonical subjects synchronized.\n');
  }

  // 2. Sync Topics
  const topicLookup = new Map<string, mongoose.Types.ObjectId>();
  if (fs.existsSync(TOPICS_FILE)) {
    const topicsData = JSON.parse(fs.readFileSync(TOPICS_FILE, 'utf8'));
    console.log(`Syncing ${topicsData.length} topics from topics.json...`);
    for (const t of topicsData) {
      const subjectId = subjectSlugToId.get(t.subjectSlug);
      if (!subjectId) {
        console.warn(`⚠️ Warning: Subject slug "${t.subjectSlug}" not found for topic "${t.slug}"`);
        continue;
      }
      const doc = await Topic.findOneAndUpdate(
        { subjectId, slug: t.slug },
        {
          $set: {
            subjectId,
            name: t.name,
            slug: t.slug,
            order: t.order ?? 0,
            isActive: t.isActive ?? true,
          },
        },
        { upsert: true, returnDocument: 'after' }
      );
      topicLookup.set(`${t.subjectSlug}:${t.slug}`, doc._id as mongoose.Types.ObjectId);
      topicLookup.set(t.slug, doc._id as mongoose.Types.ObjectId);
      if (Array.isArray(t.aliases)) {
        for (const alias of t.aliases) {
          topicLookup.set(`${t.subjectSlug}:${alias}`, doc._id as mongoose.Types.ObjectId);
          topicLookup.set(alias, doc._id as mongoose.Types.ObjectId);
        }
      }
    }
    console.log('✅ Topics synchronized.\n');
  }

  // 3. Scan & Process Question Files
  const fileArg = process.argv.find((arg) => arg.startsWith('--file='));
  let filesToProcess: { filePath: string; subjectSlug: string; topicSlug: string }[] = [];

  const QUESTION_SOURCE_DIRS = [
    QUESTIONS_DIR,
    path.resolve(__dirname, '../../../Questions bank/questions'),
  ];

  if (fileArg) {
    const targetRel = fileArg.split('=')[1];
    let targetAbs = path.isAbsolute(targetRel) ? targetRel : path.join(QUESTIONS_DIR, targetRel);
    if (!fs.existsSync(targetAbs)) {
      targetAbs = path.resolve(__dirname, '../../../Questions bank/questions', targetRel);
    }
    if (!fs.existsSync(targetAbs)) {
      console.error(`❌ Target file not found: ${targetRel}`);
      process.exit(1);
    }
    const parts = targetRel.replace(/\\/g, '/').split('/');
    const subjectSlug = parts.length > 1 ? parts[0] : '';
    const topicSlug = path.basename(targetRel, path.extname(targetRel));
    filesToProcess.push({ filePath: targetAbs, subjectSlug, topicSlug });
  } else {
    for (const qDir of QUESTION_SOURCE_DIRS) {
      if (fs.existsSync(qDir)) {
        const subjectDirs = fs.readdirSync(qDir, { withFileTypes: true });
        for (const sDir of subjectDirs) {
          if (sDir.isDirectory()) {
            const sSlug = sDir.name;
            const subPath = path.join(qDir, sSlug);
            const qFiles = fs.readdirSync(subPath);
            for (const file of qFiles) {
              if (file.endsWith('.json') || file.endsWith('.csv')) {
                const topicSlug = path.basename(file, path.extname(file));
                filesToProcess.push({
                  filePath: path.join(subPath, file),
                  subjectSlug: sSlug,
                  topicSlug,
                });
              }
            }
          }
        }
      }
    }
  }

  console.log(`Found ${filesToProcess.length} question content file(s) to process.\n`);

  const validationContext = loadValidationContext(CONTENT_DIR);

  let totalScanned = 0;
  let totalImported = 0;
  let totalSkipped = 0;

  for (const { filePath, subjectSlug, topicSlug } of filesToProcess) {
    const relName = path.relative(CONTENT_DIR, filePath);
    console.log(`📄 Processing: ${relName}...`);

    let rawQuestions: RawQuestion[] = [];
    try {
      if (filePath.endsWith('.json')) {
        rawQuestions = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      } else if (filePath.endsWith('.csv')) {
        rawQuestions = parseCsv(fs.readFileSync(filePath, 'utf8'));
      }
    } catch (err: any) {
      console.error(`❌ Failed to read or parse file ${relName}:`, err.message);
      continue;
    }

    if (!Array.isArray(rawQuestions) || rawQuestions.length === 0) {
      console.log(`   (0 questions found, skipping)\n`);
      continue;
    }

    const bulkOps = [];
    let fileValidCount = 0;

    for (let idx = 0; idx < rawQuestions.length; idx++) {
      totalScanned++;
      const q = rawQuestions[idx];

      // Resolve subject & topic IDs
      const targetSubSlug = q.subjectSlug || subjectSlug;
      const targetTopicSlug = q.topicSlug || topicSlug;

      const resolvedSubjectId = subjectSlugToId.get(targetSubSlug);
      const resolvedTopicId =
        topicLookup.get(`${targetSubSlug}:${targetTopicSlug}`) ||
        topicLookup.get(targetTopicSlug);

      if (!resolvedSubjectId || !resolvedTopicId) {
        console.warn(
          `   ⚠️ [Item ${idx + 1}] Skipping: Cannot resolve subject "${targetSubSlug}" or topic "${targetTopicSlug}"`
        );
        totalSkipped++;
        continue;
      }

      // Run structural and quality validation
      const valResult = validateQuestion(
        {
          ...q,
          subjectSlug: targetSubSlug,
          topicSlug: targetTopicSlug,
        },
        validationContext,
        idx
      );

      if (!valResult.isValid) {
        console.warn(`   ⚠️ [Item ${idx + 1}] Skipping invalid question: ${valResult.errors.join(', ')}`);
        totalSkipped++;
        continue;
      }

      const correctIdx =
        typeof q.correctAnswerIndex === 'number' &&
        q.correctAnswerIndex >= 0 &&
        q.correctAnswerIndex < 4
          ? q.correctAnswerIndex
          : 0;

      // Randomize options using Fisher-Yates and recalculate correct letter
      const formatted = shuffleAndFormatOptions(q.options, correctIdx);

      const difficulty = ['Easy', 'Medium', 'Hard'].includes(q.difficulty || '')
        ? q.difficulty!
        : 'Medium';

      let questionType = q.questionType;
      if (!questionType) {
        const lowerName = path.basename(filePath).toLowerCase();
        if (lowerName.includes('sample_paper')) {
          questionType = 'SAMPLE_PAPER';
        } else if (lowerName.includes('related_practice')) {
          questionType = 'RELATED_PRACTICE';
        } else {
          questionType = 'PYQ_INSPIRED';
        }
      }
      const sourceType = q.sourceType || 'INTERNAL';
      const qaStatus = q.qaStatus || 'VERIFIED';

      bulkOps.push({
        updateOne: {
          filter: {
            topicId: resolvedTopicId,
            questionText: q.questionText.trim(),
            explanation: (q.explanation || '').trim(),
          },
          update: {
            $set: {
              subjectId: resolvedSubjectId,
              topicId: resolvedTopicId,
              questionText: q.questionText.trim(),
              optionA: formatted.optionA,
              optionB: formatted.optionB,
              optionC: formatted.optionC,
              optionD: formatted.optionD,
              correctAnswer: formatted.correctAnswer,
              explanation: q.explanation || 'Detailed explanation provided in solution.',
              difficulty,
              questionType,
              sourceType,
              qaStatus,
              year: q.year,
              exam: q.exam || 'SSC CGL',
              tier: q.tier || 1,
              shift: q.shift,
              source: q.source,
              sourceUrl: q.sourceUrl,
              isActive: true,
            },
          },
          upsert: true,
        },
      });
      fileValidCount++;
    }

    if (bulkOps.length > 0) {
      const result = await Question.bulkWrite(bulkOps);
      const upsertedCount = result.upsertedCount || 0;
      const modifiedCount = result.modifiedCount || 0;
      totalImported += upsertedCount + modifiedCount;
      console.log(
        `   ✅ ${fileValidCount} questions processed (Inserted: ${upsertedCount}, Updated: ${modifiedCount})\n`
      );
    }
  }

  console.log('====================================================');
  console.log('🎉 CONTENT IMPORT SUMMARY');
  console.log('====================================================');
  console.log(`Total Questions Scanned : ${totalScanned}`);
  console.log(`Total Upserted / Updated: ${totalImported}`);
  console.log(`Total Skipped           : ${totalSkipped}`);

  // Fetch live stats from database
  const totalInDb = await Question.countDocuments();
  const quantCount = await Question.countDocuments({
    subjectId: subjectSlugToId.get('quant'),
  });
  const reasoningCount = await Question.countDocuments({
    subjectId: subjectSlugToId.get('reasoning'),
  });
  const englishCount = await Question.countDocuments({
    subjectId: subjectSlugToId.get('english'),
  });
  const gaCount = await Question.countDocuments({
    subjectId: subjectSlugToId.get('general_awareness'),
  });

  console.log('\n📊 LIVE QUESTION BANK TOTALS IN MONGODB:');
  console.log(`- Total Questions in DB    : ${totalInDb}`);
  console.log(`- Quantitative Aptitude    : ${quantCount}`);
  console.log(`- Reasoning & Intelligence : ${reasoningCount}`);
  console.log(`- English Comprehension    : ${englishCount}`);
  console.log(`- General Awareness        : ${gaCount}`);
  console.log('====================================================\n');

  await mongoose.disconnect();
  console.log('Disconnected from MongoDB. Import finished successfully.');
}

runImporter().catch((err) => {
  console.error('Fatal import error:', err);
  process.exit(1);
});
