import mongoose from 'mongoose';
import { randomUUID } from 'crypto';
import { Subject } from '../models/Subject';
import { Question } from '../models/Question';
import { MarkedQuestion } from '../models/MarkedQuestion';
import {
  MockTestSession,
  IMockTestSession,
  IMockSectionConfig,
  IMockSectionResult,
  IMockScoreSummary,
} from '../models/MockTestSession';
import { recordMockTestAttempts } from './performanceService';

export interface ISanitizedMockQuestion {
  _id: string;
  sectionIndex: number;
  subjectSlug: string;
  topicId: string;
  questionText: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  difficulty: string;
}

export interface IStartMockTestResult {
  sessionId: string;
  testType: 'TIER_1';
  totalQuestions: number;
  totalDurationMinutes: number;
  currentSectionIndex: number;
  sections: {
    sectionIndex: number;
    subjectSlug: string;
    name: string;
    durationMinutes: number;
    questionCount: number;
    startedAt: string;
    expiresAt: string;
    isLocked: boolean;
  }[];
  questions: ISanitizedMockQuestion[];
}

const SECTION_SPECS = [
  {
    sectionIndex: 0,
    name: 'General Intelligence & Reasoning',
    slugs: ['reasoning', 'general-intelligence-and-reasoning'],
    requiredCount: 25,
    durationMinutes: 15,
  },
  {
    sectionIndex: 1,
    name: 'General Awareness',
    slugs: ['general-awareness', 'ga'],
    requiredCount: 25,
    durationMinutes: 15,
  },
  {
    sectionIndex: 2,
    name: 'Quantitative Aptitude',
    slugs: ['quantitative-aptitude', 'quant'],
    requiredCount: 25,
    durationMinutes: 15,
  },
  {
    sectionIndex: 3,
    name: 'English Comprehension',
    slugs: ['english', 'english-comprehension'],
    requiredCount: 25,
    durationMinutes: 15,
  },
];

/**
 * Starts a new Tier-1 Mock Test session with exactly 100 questions (25 per section).
 * Uses strict security projection to ensure correctAnswer and explanation are omitted.
 */
export async function startMockTest(testType: 'TIER_1' = 'TIER_1'): Promise<IStartMockTestResult> {
  const now = new Date();
  const sessionId = randomUUID();

  const sectionConfigs: IMockSectionConfig[] = [];
  const sanitizedQuestions: ISanitizedMockQuestion[] = [];

  // Build sequential timing for 4 sections (15m each, total 60m)
  let sectionStartTime = new Date(now.getTime());

  for (const spec of SECTION_SPECS) {
    // Find canonical subject
    const subject = await Subject.findOne({
      $or: [{ slug: { $in: spec.slugs } }, { code: { $in: spec.slugs.map((s) => s.toUpperCase()) } }],
      isActive: true,
    });

    if (!subject) {
      throw new Error(`SUBJECT_NOT_FOUND:${spec.name}`);
    }

    const availableCount = await Question.countDocuments({
      subjectId: subject._id,
      isActive: true,
    });

    if (availableCount < spec.requiredCount) {
      throw new Error(
        `INSUFFICIENT_QUESTIONS:${spec.name}: Available ${availableCount} < Required ${spec.requiredCount}`
      );
    }

    // Sample 25 questions randomly with topic representation
    const sampledQuestions = await Question.aggregate([
      {
        $match: {
          subjectId: subject._id,
          isActive: true,
        },
      },
      { $sample: { size: spec.requiredCount } },
      {
        $project: {
          _id: 1,
          topicId: 1,
          questionText: 1,
          optionA: 1,
          optionB: 1,
          optionC: 1,
          optionD: 1,
          difficulty: 1,
        },
      },
    ]);

    if (sampledQuestions.length < spec.requiredCount) {
      throw new Error(
        `SAMPLING_FAILED:${spec.name}: Expected ${spec.requiredCount}, got ${sampledQuestions.length}`
      );
    }

    const sectionExpiryTime = new Date(
      sectionStartTime.getTime() + spec.durationMinutes * 60 * 1000
    );

    const questionIds = sampledQuestions.map((q) => q._id as mongoose.Types.ObjectId);

    sectionConfigs.push({
      sectionIndex: spec.sectionIndex,
      subjectSlug: subject.slug,
      name: spec.name,
      durationMinutes: spec.durationMinutes,
      startedAt: sectionStartTime,
      expiresAt: sectionExpiryTime,
      isLocked: false,
      questionIds,
    });

    for (const q of sampledQuestions) {
      sanitizedQuestions.push({
        _id: q._id.toString(),
        sectionIndex: spec.sectionIndex,
        subjectSlug: subject.slug,
        topicId: q.topicId.toString(),
        questionText: q.questionText,
        optionA: q.optionA,
        optionB: q.optionB,
        optionC: q.optionC,
        optionD: q.optionD,
        difficulty: q.difficulty || 'Medium',
      });
    }

    // Advance start time for next section calculation
    sectionStartTime = sectionExpiryTime;
  }

  const overallExpiresAt = sectionStartTime; // after 60 mins

  const session = await MockTestSession.create({
    sessionId,
    testType,
    status: 'IN_PROGRESS',
    currentSectionIndex: 0,
    sections: sectionConfigs,
    answers: [],
    startedAt: now,
    expiresAt: overallExpiresAt,
  });

  return {
    sessionId: session.sessionId,
    testType: 'TIER_1',
    totalQuestions: sanitizedQuestions.length,
    totalDurationMinutes: 60,
    currentSectionIndex: 0,
    sections: session.sections.map((s) => ({
      sectionIndex: s.sectionIndex,
      subjectSlug: s.subjectSlug,
      name: s.name,
      durationMinutes: s.durationMinutes,
      questionCount: s.questionIds.length,
      startedAt: s.startedAt!.toISOString(),
      expiresAt: s.expiresAt!.toISOString(),
      isLocked: s.isLocked,
    })),
    questions: sanitizedQuestions,
  };
}

