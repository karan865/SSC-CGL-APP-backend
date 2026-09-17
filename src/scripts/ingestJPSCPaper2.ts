import mongoose from 'dotenv';
import mongooseConn from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

import { Exam } from '../models/Exam';
import { ExamStage } from '../models/ExamStage';
import { ExamPaper } from '../models/ExamPaper';
import { Subject } from '../models/Subject';
import { Topic } from '../models/Topic';
import { Question } from '../models/Question';
import { PAPER_2_QUESTIONS } from '../content/jpsc/paper2/paper2Data';
import { JPSC_PAPER_2_SUBJECT_DEFINITIONS } from './seedJPSCHierarchy';

export async function ingestJPSCPaper2Data() {
  const exam = await Exam.findOne({ slug: 'jpsc' });
  if (!exam) throw new Error('JPSC Exam not found in database');

  const stage = await ExamStage.findOne({ examId: exam._id, slug: 'prelims' });
  if (!stage) throw new Error('Prelims Stage not found for JPSC');

  const paper2 = await ExamPaper.findOneAndUpdate(
    { stageId: stage._id, slug: 'paper-2' },
    {
      $set: {
        examId: exam._id,
        stageId: stage._id,
        name: 'Paper II - Jharkhand Special',
        slug: 'paper-2',
        order: 2,
        totalQuestions: 100,
        totalMarks: 200,
        durationMinutes: 120,
        scoring: {
          correctMarks: 2,
          wrongMarks: 0,
          unansweredMarks: 0,
        },
        isActive: true,
      },
    },
    { upsert: true, returnDocument: 'after' }
  );

  // Upsert subjects & topics for Paper II
  const subjectMap: Record<string, any> = {};
  const topicMap: Record<string, any> = {};

  for (const sDef of JPSC_PAPER_2_SUBJECT_DEFINITIONS) {
    const sDoc = await Subject.findOneAndUpdate(
      { examId: exam._id, paperId: paper2._id, slug: sDef.slug },
      {
        $set: {
          examId: exam._id,
          stageId: stage._id,
          paperId: paper2._id,
          name: sDef.name,
          slug: sDef.slug,
          order: sDef.order,
          isActive: true,
        },
      },
      { upsert: true, returnDocument: 'after' }
    );
    subjectMap[sDef.slug] = sDoc;

    for (const tDef of sDef.topics) {
      const tDoc = await Topic.findOneAndUpdate(
        { subjectId: sDoc._id, slug: tDef.slug },
        {
          $set: {
            examId: exam._id,
            stageId: stage._id,
            paperId: paper2._id,
            subjectId: sDoc._id,
            name: tDef.name,
            slug: tDef.slug,
            order: tDef.order,
            isActive: true,
          },
        },
        { upsert: true, returnDocument: 'after' }
      );
      topicMap[`${sDef.slug}/${tDef.slug}`] = tDoc;
    }
  }

  // Ingest questions
  let inserted = 0;
  let updated = 0;

  for (const q of PAPER_2_QUESTIONS) {
    const sub = subjectMap[q.subjectSlug];
    const top = topicMap[`${q.subjectSlug}/${q.topicSlug}`];

    if (!sub || !top) {
      throw new Error(`Unresolved subject/topic for Paper 2 question: ${q.subjectSlug}/${q.topicSlug}`);
    }

    const res = await Question.updateOne(
      {
        examId: exam._id,
        paperId: paper2._id,
        questionText: q.questionText,
      },
      {
        $set: {
          examId: exam._id,
          stageId: stage._id,
          paperId: paper2._id,
          subjectId: sub._id,
          topicId: top._id,
          questionText: q.questionText,
          optionA: q.optionA,
          optionB: q.optionB,
          optionC: q.optionC,
          optionD: q.optionD,
          correctAnswer: q.correctAnswer,
          explanation: q.explanation,
          difficulty: q.difficulty,
          questionType: q.questionType,
          sourceType: q.sourceType,
          sourceYear: q.sourceYear,
          qaStatus: 'VERIFIED',
          isActive: true,
        },
      },
      { upsert: true }
    );

    if (res.upsertedCount > 0) {
      inserted++;
    } else {
      updated++;
    }
  }

  return {
    paper: paper2,
    totalQuestions: PAPER_2_QUESTIONS.length,
    inserted,
    updated,
  };
}

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI not found');

  await mongooseConn.connect(uri);
  console.log('Ingesting JPSC Paper II...');
  const res = await ingestJPSCPaper2Data();
  console.log(`✅ Paper II ingested: ${res.totalQuestions} questions (inserted: ${res.inserted}, updated: ${res.updated})`);
  await mongooseConn.disconnect();
}

if (require.main === module) {
  main().catch((err) => {
    console.error('Paper II ingestion error:', err);
    process.exit(1);
  });
}
