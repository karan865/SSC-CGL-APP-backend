import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

import { Subject } from '../models/Subject';
import { Topic } from '../models/Topic';
import { Question } from '../models/Question';
import {
  PROFIT_LOSS_QUESTIONS,
  REASONING_ANALOGY_QUESTIONS,
  ENGLISH_QUESTIONS,
  GENERAL_AWARENESS_QUESTIONS,
} from './questionsData';

/**
 * Randomizes options A, B, C, D and recalculates the correctAnswer key.
 */
function shuffleQuestionOptions<
  T extends {
    optionA: string;
    optionB: string;
    optionC: string;
    optionD: string;
    correctAnswer: 'A' | 'B' | 'C' | 'D';
  }
>(q: T): T {
  const optionsMap: Record<string, string> = {
    A: q.optionA,
    B: q.optionB,
    C: q.optionC,
    D: q.optionD,
  };
  const correctText = optionsMap[q.correctAnswer];
  const allTexts = [q.optionA, q.optionB, q.optionC, q.optionD];

  // Fisher-Yates shuffle
  for (let i = allTexts.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = allTexts[i];
    allTexts[i] = allTexts[j];
    allTexts[j] = temp;
  }

  const keys: ('A' | 'B' | 'C' | 'D')[] = ['A', 'B', 'C', 'D'];
  const newIndex = allTexts.indexOf(correctText);
  const newCorrectAnswer = keys[newIndex] || 'A';

  return {
    ...q,
    optionA: allTexts[0],
    optionB: allTexts[1],
    optionC: allTexts[2],
    optionD: allTexts[3],
    correctAnswer: newCorrectAnswer,
  };
}

const generatePercentageQuestions = (
  subjectId: mongoose.Types.ObjectId,
  topicId: mongoose.Types.ObjectId
) => {
  const questions = [];

  // 25 Easy
  for (let i = 1; i <= 25; i++) {
    const x = i * 2;
    const y = 100;
    const ans = (x * y) / 100;
    const baseQ = {
      subjectId,
      topicId,
      questionText: `What is ${x}% of ${y}?`,
      optionA: `${ans}`,
      optionB: `${ans + 10}`,
      optionC: `${ans - 5}`,
      optionD: `${ans * 2}`,
      correctAnswer: 'A' as const,
      explanation: `${x}% of ${y} is calculated as (${x}/100) * ${y} = ${ans}`,
      difficulty: 'Easy' as const,
      isActive: true,
    };
    questions.push(shuffleQuestionOptions(baseQ));
  }

  // 25 Medium
  for (let i = 1; i <= 25; i++) {
    const x = i * 5;
    const y = 200 + i * 10;
    const ans = (x * y) / 100;
    const baseQ = {
      subjectId,
      topicId,
      questionText: `If a number is increased by ${x}%, it becomes ${y + ans}. What was the original number?`,
      optionA: `${y}`,
      optionB: `${y + 20}`,
      optionC: `${y - 10}`,
      optionD: `${y * 2}`,
      correctAnswer: 'A' as const,
      explanation: `Let original number be ${y}. Increased by ${x}% = ${y} + (${x}/100)*${y} = ${y + ans}.`,
      difficulty: 'Medium' as const,
      isActive: true,
    };
    questions.push(shuffleQuestionOptions(baseQ));
  }

  // 25 Hard
  for (let i = 1; i <= 25; i++) {
    const x = i * 3;
    const y = 500 + i * 20;
    const ans = (x * y) / 100;
    const baseQ = {
      subjectId,
      topicId,
      questionText: `In an election, a candidate got ${x}% of the total valid votes of ${y}. How many valid votes did the candidate get?`,
      optionA: `${ans + 50}`,
      optionB: `${ans - 30}`,
      optionC: `${ans}`,
      optionD: `${ans * 1.5}`,
      correctAnswer: 'C' as const,
      explanation: `Total valid votes = ${y}. Candidate got ${x}% of ${y} = (${x}/100) * ${y} = ${ans}.`,
      difficulty: 'Hard' as const,
      isActive: true,
    };
    questions.push(shuffleQuestionOptions(baseQ));
  }

  return questions;
};

