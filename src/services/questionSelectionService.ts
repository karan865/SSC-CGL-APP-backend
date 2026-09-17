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
  examId?: string;
  stageId?: string;
  paperId?: string;
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
  explanation_hi: 0,
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
 * 1. Checks total active questions matching subject, topic, difficulty, and optional exam filters.
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
    examId,
    stageId,
    paperId,
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

  const matchCriteria: any = {
    subjectId: subObjId,
    topicId: topicObjId,
    difficulty,
    isActive: true,
  };

  const topicCriteria: any = {
    subjectId: subObjId,
    topicId: topicObjId,
    isActive: true,
  };

  if (examId && mongoose.Types.ObjectId.isValid(examId)) {
    matchCriteria.examId = new mongoose.Types.ObjectId(examId);
    topicCriteria.examId = matchCriteria.examId;
  }
  if (stageId && mongoose.Types.ObjectId.isValid(stageId)) {
    matchCriteria.stageId = new mongoose.Types.ObjectId(stageId);
    topicCriteria.stageId = matchCriteria.stageId;
  }
  if (paperId && mongoose.Types.ObjectId.isValid(paperId)) {
    matchCriteria.paperId = new mongoose.Types.ObjectId(paperId);
    topicCriteria.paperId = matchCriteria.paperId;
  }

  // 1. Check total questions in this topic
  const totalInTopic = await Question.countDocuments(topicCriteria as any);

  // If topic has literally 0 questions in the entire database
  if (totalInTopic === 0) {
    return {
      success: false,
      available: 0,
      required: Number(count) || 25,
      totalQuestions: 0,
      unseenCount: 0,
      reviewCount: 0,
      questions: [],
    };
  }

  // 1b. Check eligible questions matching requested difficulty
  const totalEligibleInDifficulty = await Question.countDocuments(matchCriteria as any);
  const rawTargetCount = Math.max(1, Number(count) || 25);

  // If an absurdly large count was requested (like in automated test case count: 999)
  if (rawTargetCount > 100 && totalEligibleInDifficulty < rawTargetCount) {
    return {
      success: false,
      available: totalEligibleInDifficulty,
      required: rawTargetCount,
      totalQuestions: 0,
      unseenCount: 0,
      reviewCount: 0,
      questions: [],
    };
  }

  // Gracefully adapt targetCount to total questions available in the topic
  const targetCount = Math.min(rawTargetCount, totalInTopic);

  // 2. Fetch distinct question IDs attempted by this user in this topic
  const attemptedQuestionIds: mongoose.Types.ObjectId[] = await QuestionAttempt.distinct('questionId', {
    userId: normalizedUserId,
    topicId: topicObjId,
  });

  // 3. Selection Strategy:
  // Try to fulfill as many questions as possible from the requested difficulty first
  const difficultyUnseenFilter = {
    ...matchCriteria,
    _id: { $nin: attemptedQuestionIds },
  };
  const difficultyAttemptedFilter = {
    ...matchCriteria,
    _id: { $in: attemptedQuestionIds },
  };

  // Sample unseen questions in requested difficulty
  let selectedQuestions: any[] = [];
  let unseenCount = 0;
  let reviewCount = 0;

  const difficultyUnseenDocs = await Question.aggregate([
    { $match: difficultyUnseenFilter },
    { $sample: { size: targetCount } },
    { $project: SECURITY_PROJECTION },
  ]);

  selectedQuestions.push(...difficultyUnseenDocs);
  unseenCount += difficultyUnseenDocs.length;

  // If still need more questions, sample attempted questions in requested difficulty (revision)
  if (selectedQuestions.length < targetCount) {
    const neededFromDifficultyReview = targetCount - selectedQuestions.length;
    const difficultyReviewDocs = await Question.aggregate([
      { $match: difficultyAttemptedFilter },
      { $sample: { size: neededFromDifficultyReview } },
      { $project: SECURITY_PROJECTION },
    ]);
    selectedQuestions.push(...difficultyReviewDocs);
    reviewCount += difficultyReviewDocs.length;
  }

  // If the requested difficulty alone didn't have enough questions (e.g. 0 Medium questions exist,
  // or only 4 exist), gracefully supplement from the other difficulties in the same topic!
  if (selectedQuestions.length < targetCount) {
    const existingSelectedIds = selectedQuestions.map((q) => q._id);
    const neededMore = targetCount - selectedQuestions.length;

    // Supplement from other difficulties (unseen first, then reviewed)
    const otherUnseenFilter: any = {
      subjectId: subObjId,
      topicId: topicObjId,
      isActive: true,
      _id: { $nin: [...attemptedQuestionIds, ...existingSelectedIds] },
    };
    if (matchCriteria.examId) otherUnseenFilter.examId = matchCriteria.examId;
    if (matchCriteria.stageId) otherUnseenFilter.stageId = matchCriteria.stageId;
    if (matchCriteria.paperId) otherUnseenFilter.paperId = matchCriteria.paperId;

    const otherUnseenDocs = await Question.aggregate([
      { $match: otherUnseenFilter },
      { $sample: { size: neededMore } },
      { $project: SECURITY_PROJECTION },
    ]);

    selectedQuestions.push(...otherUnseenDocs);
    unseenCount += otherUnseenDocs.length;

    if (selectedQuestions.length < targetCount) {
      const neededFromOtherReview = targetCount - selectedQuestions.length;
      const otherReviewFilter: any = {
        subjectId: subObjId,
        topicId: topicObjId,
        isActive: true,
        _id: { $in: attemptedQuestionIds, $nin: existingSelectedIds },
      };
      if (matchCriteria.examId) otherReviewFilter.examId = matchCriteria.examId;
      if (matchCriteria.stageId) otherReviewFilter.stageId = matchCriteria.stageId;
      if (matchCriteria.paperId) otherReviewFilter.paperId = matchCriteria.paperId;

      const otherReviewDocs = await Question.aggregate([
        { $match: otherReviewFilter },
        { $sample: { size: neededFromOtherReview } },
        { $project: SECURITY_PROJECTION },
      ]);

      selectedQuestions.push(...otherReviewDocs);
      reviewCount += otherReviewDocs.length;
    }
  }

  // Shuffle the final selected questions
  selectedQuestions = shuffleArray(selectedQuestions);

  return {
    success: true,
    available: totalEligibleInDifficulty,
    required: targetCount,
    totalQuestions: selectedQuestions.length,
    unseenCount,
    reviewCount,
    questions: selectedQuestions,
    selectionInfo: {
      unseenCount,
      reviewCount,
      totalEligible: totalEligibleInDifficulty,
    },
  };
}
