import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

import { Exam, IExam } from '../models/Exam';
import { ExamStage, IExamStage } from '../models/ExamStage';
import { ExamPaper, IExamPaper } from '../models/ExamPaper';
import { Subject, ISubject } from '../models/Subject';
import { Topic, ITopic } from '../models/Topic';

export interface SeededJPSCHierarchy {
  exam: IExam;
  stage: IExamStage;
  paper: IExamPaper;
  subjects: Record<string, ISubject>;
  topics: Record<string, ITopic>;
}

export const JPSC_PAPER_1_SUBJECT_DEFINITIONS = [
  {
    name: 'History of India',
    slug: 'jpsc-history',
    order: 1,
    topics: [
      { name: 'Ancient India', slug: 'ancient-india', order: 1 },
      { name: 'Medieval India', slug: 'medieval-india', order: 2 },
      { name: 'Modern India', slug: 'modern-india', order: 3 },
    ],
  },
  {
    name: 'Geography of India',
    slug: 'jpsc-geography',
    order: 2,
    topics: [
      { name: 'General & Physical Geography', slug: 'general-physical-geography', order: 1 },
      { name: 'Economic & Social Geography', slug: 'economic-social-geography', order: 2 },
    ],
  },
  {
    name: 'Indian Polity & Governance',
    slug: 'jpsc-polity',
    order: 3,
    topics: [
      { name: 'Constitution of India', slug: 'indian-constitution', order: 1 },
      { name: 'Public Administration & Good Governance', slug: 'public-administration', order: 2 },
      { name: 'Panchayati Raj & Decentralization', slug: 'panchayati-raj', order: 3 },
    ],
  },
  {
    name: 'Economic & Sustainable Development',
    slug: 'jpsc-economy',
    order: 4,
    topics: [
      { name: 'Basic Indian Economy', slug: 'basic-economy', order: 1 },
      { name: 'Sustainable Development & Issues', slug: 'sustainable-development', order: 2 },
      { name: 'Economic Reforms & Globalization', slug: 'economic-reforms', order: 3 },
    ],
  },
  {
    name: 'Science & Technology',
    slug: 'jpsc-science',
    order: 5,
    topics: [
      { name: 'General Science', slug: 'general-science', order: 1 },
      { name: 'Agriculture & Science Technology', slug: 'agriculture-science', order: 2 },
      { name: 'Information & Communication Technology', slug: 'information-technology', order: 3 },
    ],
  },
  {
    name: 'Jharkhand Specific (Paper I)',
    slug: 'jpsc-jharkhand',
    order: 6,
    topics: [
      { name: 'Jharkhand History, Heritage & Culture', slug: 'jharkhand-history-culture', order: 1 },
      { name: 'Jharkhand Geography & Natural Resources', slug: 'jharkhand-geography-resources', order: 2 },
      { name: 'Jharkhand Governance, Schemes & Economy', slug: 'jharkhand-polity-economy', order: 3 },
    ],
  },
  {
    name: 'National & International Current Affairs',
    slug: 'jpsc-current-affairs',
    order: 7,
    topics: [
      { name: 'National Events & Governance Initiatives', slug: 'national-current-affairs', order: 1 },
      { name: 'International Affairs & Global Bodies', slug: 'international-current-affairs', order: 2 },
      { name: 'Science, Defence, Sports & Awards', slug: 'current-science-sports-awards', order: 3 },
    ],
  },
  {
    name: 'General Miscellaneous',
    slug: 'jpsc-miscellaneous',
    order: 8,
    topics: [
      { name: 'Human Rights & Social Justice', slug: 'human-rights', order: 1 },
      { name: 'Environment, Biodiversity & Climate Change', slug: 'environment-biodiversity', order: 2 },
      { name: 'Disaster Management', slug: 'disaster-management', order: 3 },
      { name: 'Sports, Urbanization & Miscellaneous GK', slug: 'sports-urbanization-misc', order: 4 },
    ],
  },
];