/**
 * Records or updates a user's answer or review state for a question in an active mock test.
 */
export async function saveMockAnswer(
  sessionId: string,
  questionIdStr: string,
  selectedAnswer: 'A' | 'B' | 'C' | 'D' | null,
  isMarkedForReview: boolean = false
) {
  if (!mongoose.Types.ObjectId.isValid(questionIdStr)) {
    throw new Error('INVALID_QUESTION_ID');
  }

  const session = await MockTestSession.findOne({ sessionId });
  if (!session) {
    throw new Error('SESSION_NOT_FOUND');
  }

  if (session.status !== 'IN_PROGRESS') {
    throw new Error('SESSION_NOT_ACTIVE');
  }

  const now = new Date();
  const currentSection = session.sections[session.currentSectionIndex];

  if (!currentSection) {
    throw new Error('SECTION_NOT_FOUND');
  }

  // Check section expiration by server time
  if (currentSection.expiresAt && now > currentSection.expiresAt) {
    currentSection.isLocked = true;
    await session.save();
    throw new Error('SECTION_LOCKED_EXPIRED');
  }

  const questionId = new mongoose.Types.ObjectId(questionIdStr);

  // Check question belongs to the current section
  const belongsToCurrent = currentSection.questionIds.some((id) => id.equals(questionId));
  if (!belongsToCurrent) {
    const isLockedSection = session.sections
      .filter((s) => s.isLocked)
      .some((s) => s.questionIds.some((id) => id.equals(questionId)));
    if (isLockedSection) {
      throw new Error('QUESTION_IN_LOCKED_SECTION');
    }

    const isUpcomingSection = session.sections
      .filter((s) => s.sectionIndex > session.currentSectionIndex)
      .some((s) => s.questionIds.some((id) => id.equals(questionId)));
    if (isUpcomingSection) {
      throw new Error('QUESTION_IN_UPCOMING_SECTION');
    }

    throw new Error('QUESTION_NOT_IN_SESSION');
  }

  if (selectedAnswer !== null && !['A', 'B', 'C', 'D'].includes(selectedAnswer)) {
    throw new Error('INVALID_OPTION_CHOICE');
  }

  // Update or insert answer record
  const existingIdx = session.answers.findIndex((a) => a.questionId.equals(questionId));
  if (existingIdx >= 0) {
    session.answers[existingIdx].selectedAnswer = selectedAnswer;
    session.answers[existingIdx].isMarkedForReview = isMarkedForReview;
    session.answers[existingIdx].updatedAt = now;
  } else {
    session.answers.push({
      questionId,
      selectedAnswer,
      isMarkedForReview,
      updatedAt: now,
    });
  }

  await session.save();

  return {
    success: true,
    sessionId,
    questionId: questionIdStr,
    selectedAnswer,
    isMarkedForReview,
  };
}

/**
 * Locks the current section and advances to the next section.
 */
