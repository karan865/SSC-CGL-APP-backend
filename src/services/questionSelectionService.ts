import mongoose from 'mongoose';
import { Subject } from '../models/Subject';
import { Topic } from '../models/Topic';
import { Question } from '../models/Question';
import { QuestionAttempt } from '../models/QuestionAttempt';

export interface SelectPracticeQuestionsParams {
  userId?: string;
  subjectId: string;
  topicId: string;
  difficulty: string;
  count?: number;
}

export interface SelectionInfo {
  unseenCount: number;
  reviewCount: number;
  totalEligible: number;
}

export interface SelectPracticeQuestionsResult {
  success: boolean;
  available: number;
  required: number;
  totalQuestions: number;
  unseenCount: number;
  reviewCount: number;
  questions: any[];
  selectionInfo?: SelectionInfo;
}

/**
 * Standard security projection to strictly prevent leakage of
 * correctAnswer or explanation during practice initialization.
 */
const SECURITY_PROJECTION = {
  correctAnswer: 0,
  explanation: 0,
  __v: 0,
  isActive: 0,
  createdAt: 0,
  updatedAt: 0,
};

/**
 * Fisher-Yates array randomizer.
 */
function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Smart question selection engine with anti-repetition logic.
 *
 * 1. Checks total active questions matching subject, topic, and difficulty.
 * 2. Fetches unique question IDs previously attempted by this user/guest in the topic.
 * 3. Identifies unseen questions (IDs not in attempted list).
 * 4. Prioritizes unseen questions up to the requested count.
 * 5. If unseen questions are fewer than requested, gracefully samples the remainder
 *    from the user's previously attempted pool (revision mode).
 * 6. Shuffles the combined set to avoid predictable sequencing.
 * 7. Applies strict security projection.
 */
export async function selectPracticeQuestions(
  params: SelectPracticeQuestionsParams
): Promise<SelectPracticeQuestionsResult> {
  const {
    userId = 'guest_default',
    subjectId,
    topicId,
    difficulty,
    count = 25,
  } = params;

  if (!mongoose.Types.ObjectId.isValid(subjectId) || !mongoose.Types.ObjectId.isValid(topicId)) {
    throw new Error('INVALID_ID');
  }

  const validDifficulties = ['Easy', 'Medium', 'Hard'];
  if (!validDifficulties.includes(difficulty)) {
    throw new Error('INVALID_DIFFICULTY');
  }

  const normalizedUserId = userId?.trim() || 'guest_default';
  const subObjId = new mongoose.Types.ObjectId(subjectId);
  const topicObjId = new mongoose.Types.ObjectId(topicId);

  // Validate subject & topic existence and active state
  const subject = await Subject.findOne({ _id: subObjId, isActive: true });
  if (!subject) throw new Error('SUBJECT_NOT_FOUND');

  const topic = await Topic.findOne({ _id: topicObjId, subjectId: subObjId, isActive: true });
  if (!topic) throw new Error('TOPIC_NOT_FOUND');

  const matchCriteria = {
    subjectId: subObjId,
    topicId: topicObjId,
    difficulty,
    isActive: true,
  };

  // 1. Total eligible questions in bank
  const totalEligible = await Question.countDocuments(matchCriteria as any);
  const targetCount = Math.max(1, Number(count) || 25);

  if (totalEligible < targetCount) {
    return {
      success: false,
      available: totalEligible,
      required: targetCount,
      totalQuestions: 0,
      unseenCount: 0,
      reviewCount: 0,
      questions: [],
    };
  }

  // 2. Fetch distinct question IDs attempted by this user in this topic
  const attemptedQuestionIds: mongoose.Types.ObjectId[] = await QuestionAttempt.distinct('questionId', {
    userId: normalizedUserId,
    topicId: topicObjId,
  });

  // 3. Count how many eligible questions in this difficulty pool are unseen
  const unseenFilter = {
    ...matchCriteria,
    _id: { $nin: attemptedQuestionIds },
  };

  const unseenEligibleCount = await Question.countDocuments(unseenFilter as any);

  let selectedQuestions: any[] = [];
  let unseenCount = 0;
  let reviewCount = 0;

  if (unseenEligibleCount >= targetCount) {
    // Plenty of unseen questions available — sample all from unseen pool
    selectedQuestions = await Question.aggregate([
      { $match: unseenFilter },
      { $sample: { size: targetCount } },
      { $project: SECURITY_PROJECTION },
    ]);
    unseenCount = selectedQuestions.length;
    reviewCount = 0;
  } else {
    // Unseen pool has fewer questions than requested (or 0)
    // Take all available unseen questions, then fill remainder from attempted pool
    let unseenDocs: any[] = [];
    if (unseenEligibleCount > 0) {
      unseenDocs = await Question.aggregate([
        { $match: unseenFilter },
        { $sample: { size: unseenEligibleCount } },
        { $project: SECURITY_PROJECTION },
      ]);
    }

    const neededFromReview = targetCount - unseenDocs.length;
    const reviewFilter = {
      ...matchCriteria,
      _id: { $in: attemptedQuestionIds },
    };

    const reviewDocs = await Question.aggregate([
      { $match: reviewFilter },
      { $sample: { size: neededFromReview } },
      { $project: SECURITY_PROJECTION },
    ]);

    // Combine and shuffle so unseen & revision questions are smoothly blended
    selectedQuestions = shuffleArray([...unseenDocs, ...reviewDocs]);
    unseenCount = unseenDocs.length;
    reviewCount = reviewDocs.length;
  }

  return {
    success: true,
    available: totalEligible,
    required: targetCount,
    totalQuestions: selectedQuestions.length,
    unseenCount,
    reviewCount,
    questions: selectedQuestions,
    selectionInfo: {
      unseenCount,
      reviewCount,
      totalEligible,
    },
  };
}
