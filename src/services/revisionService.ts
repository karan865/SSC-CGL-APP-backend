import mongoose from 'mongoose';
import { QuestionRevision, IQuestionRevision } from '../models/QuestionRevision';
import { Question } from '../models/Question';
import { QuestionAttempt } from '../models/QuestionAttempt';
import { recordPracticeAttempt } from './performanceService';

export const REVISION_INTERVALS_DAYS: Record<number, number> = {
  1: 1,
  2: 3,
  3: 7,
  4: 14,
  5: 30,
};

export interface RevisionSummary {
  dueCount: number;
  criticalCount: number;
  topicCount: number;
  lastRevisionAt: Date | null;
  hasRevision: boolean;
}

export interface RevisionStats {
  dueToday: number;
  mastered: number;
  inRevision: number;
  totalMistakes: number;
}

/**
 * Records or updates a revision candidate when a student makes a mistake.
 * Safe and idempotent: one revision row per user per question.
 */
export async function recordMistakeForRevision(
  userId: string,
  questionId: string | mongoose.Types.ObjectId,
  subjectId?: string | mongoose.Types.ObjectId,
  topicId?: string | mongoose.Types.ObjectId
): Promise<IQuestionRevision | null> {
  const normalizedUserId = userId?.trim() || 'guest_default';
  const qObjId = new mongoose.Types.ObjectId(questionId);

  // If subjectId or topicId not provided, look up from Question
  let subId = subjectId ? new mongoose.Types.ObjectId(subjectId) : undefined;
  let topId = topicId ? new mongoose.Types.ObjectId(topicId) : undefined;

  if (!subId || !topId) {
    const question = await Question.findById(qObjId);
    if (!question) return null;
    subId = question.subjectId;
    topId = question.topicId;
  }

  // Next review interval for a new or reset mistake is 1 day (Level 1)
  const nextRevisionAt = new Date(Date.now() + 1 * 24 * 60 * 60 * 1000);

  const revision = await QuestionRevision.findOneAndUpdate(
    { userId: normalizedUserId, questionId: qObjId },
    {
      $set: {
        userId: normalizedUserId,
        questionId: qObjId,
        subjectId: subId,
        topicId: topId,
        status: 'SCHEDULED',
        revisionLevel: 1,
        nextRevisionAt,
        lastAttemptAt: new Date(),
        lastRevisionCorrect: false,
      },
      $setOnInsert: {
        totalRevisionAttempts: 0,
        correctRevisionAttempts: 0,
        wrongRevisionAttempts: 0,
      },
    },
    { upsert: true, returnDocument: 'after' }
  );

  return revision;
}

/**
 * Returns a compact summary for the Home Screen cards.
 */
export async function getRevisionSummary(userId: string): Promise<RevisionSummary> {
  const normalizedUserId = userId?.trim() || 'guest_default';
  const now = new Date();

  // Due questions: nextRevisionAt <= now, not MASTERED
  const dueRevisions = await QuestionRevision.find({
    userId: normalizedUserId,
    status: { $ne: 'MASTERED' },
    nextRevisionAt: { $lte: now },
  }).select('topicId revisionLevel wrongRevisionAttempts');

  const dueCount = dueRevisions.length;
  if (dueCount === 0) {
    return {
      dueCount: 0,
      criticalCount: 0,
      topicCount: 0,
      lastRevisionAt: null,
      hasRevision: false,
    };
  }

  // Critical items: Level 1 or repeatedly failed (wrong attempts >= 2)
  const criticalCount = dueRevisions.filter(
    (r) => r.revisionLevel === 1 || r.wrongRevisionAttempts >= 2
  ).length;

  const distinctTopics = new Set(dueRevisions.map((r) => r.topicId.toString()));
  const topicCount = distinctTopics.size;

  const latestRevision = await QuestionRevision.findOne({ userId: normalizedUserId })
    .sort({ lastAttemptAt: -1 })
    .select('lastAttemptAt');

  return {
    dueCount,
    criticalCount,
    topicCount,
    lastRevisionAt: latestRevision?.lastAttemptAt || null,
    hasRevision: true,
  };
}

/**
 * Fetches due revision questions, securely scrubbing correctAnswer and explanation.
 */
export async function getDueRevisions(userId: string, limit: number = 10) {
  const normalizedUserId = userId?.trim() || 'guest_default';
  const now = new Date();
  const cappedLimit = Math.max(1, Math.min(25, Number(limit) || 10));

  const dueRecords = await QuestionRevision.find({
    userId: normalizedUserId,
    status: { $ne: 'MASTERED' },
    nextRevisionAt: { $lte: now },
  })
    .sort({
      revisionLevel: 1, // Lower levels first
      nextRevisionAt: 1, // Older overdue first
    })
    .limit(cappedLimit * 2) // Fetch a pool to allow slight randomization
    .lean();

  const dueTotalCount = await QuestionRevision.countDocuments({
    userId: normalizedUserId,
    status: { $ne: 'MASTERED' },
    nextRevisionAt: { $lte: now },
  });

  if (dueRecords.length === 0) {
    return {
      dueCount: 0,
      selectedCount: 0,
      questions: [],
    };
  }

  const questionIds = dueRecords.map((r) => r.questionId);
  const rawQuestions = await Question.find({
    _id: { $in: questionIds },
    isActive: true,
  })
    .select('-correctAnswer -explanation') // Strict security projection
    .lean();

  const questionMap = new Map<string, any>();
  rawQuestions.forEach((q) => questionMap.set(q._id.toString(), q));

  // Merge revision metadata into questions
  const selectedQuestions: any[] = [];
  for (const rec of dueRecords) {
    const qDoc = questionMap.get(rec.questionId.toString());
    if (qDoc) {
      selectedQuestions.push({
        ...qDoc,
        revisionLevel: rec.revisionLevel,
        nextRevisionAt: rec.nextRevisionAt,
        wrongRevisionAttempts: rec.wrongRevisionAttempts,
      });
      if (selectedQuestions.length >= cappedLimit) break;
    }
  }

  // Shuffle selected items slightly for pleasant test experience
  for (let i = selectedQuestions.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [selectedQuestions[i], selectedQuestions[j]] = [selectedQuestions[j], selectedQuestions[i]];
  }

  return {
    dueCount: dueTotalCount,
    selectedCount: selectedQuestions.length,
    questions: selectedQuestions,
  };
}