const seedDatabase = async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('Error: MONGODB_URI environment variable is not defined.');
    process.exit(1);
  }

  try {
    await mongoose.connect(uri);
    console.log('MongoDB Connected for Seeding');

    const subjectsData = [
      { name: 'Quantitative Aptitude', slug: 'quantitative-aptitude', order: 1 },
      { name: 'General Intelligence & Reasoning', slug: 'reasoning', order: 2 },
      { name: 'English', slug: 'english', order: 3 },
      { name: 'General Awareness', slug: 'general-awareness', order: 4 },
    ];

    const subjectMap: Record<string, any> = {};

    for (const sub of subjectsData) {
      let subject = await Subject.findOne({ slug: sub.slug });
      if (!subject) {
        subject = await Subject.create(sub);
        console.log(`Created Subject: ${subject.name}`);
      } else {
        console.log(`Subject exists: ${subject.name}`);
      }
      subjectMap[sub.slug] = subject;
    }

    // Reset questions to ensure all options are freshly randomized across A, B, C, D
    const deleteResult = await Question.deleteMany({});
    console.log(`Cleared ${deleteResult.deletedCount} old questions for fresh randomization.`);

    // 1. QUANTITATIVE APTITUDE: Percentage
    const quant = subjectMap['quantitative-aptitude'];
    let percentageTopic = await Topic.findOne({ slug: 'percentage', subjectId: quant._id });
    if (!percentageTopic) {
      percentageTopic = await Topic.create({
        name: 'Percentage',
        slug: 'percentage',
        subjectId: quant._id,
        order: 1,
      });
      console.log('Created Topic: Percentage');
    }

    const percentageQuestions = generatePercentageQuestions(quant._id, percentageTopic._id);
    await Question.insertMany(percentageQuestions);
    console.log(`Seeded ${percentageQuestions.length} shuffled questions for Percentage.`);

    // 2. QUANTITATIVE APTITUDE: Profit & Loss
    let profitLossTopic = await Topic.findOne({ slug: 'profit-and-loss', subjectId: quant._id });
    if (!profitLossTopic) {
      profitLossTopic = await Topic.create({
        name: 'Profit & Loss',
        slug: 'profit-and-loss',
        subjectId: quant._id,
        order: 2,
      });
      console.log('Created Topic: Profit & Loss');
    }

    const profitLossDocs = PROFIT_LOSS_QUESTIONS.map((q) => ({
      ...shuffleQuestionOptions(q),
      subjectId: quant._id,
      topicId: profitLossTopic._id,
      isActive: true,
    }));
    await Question.insertMany(profitLossDocs);
    console.log(`Seeded ${profitLossDocs.length} shuffled questions for Profit & Loss.`);

    // 3. REASONING: Analogy & Classification
    const reasoning = subjectMap['reasoning'];
    let reasoningTopic = await Topic.findOne({
      slug: 'analogy-and-classification',
      subjectId: reasoning._id,
    });
    if (!reasoningTopic) {
      reasoningTopic = await Topic.create({
        name: 'Analogy & Classification',
        slug: 'analogy-and-classification',
        subjectId: reasoning._id,
        order: 1,
      });
      console.log('Created Topic: Analogy & Classification');
    }

    const reasoningDocs = REASONING_ANALOGY_QUESTIONS.map((q) => ({
      ...shuffleQuestionOptions(q),
      subjectId: reasoning._id,
      topicId: reasoningTopic._id,
      isActive: true,
    }));
    await Question.insertMany(reasoningDocs);
    console.log(`Seeded ${reasoningDocs.length} shuffled questions for Analogy & Classification.`);

    // 4. ENGLISH: Grammar & Vocabulary
    const english = subjectMap['english'];
    let englishTopic = await Topic.findOne({
      slug: 'grammar-and-vocabulary',
      subjectId: english._id,
    });
    if (!englishTopic) {
      englishTopic = await Topic.create({
        name: 'Grammar & Vocabulary Mastery',
        slug: 'grammar-and-vocabulary',
        subjectId: english._id,
        order: 1,
      });
      console.log('Created Topic: Grammar & Vocabulary');
    }

    const englishDocs = ENGLISH_QUESTIONS.map((q) => ({
      ...shuffleQuestionOptions(q),
      subjectId: english._id,
      topicId: englishTopic._id,
      isActive: true,
    }));
    await Question.insertMany(englishDocs);
    console.log(`Seeded ${englishDocs.length} shuffled questions for English.`);

    // 5. GENERAL AWARENESS: Indian Polity & History
    const ga = subjectMap['general-awareness'];
    let gaTopic = await Topic.findOne({
      slug: 'polity-and-history',
      subjectId: ga._id,
    });
    if (!gaTopic) {
      gaTopic = await Topic.create({
        name: 'Polity, History & Science',
        slug: 'polity-and-history',
        subjectId: ga._id,
        order: 1,
      });
      console.log('Created Topic: Polity & History');
    }

    const gaDocs = GENERAL_AWARENESS_QUESTIONS.map((q) => ({
      ...shuffleQuestionOptions(q),
      subjectId: ga._id,
      topicId: gaTopic._id,
      isActive: true,
    }));
    await Question.insertMany(gaDocs);
    console.log(`Seeded ${gaDocs.length} shuffled questions for General Awareness.`);

    // Check distribution of correct answers across A, B, C, D
    const distA = await Question.countDocuments({ correctAnswer: 'A' });
    const distB = await Question.countDocuments({ correctAnswer: 'B' });
    const distC = await Question.countDocuments({ correctAnswer: 'C' });
    const distD = await Question.countDocuments({ correctAnswer: 'D' });

    console.log('\n--- Correct Answer Distribution ---');
    console.log(`Option A: ${distA}`);
    console.log(`Option B: ${distB}`);
    console.log(`Option C: ${distC}`);
    console.log(`Option D: ${distD}`);

    console.log('\nDatabase Seeding with Randomized Options Completed Successfully!');
    process.exit(0);
  } catch (error: any) {
    console.error(`Error Seeding Database: ${error.message}`);
    process.exit(1);
  }
};

seedDatabase();
