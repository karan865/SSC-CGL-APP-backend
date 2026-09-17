import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

import { Exam } from '../models/Exam';
import { ExamStage } from '../models/ExamStage';
import { ExamPaper } from '../models/ExamPaper';
import { Subject } from '../models/Subject';

export async function seedMainsAndStages() {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/ssc-cgl-app';
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(mongoUri);
  }

  // 1. SSC CGL Stages & Papers & Subjects
  const sscExam = await Exam.findOne({ slug: 'ssc-cgl' });
  if (sscExam) {
    // Stage 1: Tier 1 (Prelims)
    const tier1Stage = await ExamStage.findOneAndUpdate(
      { examId: sscExam._id, slug: 'tier-1' },
      {
        $set: {
          examId: sscExam._id,
          name: 'Tier 1 (Prelims)',
          slug: 'tier-1',
          order: 1,
          isActive: true,
        },
      },
      { upsert: true, returnDocument: 'after' }
    );

    // Stage 2: Tier 2 (Mains)
    const tier2Stage = await ExamStage.findOneAndUpdate(
      { examId: sscExam._id, slug: 'tier-2' },
      {
        $set: {
          examId: sscExam._id,
          name: 'Tier 2 (Mains)',
          slug: 'tier-2',
          order: 2,
          isActive: true,
        },
      },
      { upsert: true, returnDocument: 'after' }
    );

    // Tier 1 Paper
    const tier1Paper = await ExamPaper.findOneAndUpdate(
      { stageId: tier1Stage._id, slug: 'tier-1' },
      {
        $set: {
          examId: sscExam._id,
          stageId: tier1Stage._id,
          name: 'Tier 1 - Objective',
          slug: 'tier-1',
          order: 1,
          totalQuestions: 100,
          totalMarks: 200,
          durationMinutes: 60,
          scoring: { correctMarks: 2, wrongMarks: -0.5, unansweredMarks: 0 },
          isActive: true,
        },
      },
      { upsert: true, returnDocument: 'after' }
    );

    // Update existing 4 SSC Tier-1 subjects to explicitly link to tier1Stage & tier1Paper
    await Subject.updateMany(
      { slug: { $in: ['quantitative-aptitude', 'reasoning', 'english', 'general-awareness'] } },
      { $set: { examId: sscExam._id, stageId: tier1Stage._id, paperId: tier1Paper._id } }
    );

    // Tier 2 Paper
    const tier2Paper = await ExamPaper.findOneAndUpdate(
      { stageId: tier2Stage._id, slug: 'tier-2-paper-1' },
      {
        $set: {
          examId: sscExam._id,
          stageId: tier2Stage._id,
          name: 'Tier 2 - Paper I (Mains)',
          slug: 'tier-2-paper-1',
          order: 1,
          totalQuestions: 130,
          totalMarks: 390,
          durationMinutes: 135,
          scoring: { correctMarks: 3, wrongMarks: -1, unansweredMarks: 0 },
          isActive: true,
        },
      },
      { upsert: true, returnDocument: 'after' }
    );

    // Tier 2 Subjects
    const sscTier2Subjects = [
      { name: 'Mathematical Abilities (Tier 2)', slug: 'ssc-t2-maths', order: 1, description: 'Advanced arithmetic, algebra, geometry & statistics' },
      { name: 'Reasoning & Intelligence (Tier 2)', slug: 'ssc-t2-reasoning', order: 2, description: 'High-level analytical & logical reasoning puzzles' },
      { name: 'English Language & Comprehension (Tier 2)', slug: 'ssc-t2-english', order: 3, description: 'Advanced vocab, cloze tests & reading passages' },
      { name: 'General Awareness (Tier 2)', slug: 'ssc-t2-ga', order: 4, description: 'Current affairs, economy, polity & science' },
      { name: 'Computer Knowledge Module (Tier 2)', slug: 'ssc-t2-computer', order: 5, description: 'Hardware, software, MS Office, internet & cybersecurity' },
    ];

    for (const sub of sscTier2Subjects) {
      await Subject.findOneAndUpdate(
        { examId: sscExam._id, slug: sub.slug },
        {
          $set: {
            examId: sscExam._id,
            stageId: tier2Stage._id,
            paperId: tier2Paper._id,
            name: sub.name,
            slug: sub.slug,
            order: sub.order,
            description: sub.description,
            isActive: true,
          },
        },
        { upsert: true }
      );
    }
    console.log('✅ SSC CGL Tier 1 & Tier 2 Stages & Subjects Seeded.');
  }

  // 2. JPSC Stages & Papers & Subjects
  const jpscExam = await Exam.findOne({ slug: 'jpsc' });
  if (jpscExam) {
    // Stage 1: Prelims
    const prelimsStage = await ExamStage.findOneAndUpdate(
      { examId: jpscExam._id, slug: 'prelims' },
      {
        $set: {
          examId: jpscExam._id,
          name: 'Prelims',
          slug: 'prelims',
          order: 1,
          isActive: true,
        },
      },
      { upsert: true, returnDocument: 'after' }
    );

    // Stage 2: Mains
    const mainsStage = await ExamStage.findOneAndUpdate(
      { examId: jpscExam._id, slug: 'mains' },
      {
        $set: {
          examId: jpscExam._id,
          name: 'Mains',
          slug: 'mains',
          order: 2,
          isActive: true,
        },
      },
      { upsert: true, returnDocument: 'after' }
    );

    // Prelims Paper 1
    const prelimsP1 = await ExamPaper.findOneAndUpdate(
      { stageId: prelimsStage._id, slug: 'paper-1' },
      {
        $set: {
          examId: jpscExam._id,
          stageId: prelimsStage._id,
          name: 'Paper I - General Studies',
          slug: 'paper-1',
          order: 1,
          totalQuestions: 100,
          totalMarks: 200,
          durationMinutes: 120,
          scoring: { correctMarks: 2, wrongMarks: 0, unansweredMarks: 0 },
          isActive: true,
        },
      },
      { upsert: true, returnDocument: 'after' }
    );

    // Prelims Paper 2
    const prelimsP2 = await ExamPaper.findOneAndUpdate(
      { stageId: prelimsStage._id, slug: 'paper-2' },
      {
        $set: {
          examId: jpscExam._id,
          stageId: prelimsStage._id,
          name: 'Paper II - Jharkhand Special',
          slug: 'paper-2',
          order: 2,
          totalQuestions: 100,
          totalMarks: 200,
          durationMinutes: 120,
          scoring: { correctMarks: 2, wrongMarks: 0, unansweredMarks: 0 },
          isActive: true,
        },
      },
      { upsert: true, returnDocument: 'after' }
    );

    // Update Paper 1 & Paper 2 subjects with stageId & paperId
    await Subject.updateMany(
      {
        examId: jpscExam._id,
        slug: {
          $in: [
            'jpsc-history',
            'jpsc-geography',
            'jpsc-polity',
            'jpsc-economy',
            'jpsc-science',
            'jpsc-jharkhand',
            'jpsc-current-affairs',
            'jpsc-miscellaneous',
          ],
        },
      },
      { $set: { stageId: prelimsStage._id, paperId: prelimsP1._id } }
    );

    await Subject.updateMany(
      {
        examId: jpscExam._id,
        slug: {
          $in: [
            'jpsc-p2-tribal-governance',
            'jpsc-p2-movements-personalities',
            'jpsc-p2-land-laws',
            'jpsc-p2-geography-rivers',
            'jpsc-p2-minerals-industries',
            'jpsc-p2-schemes-development',
            'jpsc-p2-forest-environment',
            'jpsc-p2-culture-sports',
          ],
        },
      },
      { $set: { stageId: prelimsStage._id, paperId: prelimsP2._id } }
    );

    // Mains Paper
    const mainsPaper = await ExamPaper.findOneAndUpdate(
      { stageId: mainsStage._id, slug: 'mains-written' },
      {
        $set: {
          examId: jpscExam._id,
          stageId: mainsStage._id,
          name: 'Mains Written Examination',
          slug: 'mains-written',
          order: 1,
          totalQuestions: 36,
          totalMarks: 950,
          durationMinutes: 1080,
          scoring: { correctMarks: 0, wrongMarks: 0, unansweredMarks: 0 },
          isActive: true,
        },
      },
      { upsert: true, returnDocument: 'after' }
    );

    // Mains Subjects (Papers I through VI)
    const jpscMainsSubjects = [
      { name: 'General Hindi & General English (Mains Paper I)', slug: 'jpsc-m-hindi-english', order: 1, description: 'Qualifying language paper (50 marks Hindi + 50 marks English)' },
      { name: 'Language & Literature (Mains Paper II)', slug: 'jpsc-m-language-literature', order: 2, description: 'Nagpuri, Khortha, Santhali, Mundari, Kurukh, Hindi, or English (150 marks)' },
      { name: 'Social Sciences: History & Geography (Mains Paper III)', slug: 'jpsc-m-social-sciences', order: 3, description: 'Indian History & Geography with Jharkhand focus (200 marks)' },
      { name: 'Indian Constitution, Polity & Governance (Mains Paper IV)', slug: 'jpsc-m-constitution-polity', order: 4, description: 'Constitution, Public Administration & Good Governance (200 marks)' },
      { name: 'Indian Economy & Sustainable Development (Mains Paper V)', slug: 'jpsc-m-economy-dev', order: 5, description: 'Economic reforms, agriculture & Jharkhand economy (200 marks)' },
      { name: 'General Science, Environment & Tech (Mains Paper VI)', slug: 'jpsc-m-science-tech', order: 6, description: 'Physical sciences, life sciences, ecology & tech development (200 marks)' },
    ];

    for (const sub of jpscMainsSubjects) {
      await Subject.findOneAndUpdate(
        { examId: jpscExam._id, slug: sub.slug },
        {
          $set: {
            examId: jpscExam._id,
            stageId: mainsStage._id,
            paperId: mainsPaper._id,
            name: sub.name,
            slug: sub.slug,
            order: sub.order,
            description: sub.description,
            isActive: true,
          },
        },
        { upsert: true }
      );
    }
    console.log('✅ JPSC Prelims (Paper I & II) & Mains Stages & Subjects Seeded.');
  }

  console.log('🎉 Multi-Exam Stages & Mains Seeding Finished Successfully.');
}

if (require.main === module) {
  seedMainsAndStages()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Error seeding stages and mains:', err);
      process.exit(1);
    });
}