export async function advanceMockSection(sessionId: string, currentSectionIndex: number) {
  const session = await MockTestSession.findOne({ sessionId });
  if (!session) {
    throw new Error('SESSION_NOT_FOUND');
  }

  if (session.status !== 'IN_PROGRESS') {
    throw new Error('SESSION_NOT_ACTIVE');
  }

  if (currentSectionIndex < 0 || currentSectionIndex >= session.sections.length) {
    throw new Error('INVALID_SECTION_INDEX');
  }

  // Lock the current section
  session.sections[currentSectionIndex].isLocked = true;

  // Advance to next section if available
  const nextIndex = currentSectionIndex + 1;
  if (nextIndex < session.sections.length) {
    session.currentSectionIndex = nextIndex;
  }

  await session.save();

  return {
    success: true,
    sessionId,
    currentSectionIndex: session.currentSectionIndex,
    isFinalSection: session.currentSectionIndex === session.sections.length - 1,
    sections: session.sections.map((s) => ({
      sectionIndex: s.sectionIndex,
      name: s.name,
      isLocked: s.isLocked,
    })),
  };
}

/**
 * Submits a mock test and computes official SSC CGL Tier-1 scoring:
 * - Correct: +2 marks
 * - Wrong: -0.50 marks
 * - Unanswered: 0 marks
 * - Maximum marks: 200
 */
export async function submitMockTest(
  sessionId: string,
  userId: string = 'guest_default'
): Promise<IMockScoreSummary> {
  const session = await MockTestSession.findOne({ sessionId });
  if (!session) {
    throw new Error('SESSION_NOT_FOUND');
  }

  // If already submitted, return existing score summary idempotently
  if (session.status === 'COMPLETED' && session.scoreSummary) {
    return session.scoreSummary;
  }

  // Gather all 100 questions
  const allQuestionIds: mongoose.Types.ObjectId[] = [];
  for (const s of session.sections) {
    allQuestionIds.push(...s.questionIds);
  }

  const originalQuestions = await Question.find({
    _id: { $in: allQuestionIds },
  }).select('_id correctAnswer subjectId');

  const questionMap = new Map<string, string>();
  originalQuestions.forEach((q) => {
    questionMap.set(q._id.toString(), q.correctAnswer);
  });

  const answerMap = new Map<string, string>();
  session.answers.forEach((a) => {
    if (a.selectedAnswer) {
      answerMap.set(a.questionId.toString(), a.selectedAnswer);
    }
  });

  const sectionResults: IMockSectionResult[] = [];
  let totalCorrect = 0;
  let totalWrong = 0;
  let totalUnanswered = 0;
  let totalScore = 0;

  for (const s of session.sections) {
    let sCorrect = 0;
    let sWrong = 0;
    let sUnanswered = 0;

    for (const qId of s.questionIds) {
      const qIdStr = qId.toString();
      const userAns = answerMap.get(qIdStr);
      const correctAns = questionMap.get(qIdStr);

      if (!userAns) {
        sUnanswered++;
      } else if (userAns === correctAns) {
        sCorrect++;
      } else {
        sWrong++;
      }
    }

    const sAttempted = sCorrect + sWrong;
    const sMarks = Number((sCorrect * 2 - sWrong * 0.5).toFixed(2));
    const sAccuracy = sAttempted > 0 ? Number(((sCorrect / sAttempted) * 100).toFixed(1)) : 0;

    totalCorrect += sCorrect;
    totalWrong += sWrong;
    totalUnanswered += sUnanswered;
    totalScore += sMarks;

    sectionResults.push({
      sectionIndex: s.sectionIndex,
      subjectSlug: s.subjectSlug,
      name: s.name,
      totalQuestions: s.questionIds.length,
      correct: sCorrect,
      wrong: sWrong,
      unanswered: sUnanswered,
      marks: sMarks,
      accuracy: sAccuracy,
    });
  }

  const totalAttempted = totalCorrect + totalWrong;
  const overallAccuracy =
    totalAttempted > 0 ? Number(((totalCorrect / totalAttempted) * 100).toFixed(1)) : 0;

  const scoreSummary: IMockScoreSummary = {
    totalQuestions: allQuestionIds.length,
    maxMarks: 200,
    totalScore: Number(totalScore.toFixed(2)),
    totalCorrect,
    totalWrong,
    totalUnanswered,
    accuracy: overallAccuracy,
    sectionResults,
  };

  session.status = 'COMPLETED';
  session.submittedAt = new Date();
  session.scoreSummary = scoreSummary;

  // Lock all sections upon submission
  session.sections.forEach((s) => {
    s.isLocked = true;
  });

  await session.save();

  // Persist question attempts for personalized performance analytics
  try {
    await recordMockTestAttempts(session.sessionId, userId);
  } catch (err) {
    console.warn('Failed to record mock test attempts:', err);
  }

  return scoreSummary;
}