/**
 * Starts a revision session.
 */
export async function startRevisionSession(userId: string, limit: number = 10) {
  const result = await getDueRevisions(userId, limit);
  return {
    totalQuestions: result.selectedCount,
    questions: result.questions,
    revisionInfo: {
      dueCount: result.dueCount,
      selectedCount: result.selectedCount,
    },
  };
}

/**
 * Evaluates a revision question answer and advances or resets spaced repetition schedule.
 */
export async function processRevisionAnswer(
  userId: string,
  questionId: string,
  selectedAnswer: string
) {
  if (!mongoose.Types.ObjectId.isValid(questionId)) {
    throw new Error('INVALID_QUESTION_ID');
  }

  const validOptions = ['A', 'B', 'C', 'D'];
  if (!validOptions.includes(selectedAnswer)) {
    throw new Error('INVALID_ANSWER');
  }

  const normalizedUserId = userId?.trim() || 'guest_default';
  const qObjId = new mongoose.Types.ObjectId(questionId);

  const question = await Question.findOne({ _id: qObjId, isActive: true });
  if (!question) {
    throw new Error('QUESTION_NOT_FOUND');
  }

  const isCorrect = selectedAnswer === question.correctAnswer;
  const marks = isCorrect ? 1 : 0; // Practice / revision scoring

  // Record attempt in standard QuestionAttempt collection
  try {
    await recordPracticeAttempt(
      normalizedUserId,
      questionId,
      selectedAnswer as 'A' | 'B' | 'C' | 'D',
      isCorrect,
      marks
    );
  } catch (err) {
    console.warn('Failed to record revision question attempt:', err);
  }

  // Fetch or create revision record
  let revision = await QuestionRevision.findOne({
    userId: normalizedUserId,
    questionId: qObjId,
  });

  if (!revision) {
    revision = new QuestionRevision({
      userId: normalizedUserId,
      questionId: qObjId,
      subjectId: question.subjectId,
      topicId: question.topicId,
      revisionLevel: 1,
      status: 'SCHEDULED',
      nextRevisionAt: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
      totalRevisionAttempts: 0,
      correctRevisionAttempts: 0,
      wrongRevisionAttempts: 0,
    });
  }

  revision.totalRevisionAttempts += 1;
  revision.lastAttemptAt = new Date();

  if (isCorrect) {
    revision.correctRevisionAttempts += 1;
    revision.lastRevisionCorrect = true;

    if (revision.revisionLevel >= 5) {
      // MASTERED state achieved
      revision.status = 'MASTERED';
      // Postpone next review far in future
      revision.nextRevisionAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);
    } else {
      // Advance to next level
      revision.revisionLevel += 1;
      const intervalDays = REVISION_INTERVALS_DAYS[revision.revisionLevel] || 3;
      revision.nextRevisionAt = new Date(Date.now() + intervalDays * 24 * 60 * 60 * 1000);
      revision.status = 'SCHEDULED';
    }
  } else {
    // Reset to level 1 on mistake
    revision.revisionLevel = 1;
    revision.wrongRevisionAttempts += 1;
    revision.lastRevisionCorrect = false;
    revision.status = 'SCHEDULED';
    revision.nextRevisionAt = new Date(Date.now() + 1 * 24 * 60 * 60 * 1000);
  }

  await revision.save();

  return {
    isCorrect,
    selectedAnswer,
    correctAnswer: question.correctAnswer,
    marks,
    explanation: question.explanation,
    revision: {
      revisionLevel: revision.revisionLevel,
      nextRevisionAt: revision.nextRevisionAt,
      status: revision.status,
    },
  };
}

/**
 * Returns overall revision progress statistics.
 */
export async function getRevisionStats(userId: string): Promise<RevisionStats> {
  const normalizedUserId = userId?.trim() || 'guest_default';
  const now = new Date();

  const [dueToday, mastered, inRevision, totalMistakes] = await Promise.all([
    QuestionRevision.countDocuments({
      userId: normalizedUserId,
      status: { $ne: 'MASTERED' },
      nextRevisionAt: { $lte: now },
    }),
    QuestionRevision.countDocuments({
      userId: normalizedUserId,
      status: 'MASTERED',
    }),
    QuestionRevision.countDocuments({
      userId: normalizedUserId,
      status: { $ne: 'MASTERED' },
    }),
    QuestionRevision.countDocuments({
      userId: normalizedUserId,
    }),
  ]);

  return {
    dueToday,
    mastered,
    inRevision,
    totalMistakes,
  };
}