export const JPSC_PAPER_2_SUBJECT_DEFINITIONS = [
  {
    name: 'Traditional Tribal Governance',
    slug: 'jpsc-p2-tribal-governance',
    order: 1,
    topics: [
      { name: 'Munda & Nagvanshi Governance', slug: 'munda-nagvanshi-governance', order: 1 },
      { name: 'Padha Panchayat & Manjhi Pargana', slug: 'padha-panchayat-manjhi', order: 2 },
      { name: 'Munda-Manki & Dhoklo Sohor', slug: 'munda-manki-dhoklo', order: 3 },
    ],
  },
  {
    name: 'Jharkhand Movements & Personalities',
    slug: 'jpsc-p2-movements-personalities',
    order: 2,
    topics: [
      { name: 'Freedom Fighters & Personalities', slug: 'freedom-fighters-personalities', order: 1 },
      { name: 'Tribal Uprisings & Rebellions', slug: 'tribal-uprisings-rebellions', order: 2 },
      { name: 'Jharkhand Statehood Movement', slug: 'statehood-movement', order: 3 },
    ],
  },
  {
    name: 'Land Laws of Jharkhand',
    slug: 'jpsc-p2-land-laws',
    order: 3,
    topics: [
      { name: 'Chotanagpur Tenancy Act 1908 (CNT)', slug: 'cnt-act-1908', order: 1 },
      { name: 'Santhal Parganas Tenancy Act 1949 (SPT)', slug: 'spt-act-1949', order: 2 },
    ],
  },
  {
    name: 'Jharkhand Geography & Rivers',
    slug: 'jpsc-p2-geography-rivers',
    order: 4,
    topics: [
      { name: 'Physical Geography & Plateaus', slug: 'physical-geography-plateaus', order: 1 },
      { name: 'Drainage Systems & Rivers', slug: 'drainage-rivers', order: 2 },
    ],
  },
  {
    name: 'Mines, Minerals & Industries',
    slug: 'jpsc-p2-minerals-industries',
    order: 5,
    topics: [
      { name: 'Mineral Resources & Mining', slug: 'mineral-resources-mining', order: 1 },
      { name: 'Industrial Policies & Plants', slug: 'industrial-policies-plants', order: 2 },
    ],
  },
  {
    name: 'Welfare Schemes & Development',
    slug: 'jpsc-p2-schemes-development',
    order: 6,
    topics: [
      { name: 'Welfare Schemes of Jharkhand', slug: 'welfare-schemes-jharkhand', order: 1 },
    ],
  },
  {
    name: 'Forest, Wildlife & Environment',
    slug: 'jpsc-p2-forest-environment',
    order: 7,
    topics: [
      { name: 'Forest & Wildlife Sanctuaries', slug: 'forest-wildlife-sanctuaries', order: 1 },
      { name: 'Environmental Issues & Disaster Management', slug: 'environmental-issues-disaster', order: 2 },
    ],
  },
  {
    name: 'Culture, Sports & Miscellaneous',
    slug: 'jpsc-p2-culture-sports',
    order: 8,
    topics: [
      { name: 'Folk Literature, Dance & Festivals', slug: 'folk-literature-dance-festivals', order: 1 },
      { name: 'Famous Personalities & Awards', slug: 'famous-personalities-awards', order: 2 },
      { name: 'Sports & Stadiums', slug: 'sports-stadiums', order: 3 },
    ],
  },
];

/**
 * Idempotently creates or updates the JPSC Prelims Paper I hierarchy.
 */
export async function ensureJPSCExamHierarchy(): Promise<SeededJPSCHierarchy> {
  // 1. Exam: JPSC
  const exam = await Exam.findOneAndUpdate(
    { slug: 'jpsc' },
    {
      $set: {
        name: 'JPSC',
        slug: 'jpsc',
        description: 'Jharkhand Public Service Commission - Combined Civil Services Examination',
        icon: 'bank',
        order: 2,
        isActive: true,
      },
    },
    { upsert: true, returnDocument: 'after' }
  );

  // 2. Stage: Prelims
  const stage = await ExamStage.findOneAndUpdate(
    { examId: exam._id, slug: 'prelims' },
    {
      $set: {
        examId: exam._id,
        name: 'Prelims',
        slug: 'prelims',
        order: 1,
        isActive: true,
      },
    },
    { upsert: true, returnDocument: 'after' }
  );

  // 3. Paper: Paper I - General Studies
  const paper = await ExamPaper.findOneAndUpdate(
    { stageId: stage._id, slug: 'paper-1' },
    {
      $set: {
        examId: exam._id,
        stageId: stage._id,
        name: 'Paper I - General Studies',
        slug: 'paper-1',
        order: 1,
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

  // 4. Subjects and Topics
  const subjectsMap: Record<string, ISubject> = {};
  const topicsMap: Record<string, ITopic> = {};

  for (const subDef of JPSC_PAPER_1_SUBJECT_DEFINITIONS) {
    const subject = await Subject.findOneAndUpdate(
      { examId: exam._id, paperId: paper._id, slug: subDef.slug },
      {
        $set: {
          examId: exam._id,
          stageId: stage._id,
          paperId: paper._id,
          name: subDef.name,
          slug: subDef.slug,
          order: subDef.order,
          isActive: true,
        },
      },
      { upsert: true, returnDocument: 'after' }
    );
    subjectsMap[subDef.slug] = subject;

    for (const topDef of subDef.topics) {
      const topic = await Topic.findOneAndUpdate(
        { subjectId: subject._id, slug: topDef.slug },
        {
          $set: {
            examId: exam._id,
            stageId: stage._id,
            paperId: paper._id,
            subjectId: subject._id,
            name: topDef.name,
            slug: topDef.slug,
            order: topDef.order,
            isActive: true,
          },
        },
        { upsert: true, returnDocument: 'after' }
      );
      topicsMap[`${subDef.slug}/${topDef.slug}`] = topic;
    }
  }

  return { exam, stage, paper, subjects: subjectsMap, topics: topicsMap };
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

  console.log('Seeding JPSC Prelims Paper I Exam Hierarchy (Idempotent)...');
  const result = await ensureJPSCExamHierarchy();

  console.log('\n--- Seeded Hierarchy Summary ---');
  console.log(`Exam    : ${result.exam.name} [slug: ${result.exam.slug}, id: ${result.exam._id}]`);
  console.log(`Stage   : ${result.stage.name} [slug: ${result.stage.slug}, id: ${result.stage._id}]`);
  console.log(`Paper   : ${result.paper.name} [slug: ${result.paper.slug}, id: ${result.paper._id}]`);
  console.log(`Scoring : +${result.paper.scoring?.correctMarks} correct, ${result.paper.scoring?.wrongMarks} wrong (Zero negative marking)`);
  console.log(`Subjects: ${Object.keys(result.subjects).length} subjects seeded`);
  console.log(`Topics  : ${Object.keys(result.topics).length} topics seeded across Paper I`);
  console.log('--------------------------------\n');

  await mongoose.disconnect();
  console.log('Disconnected from MongoDB. JPSC hierarchy seeding completed successfully.');
}

if (require.main === module) {
  runStandalone().catch((err) => {
    console.error('Seeding failed:', err);
    process.exit(1);
  });
}