export interface IMockReviewQuestion {
  questionId: string;
  sectionIndex: number;
  subjectSlug: string;
  topicId: string;
  questionText: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  difficulty: string;
  userSelectedAnswer: 'A' | 'B' | 'C' | 'D' | null;
  correctAnswer: 'A' | 'B' | 'C' | 'D';
  isCorrect: boolean;
  isMarkedForReview: boolean;
  marksAwarded: number;
  explanation: string;
}

export interface IMockReviewResult {
  sessionId: string;
  scoreSummary: IMockScoreSummary;
  questions: IMockReviewQuestion[];
}

/**
 * Returns comprehensive post-exam review with correct answers, student choices, and explanations.
 * STRICT SECURITY: Only accessible when the test status is COMPLETED.
 */
export async function getMockTestReview(sessionId: string): Promise<IMockReviewResult> {
  const session = await MockTestSession.findOne({ sessionId });
  if (!session) {
    throw new Error('SESSION_NOT_FOUND');
  }

  if (session.status !== 'COMPLETED' || !session.scoreSummary) {
    throw new Error('SESSION_NOT_COMPLETED');
  }

  // Collect all question IDs in order of sections
  const questionMetaList: { qId: mongoose.Types.ObjectId; sectionIndex: number; subjectSlug: string }[] = [];
  for (const s of session.sections) {
    for (const qId of s.questionIds) {
      questionMetaList.push({
        qId,
        sectionIndex: s.sectionIndex,
        subjectSlug: s.subjectSlug,
      });
    }
  }

  const allIds = questionMetaList.map((m) => m.qId);
  const questions = await Question.find({ _id: { $in: allIds } });

  const questionById = new Map<string, any>();
  questions.forEach((q) => {
    questionById.set(q._id.toString(), q);
  });

  const answerByQuestionId = new Map<
    string,
    { selectedAnswer: 'A' | 'B' | 'C' | 'D' | null; isMarkedForReview: boolean }
  >();

  session.answers.forEach((a) => {
    answerByQuestionId.set(a.questionId.toString(), {
      selectedAnswer: a.selectedAnswer,
      isMarkedForReview: a.isMarkedForReview,
    });
  });

  const reviewQuestions: IMockReviewQuestion[] = [];

  for (const meta of questionMetaList) {
    const qDoc = questionById.get(meta.qId.toString());
    if (!qDoc) continue;

    const answerInfo = answerByQuestionId.get(meta.qId.toString());
    const userSelectedAnswer = answerInfo?.selectedAnswer ?? null;
    const isMarkedForReview = answerInfo?.isMarkedForReview ?? false;
    const correctAnswer = qDoc.correctAnswer;
    const isCorrect = userSelectedAnswer === correctAnswer;

    let marksAwarded = 0;
    if (userSelectedAnswer) {
      marksAwarded = isCorrect ? 2 : -0.5;
    }

    reviewQuestions.push({
      questionId: qDoc._id.toString(),
      sectionIndex: meta.sectionIndex,
      subjectSlug: meta.subjectSlug,
      topicId: qDoc.topicId.toString(),
      questionText: qDoc.questionText,
      optionA: qDoc.optionA,
      optionB: qDoc.optionB,
      optionC: qDoc.optionC,
      optionD: qDoc.optionD,
      difficulty: qDoc.difficulty || 'Medium',
      userSelectedAnswer,
      correctAnswer,
      isCorrect,
      isMarkedForReview,
      marksAwarded,
      explanation: qDoc.explanation || 'Detailed step-by-step solution.',
    });
  }

  return {
    sessionId: session.sessionId,
    scoreSummary: session.scoreSummary,
    questions: reviewQuestions,
  };
}

export interface IMarkedQuestionsResult {
  sessionId: string;
  totalMarked: number;
  questions: IMockReviewQuestion[];
}

/**
 * Returns all questions marked for review by the candidate.
 * If sessionId is omitted, retrieves marked questions from the latest mock session.
 */
