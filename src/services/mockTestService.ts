import mongoose from 'mongoose';
import { randomUUID } from 'crypto';
import { Subject } from '../models/Subject';
import { Question } from '../models/Question';
import { MarkedQuestion } from '../models/MarkedQuestion';
import { Exam } from '../models/Exam';
import { ExamStage } from '../models/ExamStage';
import { ExamPaper } from '../models/ExamPaper';
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
  questionText_hi?: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  optionA_hi?: string;
  optionB_hi?: string;
  optionC_hi?: string;
  optionD_hi?: string;
  difficulty: string;
}

export interface IStartMockTestResult {
  sessionId: string;
  testType: string;
  examSlug?: string;
  paperSlug?: string;
  totalQuestions: number;
  totalDurationMinutes: number;
  currentSectionIndex: number;
  scoringConfig?: {
    correctMarks: number;
    wrongMarks: number;
    unansweredMarks: number;
  };
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

export const JPSC_PAPER_1_QUOTAS: Record<string, { name: string; quota: number }> = {
  'jpsc-history': { name: 'History of India', quota: 15 },
  'jpsc-geography': { name: 'Geography of India', quota: 10 },
  'jpsc-polity': { name: 'Indian Polity & Governance', quota: 10 },
  'jpsc-economy': { name: 'Economic & Sustainable Development', quota: 10 },
  'jpsc-science': { name: 'Science & Technology', quota: 15 },
  'jpsc-jharkhand': { name: 'Jharkhand Specific', quota: 10 },
  'jpsc-current-affairs': { name: 'National & International Current Affairs', quota: 15 },
  'jpsc-miscellaneous': { name: 'General Miscellaneous', quota: 15 },
};

export const JPSC_PAPER_2_QUOTAS: Record<string, { name: string; quota: number }> = {
  'jpsc-p2-tribal-governance': { name: 'Traditional Tribal Governance', quota: 13 },
  'jpsc-p2-movements-personalities': { name: 'Jharkhand Movements & Personalities', quota: 13 },
  'jpsc-p2-land-laws': { name: 'Land Laws of Jharkhand', quota: 13 },
  'jpsc-p2-geography-rivers': { name: 'Jharkhand Geography & Rivers', quota: 12 },
  'jpsc-p2-minerals-industries': { name: 'Mines, Minerals & Industries', quota: 13 },
  'jpsc-p2-schemes-development': { name: 'Welfare Schemes & Development', quota: 12 },
  'jpsc-p2-forest-environment': { name: 'Forest, Wildlife & Environment', quota: 12 },
  'jpsc-p2-culture-sports': { name: 'Culture, Sports & Miscellaneous', quota: 12 },
};

/**
 * Starts a new Mock Test session with exactly 100 questions.
 * Dynamically loads timing, scoring, and question selection from ExamPaper configuration.
 * Uses strict security projection to ensure correctAnswer and explanation are omitted.
 */
export async function startMockTest(
  testType: string = 'TIER_1',
  examId?: string,
  stageId?: string,
  paperId?: string
): Promise<IStartMockTestResult> {
  const now = new Date();
  const sessionId = randomUUID();

  let resolvedExamDoc: any = null;
  let resolvedPaperDoc: any = null;
  let resolvedExamId: mongoose.Types.ObjectId | undefined;
  let resolvedStageId: mongoose.Types.ObjectId | undefined;
  let resolvedPaperId: mongoose.Types.ObjectId | undefined;
  let scoringConfig = {
    correctMarks: 2,
    wrongMarks: 0.5,
    unansweredMarks: 0,
  };

  if (paperId) {
    if (mongoose.Types.ObjectId.isValid(paperId)) {
      resolvedPaperDoc = await ExamPaper.findById(paperId);
    } else {
      resolvedPaperDoc = await ExamPaper.findOne({ slug: paperId.toLowerCase(), isActive: true });
    }
    if (resolvedPaperDoc) {
      resolvedExamId = resolvedPaperDoc.examId;
      resolvedStageId = resolvedPaperDoc.stageId;
      resolvedPaperId = resolvedPaperDoc._id as mongoose.Types.ObjectId;
      resolvedExamDoc = await Exam.findById(resolvedExamId);
      if (resolvedPaperDoc.scoring) {
        scoringConfig = {
          correctMarks: resolvedPaperDoc.scoring.correctMarks ?? 2,
          wrongMarks: Math.abs(resolvedPaperDoc.scoring.wrongMarks ?? 0),
          unansweredMarks: resolvedPaperDoc.scoring.unansweredMarks ?? 0,
        };
      }
    }
  } else if (examId) {
    if (mongoose.Types.ObjectId.isValid(examId)) {
      resolvedExamDoc = await Exam.findById(examId);
    } else {
      resolvedExamDoc = await Exam.findOne({ slug: examId.toLowerCase(), isActive: true });
    }
    if (resolvedExamDoc) {
      resolvedExamId = resolvedExamDoc._id as mongoose.Types.ObjectId;
      resolvedPaperDoc = await ExamPaper.findOne({ examId: resolvedExamDoc._id, isActive: true }).sort({ order: 1 });
      if (resolvedPaperDoc) {
        resolvedStageId = resolvedPaperDoc.stageId;
        resolvedPaperId = resolvedPaperDoc._id as mongoose.Types.ObjectId;
        if (resolvedPaperDoc.scoring) {
          scoringConfig = {
            correctMarks: resolvedPaperDoc.scoring.correctMarks ?? 2,
            wrongMarks: Math.abs(resolvedPaperDoc.scoring.wrongMarks ?? 0),
            unansweredMarks: resolvedPaperDoc.scoring.unansweredMarks ?? 0,
          };
        }
      }
    }
  }

  const sectionConfigs: IMockSectionConfig[] = [];
  const sanitizedQuestions: ISanitizedMockQuestion[] = [];

  const isJpsc =
    resolvedExamDoc?.slug === 'jpsc' ||
    resolvedPaperDoc?.slug === 'paper-1' ||
    resolvedPaperDoc?.slug === 'paper-2';

  if (isJpsc && resolvedPaperDoc) {
    // -------------------------------------------------------------
    // JPSC PRELIMS MOCK FLOW (120 Minutes, 100 Questions, +2 / 0)
    // -------------------------------------------------------------
    const durationMinutes = resolvedPaperDoc.durationMinutes || 120;
    const paperExpiryTime = new Date(now.getTime() + durationMinutes * 60 * 1000);
    const isPaper1 = resolvedPaperDoc.slug === 'paper-1';
    const quotas = isPaper1 ? JPSC_PAPER_1_QUOTAS : JPSC_PAPER_2_QUOTAS;

    let sectionIdx = 0;
    for (const [subSlug, spec] of Object.entries(quotas)) {
      const subject = await Subject.findOne({
        examId: resolvedExamId,
        paperId: resolvedPaperId,
        slug: subSlug,
        isActive: true,
      });

      if (!subject) {
        throw new Error(`SUBJECT_NOT_FOUND:${spec.name}`);
      }

      const availableCount = await Question.countDocuments({
        examId: resolvedExamId,
        paperId: resolvedPaperId,
        subjectId: subject._id,
        isActive: true,
      });

      if (availableCount < spec.quota) {
        throw new Error(
          `INSUFFICIENT_QUESTIONS:${spec.name}: Available ${availableCount} < Required ${spec.quota}`
        );
      }

      const sampledQuestions = await Question.aggregate([
        {
          $match: {
            examId: resolvedExamId,
            paperId: resolvedPaperId,
            subjectId: subject._id,
            isActive: true,
          },
        },
        { $sample: { size: spec.quota } },
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

      if (sampledQuestions.length < spec.quota) {
        throw new Error(
          `SAMPLING_FAILED:${spec.name}: Expected ${spec.quota}, got ${sampledQuestions.length}`
        );
      }

      const questionIds = sampledQuestions.map((q) => q._id as mongoose.Types.ObjectId);

      sectionConfigs.push({
        sectionIndex: sectionIdx,
        subjectSlug: subject.slug,
        name: spec.name,
        durationMinutes,
        startedAt: now,
        expiresAt: paperExpiryTime,
        isLocked: false,
        questionIds,
      });

      for (const q of sampledQuestions) {
        sanitizedQuestions.push({
          _id: q._id.toString(),
          sectionIndex: sectionIdx,
          subjectSlug: subject.slug,
          topicId: q.topicId.toString(),
          questionText: q.questionText,
          questionText_hi: q.questionText_hi,
          optionA: q.optionA,
          optionB: q.optionB,
          optionC: q.optionC,
          optionD: q.optionD,
          optionA_hi: q.optionA_hi,
          optionB_hi: q.optionB_hi,
          optionC_hi: q.optionC_hi,
          optionD_hi: q.optionD_hi,
          difficulty: q.difficulty || 'Medium',
        });
      }

      sectionIdx++;
    }

    const session = await MockTestSession.create({
      sessionId,
      testType: testType || (isPaper1 ? 'JPSC_PRELIMS_P1' : 'JPSC_PRELIMS_P2'),
      examId: resolvedExamId,
      stageId: resolvedStageId,
      paperId: resolvedPaperId,
      scoringConfig,
      status: 'IN_PROGRESS',
      currentSectionIndex: 0,
      sections: sectionConfigs,
      answers: [],
      startedAt: now,
      expiresAt: paperExpiryTime,
    });

    return {
      sessionId: session.sessionId,
      testType: session.testType,
      examSlug: resolvedExamDoc?.slug || 'jpsc',
      paperSlug: resolvedPaperDoc.slug,
      totalQuestions: sanitizedQuestions.length,
      totalDurationMinutes: durationMinutes,
      currentSectionIndex: 0,
      scoringConfig,
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

  // -------------------------------------------------------------
  // SSC CGL TIER-1 MOCK FLOW (60 Minutes, 4 Sections of 25 Qs, +2 / -0.50)
  // -------------------------------------------------------------
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
          questionText_hi: 1,
          optionA: 1,
          optionB: 1,
          optionC: 1,
          optionD: 1,
          optionA_hi: 1,
          optionB_hi: 1,
          optionC_hi: 1,
          optionD_hi: 1,
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
        questionText_hi: q.questionText_hi,
        optionA: q.optionA,
        optionB: q.optionB,
        optionC: q.optionC,
        optionD: q.optionD,
        optionA_hi: q.optionA_hi,
        optionB_hi: q.optionB_hi,
        optionC_hi: q.optionC_hi,
        optionD_hi: q.optionD_hi,
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
    examId: resolvedExamId,
    stageId: resolvedStageId,
    paperId: resolvedPaperId,
    scoringConfig,
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
    examSlug: 'ssc-cgl',
    paperSlug: 'tier-1',
    totalQuestions: sanitizedQuestions.length,
    totalDurationMinutes: 60,
    currentSectionIndex: 0,
    scoringConfig,
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

  // Find target section containing question
  const targetSection = session.sections.find((s) =>
    s.questionIds.some((id) => id.equals(questionId))
  );

  if (!targetSection) {
    throw new Error('QUESTION_NOT_IN_SESSION');
  }

  // Check section expiration by server time
  if (targetSection.expiresAt && now > targetSection.expiresAt) {
    targetSection.isLocked = true;
    await session.save();
    throw new Error('SECTION_LOCKED_EXPIRED');
  }

  if (targetSection.isLocked) {
    throw new Error('QUESTION_IN_LOCKED_SECTION');
  }

  // For sequential exams (like SSC Tier-1 with 4 15-minute sections), enforce sequential section navigation
  const isSequentialExam =
    session.sections.length === 4 &&
    session.sections.some((s, idx) => s.durationMinutes === 15 && idx > 0);

  if (isSequentialExam) {
    if (targetSection.sectionIndex > session.currentSectionIndex) {
      throw new Error('QUESTION_IN_UPCOMING_SECTION');
    }
    if (targetSection.sectionIndex < session.currentSectionIndex) {
      throw new Error('QUESTION_IN_LOCKED_SECTION');
    }
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

  const scoring = session.scoringConfig || {
    correctMarks: 2,
    wrongMarks: 0.5,
    unansweredMarks: 0,
  };
  const correctMarks = scoring.correctMarks !== undefined ? scoring.correctMarks : 2;
  const wrongMarks = Math.abs(scoring.wrongMarks !== undefined ? scoring.wrongMarks : 0.5);
  const unansweredMarks = scoring.unansweredMarks !== undefined ? scoring.unansweredMarks : 0;

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
    const sMarks = Number(
      (sCorrect * correctMarks - sWrong * wrongMarks + sUnanswered * unansweredMarks).toFixed(2)
    );
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
    maxMarks: allQuestionIds.length * correctMarks,
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
  questionText_hi?: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  optionA_hi?: string;
  optionB_hi?: string;
  optionC_hi?: string;
  optionD_hi?: string;
  difficulty: string;
  userSelectedAnswer: 'A' | 'B' | 'C' | 'D' | null;
  correctAnswer: 'A' | 'B' | 'C' | 'D';
  isCorrect: boolean;
  isMarkedForReview: boolean;
  marksAwarded: number;
  explanation: string;
  explanation_hi?: string;
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

  const scoring = session.scoringConfig || {
    correctMarks: 2,
    wrongMarks: 0.5,
    unansweredMarks: 0,
  };
  const correctMarks = scoring.correctMarks !== undefined ? scoring.correctMarks : 2;
  const wrongMarks = Math.abs(scoring.wrongMarks !== undefined ? scoring.wrongMarks : 0.5);
  const unansweredMarks = scoring.unansweredMarks !== undefined ? scoring.unansweredMarks : 0;

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
      marksAwarded = isCorrect ? correctMarks : -wrongMarks;
    } else {
      marksAwarded = unansweredMarks;
    }

    reviewQuestions.push({
      questionId: qDoc._id.toString(),
      sectionIndex: meta.sectionIndex,
      subjectSlug: meta.subjectSlug,
      topicId: qDoc.topicId.toString(),
      questionText: qDoc.questionText,
      questionText_hi: qDoc.questionText_hi,
      optionA: qDoc.optionA,
      optionB: qDoc.optionB,
      optionC: qDoc.optionC,
      optionD: qDoc.optionD,
      optionA_hi: qDoc.optionA_hi,
      optionB_hi: qDoc.optionB_hi,
      optionC_hi: qDoc.optionC_hi,
      optionD_hi: qDoc.optionD_hi,
      difficulty: qDoc.difficulty || 'Medium',
      userSelectedAnswer,
      correctAnswer,
      isCorrect,
      isMarkedForReview,
      marksAwarded,
      explanation: qDoc.explanation || 'Detailed step-by-step solution.',
      explanation_hi: qDoc.explanation_hi,
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
export async function getMarkedQuestions(
  sessionId?: string,
  examId?: string
): Promise<IMarkedQuestionsResult> {
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

  let examFilter: any = {};
  if (examId) {
    if (mongoose.Types.ObjectId.isValid(examId)) {
      examFilter.examId = new mongoose.Types.ObjectId(examId);
    } else {
      const examDoc = await Exam.findOne({ slug: examId.toLowerCase() });
      if (examDoc) examFilter.examId = examDoc._id;
    }
  }

  const questions = await Question.find({ _id: { $in: allIds }, ...examFilter });
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
      questionText_hi: qDoc.questionText_hi,
      optionA: qDoc.optionA,
      optionB: qDoc.optionB,
      optionC: qDoc.optionC,
      optionD: qDoc.optionD,
      optionA_hi: qDoc.optionA_hi,
      optionB_hi: qDoc.optionB_hi,
      optionC_hi: qDoc.optionC_hi,
      optionD_hi: qDoc.optionD_hi,
      difficulty: qDoc.difficulty || 'Medium',
      userSelectedAnswer,
      correctAnswer,
      isCorrect,
      isMarkedForReview: true,
      marksAwarded,
      explanation: qDoc.explanation || 'Detailed step-by-step solution.',
      explanation_hi: qDoc.explanation_hi,
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
      questionText_hi: qDoc.questionText_hi,
      optionA: qDoc.optionA,
      optionB: qDoc.optionB,
      optionC: qDoc.optionC,
      optionD: qDoc.optionD,
      optionA_hi: qDoc.optionA_hi,
      optionB_hi: qDoc.optionB_hi,
      optionC_hi: qDoc.optionC_hi,
      optionD_hi: qDoc.optionD_hi,
      difficulty: qDoc.difficulty || 'Medium',
      userSelectedAnswer,
      correctAnswer,
      isCorrect,
      isMarkedForReview: true,
      marksAwarded,
      explanation: qDoc.explanation || 'Detailed step-by-step solution.',
      explanation_hi: qDoc.explanation_hi,
    });
  }

  return {
    sessionId: session?.sessionId || '',
    totalMarked: markedReviewQuestions.length,
    questions: markedReviewQuestions,
  };
}