export async function getMarkedQuestions(sessionId?: string): Promise<IMarkedQuestionsResult> {
  const practiceMarks = await MarkedQuestion.find({ isMarked: true }).sort({ updatedAt: -1 });

  let session = null;
  if (sessionId) {
    session = await MockTestSession.findOne({ sessionId });
  } else {
    session = await MockTestSession.findOne({
      'answers.isMarkedForReview': true,
    }).sort({ updatedAt: -1 });
  }

  const mockMarkedAnswers = session ? session.answers.filter((a) => a.isMarkedForReview) : [];

  if (practiceMarks.length === 0 && mockMarkedAnswers.length === 0) {
    return {
      sessionId: session?.sessionId || '',
      totalMarked: 0,
      questions: [],
    };
  }

  // Collect all unique question IDs
  const allQuestionIdSet = new Set<string>();
  practiceMarks.forEach((pm) => allQuestionIdSet.add(pm.questionId.toString()));
  mockMarkedAnswers.forEach((ma) => allQuestionIdSet.add(ma.questionId.toString()));

  const allIds = Array.from(allQuestionIdSet).map((id) => new mongoose.Types.ObjectId(id));
  const questions = await Question.find({ _id: { $in: allIds } });
  const questionMap = new Map<string, any>();
  questions.forEach((q) => questionMap.set(q._id.toString(), q));

  // Load all subjects to get accurate subjectSlug for practice questions
  const subjects = await Subject.find({});
  const subjectSlugById = new Map<string, string>();
  subjects.forEach((s) => subjectSlugById.set(s._id.toString(), s.slug));

  // Map mock question section/subject info if available
  const questionSectionMap = new Map<string, { sectionIndex: number; subjectSlug: string }>();
  if (session) {
    for (const s of session.sections) {
      for (const qId of s.questionIds) {
        questionSectionMap.set(qId.toString(), {
          sectionIndex: s.sectionIndex,
          subjectSlug: s.subjectSlug,
        });
      }
    }
  }

  const markedReviewQuestions: IMockReviewQuestion[] = [];
  const processedSet = new Set<string>();

  // 1. Process Practice Mode marked questions
  for (const pm of practiceMarks) {
    const qIdStr = pm.questionId.toString();
    if (processedSet.has(qIdStr)) continue;
    const qDoc = questionMap.get(qIdStr);
    if (!qDoc) continue;

    processedSet.add(qIdStr);
    const subjectSlug = subjectSlugById.get(qDoc.subjectId.toString()) || 'quantitative-aptitude';
    const userSelectedAnswer = (pm.userSelectedAnswer as 'A' | 'B' | 'C' | 'D' | null) ?? null;
    const correctAnswer = qDoc.correctAnswer;
    const isCorrect = userSelectedAnswer === correctAnswer;
    const marksAwarded = userSelectedAnswer ? (isCorrect ? 1 : 0) : 0;

    markedReviewQuestions.push({
      questionId: qDoc._id.toString(),
      sectionIndex: 0,
      subjectSlug,
      topicId: qDoc.topicId.toString(),
      questionText: qDoc.questionText,
      optionA: qDoc.optionA,
      optionB: qDoc.optionB,
      optionC: qDoc.optionC,
      optionD: qDoc.optionD,
      difficulty: qDoc.difficulty || 'Medium',
      userSelectedAnswer,
      correctAnswer,
      isCorrect,
      isMarkedForReview: true,
      marksAwarded,
      explanation: qDoc.explanation || 'Detailed step-by-step solution.',
    });
  }

  // 2. Process Mock Test marked questions
  for (const ans of mockMarkedAnswers) {
    const qIdStr = ans.questionId.toString();
    if (processedSet.has(qIdStr)) continue;
    const qDoc = questionMap.get(qIdStr);
    if (!qDoc) continue;

    processedSet.add(qIdStr);
    const secInfo = questionSectionMap.get(qIdStr) || {
      sectionIndex: 0,
      subjectSlug: subjectSlugById.get(qDoc.subjectId.toString()) || 'quantitative-aptitude',
    };

    const userSelectedAnswer = ans.selectedAnswer ?? null;
    const correctAnswer = qDoc.correctAnswer;
    const isCorrect = userSelectedAnswer === correctAnswer;
    let marksAwarded = 0;
    if (userSelectedAnswer) {
      marksAwarded = isCorrect ? 2 : -0.5;
    }

    markedReviewQuestions.push({
      questionId: qDoc._id.toString(),
      sectionIndex: secInfo.sectionIndex,
      subjectSlug: secInfo.subjectSlug,
      topicId: qDoc.topicId.toString(),
      questionText: qDoc.questionText,
      optionA: qDoc.optionA,
      optionB: qDoc.optionB,
      optionC: qDoc.optionC,
      optionD: qDoc.optionD,
      difficulty: qDoc.difficulty || 'Medium',
      userSelectedAnswer,
      correctAnswer,
      isCorrect,
      isMarkedForReview: true,
      marksAwarded,
      explanation: qDoc.explanation || 'Detailed step-by-step solution.',
    });
  }

  return {
    sessionId: session?.sessionId || '',
    totalMarked: markedReviewQuestions.length,
    questions: markedReviewQuestions,
  };
}


