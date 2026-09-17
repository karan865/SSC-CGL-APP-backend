import mongoose from 'mongoose';
import { QuestionAttempt, IQuestionAttempt } from '../models/QuestionAttempt';
import { Question } from '../models/Question';
import { Topic } from '../models/Topic';
import { Subject } from '../models/Subject';
import { Exam } from '../models/Exam';
import { MockTestSession } from '../models/MockTestSession';
import { recordMistakeForRevision } from './revisionService';

export type WeaknessStatus =
  | 'CRITICAL'
  | 'NEEDS_PRACTICE'
  | 'GOOD'
  | 'STRONG'
  | 'INSUFFICIENT_DATA';

export interface TopicPerformanceMetric {
  topicId: string;
  topicName: string;
  topicSlug: string;
  subjectId: string;
  subjectName: string;
  subjectSlug: string;
  attempted: number;
  correct: number;
  wrong: number;
  accuracy: number;
  lastAttempted: Date | null;
  status: WeaknessStatus;
  priorityScore: number;
  difficultyBreakdown: {
    Easy: { attempted: number; correct: number; accuracy: number };
    Medium: { attempted: number; correct: number; accuracy: number };
    Hard: { attempted: number; correct: number; accuracy: number };
  };
}

export interface SubjectPerformanceMetric {
  subjectId: string;
  subjectName: string;
  subjectSlug: string;
  attempted: number;
  correct: number;
  wrong: number;
  accuracy: number;
  totalMarks: number;
  averageMarks: number;
}

export interface DifficultyPerformanceMetric {
  attempted: number;
  correct: number;
  wrong: number;
  accuracy: number;
}

export interface UserPerformanceSummary {
  userId: string;
  totalQuestions: number;
  totalAttempted: number;
  totalCorrect: number;
  totalWrong: number;
  overallAccuracy: number;
  totalMarks: number;
  subjects: SubjectPerformanceMetric[];
  topics: TopicPerformanceMetric[];
  weakTopics: TopicPerformanceMetric[];
  difficulty: {
    Easy: DifficultyPerformanceMetric;
    Medium: DifficultyPerformanceMetric;
    Hard: DifficultyPerformanceMetric;
  };
  hasEnoughData: boolean;
}

export interface PracticeRecommendation {
  topicId: string;
  topicName: string;
  subjectId: string;
  subjectName: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  questionCount: number;
  reason: string;
  status: WeaknessStatus;
  currentAccuracy: number;
  attemptsCount: number;
  availableQuestions: number;
}

/**
 * Classifies weak topic status based on accuracy and attempt count.
 */
export function classifyWeaknessStatus(accuracy: number, attempts: number): WeaknessStatus {
  if (attempts < 5) {
    return 'INSUFFICIENT_DATA';
  }
  if (accuracy < 50) {
    return 'CRITICAL';
  }
  if (accuracy < 70) {
    return 'NEEDS_PRACTICE';
  }
  if (accuracy < 85) {
    return 'GOOD';
  }
  return 'STRONG';
}

/**
 * Calculates priority score for weak topics ranking.
 * Topics with lower accuracy and more attempts rank higher.
 */
export function calculatePriorityScore(accuracy: number, attempts: number): number {
  if (attempts === 0) return 0;
  // Weight factor based on weakness severity and log of attempts
  const inaccuracy = Math.max(0, 100 - accuracy);
  const volumeWeight = Math.log10(attempts + 1);
  return Number((inaccuracy * volumeWeight).toFixed(2));
}

/**
 * Records a single question attempt from Practice Mode.
 * Includes deduplication guard against rapid double-taps (3-second window).
 */
export async function recordPracticeAttempt(
  userId: string,
  questionId: string,
  selectedAnswer: 'A' | 'B' | 'C' | 'D',
  isCorrect: boolean,
  marks: number
): Promise<IQuestionAttempt | null> {
  const normalizedUserId = userId?.trim() || 'guest_default';
  const qObjId = new mongoose.Types.ObjectId(questionId);

  // Duplicate prevention within 3 seconds
  const threeSecondsAgo = new Date(Date.now() - 3000);
  const recentDuplicate = await QuestionAttempt.findOne({
    userId: normalizedUserId,
    questionId: qObjId,
    selectedAnswer,
    attemptedAt: { $gte: threeSecondsAgo },
  });

  if (recentDuplicate) {
    return recentDuplicate;
  }

  const question = await Question.findById(qObjId);
  if (!question) {
    return null;
  }

  const attempt = await QuestionAttempt.create({
    userId: normalizedUserId,
    examId: question.examId,
    stageId: question.stageId,
    paperId: question.paperId,
    questionId: qObjId,
    subjectId: question.subjectId,
    topicId: question.topicId,
    selectedAnswer,
    correctAnswer: question.correctAnswer,
    isCorrect,
    marks,
    difficulty: question.difficulty,
    source: 'PRACTICE',
    attemptedAt: new Date(),
  });

  return attempt;
}

/**
 * Records question attempts in bulk when a Mock Test is completed and submitted.
 * Idempotent: Skips questions already recorded for the same session.
 */
export async function recordMockTestAttempts(
  sessionId: string,
  userId: string = 'guest_default'
): Promise<number> {
  const normalizedUserId = userId?.trim() || 'guest_default';

  const session = await MockTestSession.findOne({ sessionId });
  if (!session || session.status !== 'COMPLETED') {
    return 0;
  }

  const answeredItems = session.answers.filter((a) => a.selectedAnswer !== null);
  if (answeredItems.length === 0) {
    return 0;
  }

  const questionIds = answeredItems.map((a) => a.questionId);
  const originalQuestions = await Question.find({ _id: { $in: questionIds } });
  const questionMap = new Map<string, any>();
  originalQuestions.forEach((q) => questionMap.set(q._id.toString(), q));

  // Check which attempts already exist for this session
  const existingAttempts = await QuestionAttempt.find({
    userId: normalizedUserId,
    sessionId,
    questionId: { $in: questionIds },
  }).select('questionId');

  const existingSet = new Set(existingAttempts.map((a) => a.questionId.toString()));

  const newAttempts: any[] = [];
  for (const item of answeredItems) {
    const qStr = item.questionId.toString();
    if (existingSet.has(qStr)) continue;

    const qDoc = questionMap.get(qStr);
    if (!qDoc) continue;

    const isCorrect = item.selectedAnswer === qDoc.correctAnswer;
    const marks = isCorrect
      ? (session.scoringConfig?.correctMarks ?? 2)
      : -(session.scoringConfig?.wrongMarks ?? 0.5);

    if (!isCorrect) {
      recordMistakeForRevision(normalizedUserId, item.questionId, qDoc.subjectId, qDoc.topicId).catch((e) =>
        console.warn('Failed to record mock test mistake for revision:', e)
      );
    }

    newAttempts.push({
      userId: normalizedUserId,
      examId: qDoc.examId,
      stageId: qDoc.stageId,
      paperId: qDoc.paperId,
      questionId: item.questionId,
      subjectId: qDoc.subjectId,
      topicId: qDoc.topicId,
      selectedAnswer: item.selectedAnswer,
      correctAnswer: qDoc.correctAnswer,
      isCorrect,
      marks,
      difficulty: qDoc.difficulty,
      source: 'MOCK_TEST',
      sessionId,
      attemptedAt: item.updatedAt || new Date(),
    });
  }

  if (newAttempts.length > 0) {
    await QuestionAttempt.insertMany(newAttempts);
  }

  return newAttempts.length;
}

/**
 * Generates comprehensive performance analytics for a user/guest.
 */
export async function getUserPerformance(
  userId: string = 'guest_default',
  examId?: string
): Promise<UserPerformanceSummary> {
  const normalizedUserId = userId?.trim() || 'guest_default';

  let examObjId: mongoose.Types.ObjectId | undefined;
  if (examId) {
    if (mongoose.Types.ObjectId.isValid(examId)) {
      examObjId = new mongoose.Types.ObjectId(examId);
    } else {
      const ex = await Exam.findOne({ slug: examId.toLowerCase(), isActive: true });
      if (ex) examObjId = ex._id as mongoose.Types.ObjectId;
    }
  } else {
    // Default to SSC CGL for backward compatibility with legacy clients
    const ex = await Exam.findOne({ slug: 'ssc-cgl', isActive: true });
    if (ex) examObjId = ex._id as mongoose.Types.ObjectId;
  }

  // 1. Fetch all subjects and topics for complete mapping
  const subjectQuery: any = { isActive: true };
  const topicQuery: any = { isActive: true };
  if (examObjId) {
    subjectQuery.examId = examObjId;
    topicQuery.examId = examObjId;
  }

  const allSubjects = await Subject.find(subjectQuery).sort({ order: 1 });
  const allTopics = await Topic.find(topicQuery).sort({ order: 1 });

  const subjectMap = new Map<string, any>();
  allSubjects.forEach((s) => subjectMap.set(s._id.toString(), s));

  const topicMap = new Map<string, any>();
  allTopics.forEach((t) => topicMap.set(t._id.toString(), t));

  const matchFilter: any = { userId: normalizedUserId };
  if (examObjId) {
    // Use subject IDs to scope attempts to the active exam.
    // This is more reliable than matching on examId alone, because legacy
    // attempts may have examId=null. Subjects are always exam-scoped.
    const examSubjectIds = allSubjects.map((s) => s._id);
    if (examSubjectIds.length > 0) {
      matchFilter.subjectId = { $in: examSubjectIds };
    } else {
      // No subjects for this exam — return empty results
      matchFilter.examId = examObjId;
    }
  }

  // 2. Aggregate attempts by topic and difficulty
  const topicAggregates = await QuestionAttempt.aggregate([
    { $match: matchFilter },
    {
      $group: {
        _id: {
          topicId: '$topicId',
          difficulty: '$difficulty',
        },
        subjectId: { $first: '$subjectId' },
        attempted: { $sum: 1 },
        correct: { $sum: { $cond: ['$isCorrect', 1, 0] } },
        wrong: { $sum: { $cond: ['$isCorrect', 0, 1] } },
        totalMarks: { $sum: '$marks' },
        lastAttempted: { $max: '$attemptedAt' },
      },
    },
  ]);

  // Merge topic aggregates into full structure - STRICTLY scoped to active exam topics
  const topicStatsMap = new Map<string, TopicPerformanceMetric>();

  topicAggregates.forEach((item) => {
    const topicIdStr = item._id.topicId.toString();
    const diff = item._id.difficulty as 'Easy' | 'Medium' | 'Hard';

    // Ensure topic belongs to the active exam's topics
    if (topicMap.size > 0 && !topicMap.has(topicIdStr)) {
      return;
    }

    if (!topicStatsMap.has(topicIdStr)) {
      const topicDoc = topicMap.get(topicIdStr);
      const subjectDoc = topicDoc ? subjectMap.get(topicDoc.subjectId.toString()) : null;

      topicStatsMap.set(topicIdStr, {
        topicId: topicIdStr,
        topicName: topicDoc?.name || 'Topic',
        topicSlug: topicDoc?.slug || '',
        subjectId: topicDoc ? topicDoc.subjectId.toString() : item.subjectId.toString(),
        subjectName: subjectDoc?.name || 'Subject',
        subjectSlug: subjectDoc?.slug || '',
        attempted: 0,
        correct: 0,
        wrong: 0,
        accuracy: 0,
        lastAttempted: null,
        status: 'INSUFFICIENT_DATA',
        priorityScore: 0,
        difficultyBreakdown: {
          Easy: { attempted: 0, correct: 0, accuracy: 0 },
          Medium: { attempted: 0, correct: 0, accuracy: 0 },
          Hard: { attempted: 0, correct: 0, accuracy: 0 },
        },
      });
    }

    const tStat = topicStatsMap.get(topicIdStr)!;
    tStat.attempted += item.attempted;
    tStat.correct += item.correct;
    tStat.wrong += item.wrong;
    if (!tStat.lastAttempted || item.lastAttempted > tStat.lastAttempted) {
      tStat.lastAttempted = item.lastAttempted;
    }

    if (tStat.difficultyBreakdown[diff]) {
      tStat.difficultyBreakdown[diff].attempted += item.attempted;
      tStat.difficultyBreakdown[diff].correct += item.correct;
      tStat.difficultyBreakdown[diff].accuracy =
        item.attempted > 0 ? Number(((item.correct / item.attempted) * 100).toFixed(1)) : 0;
    }
  });

  // Calculate final accuracy and status for each topic
  const topicsList: TopicPerformanceMetric[] = [];
  topicStatsMap.forEach((t) => {
    t.accuracy = t.attempted > 0 ? Number(((t.correct / t.attempted) * 100).toFixed(1)) : 0;
    t.status = classifyWeaknessStatus(t.accuracy, t.attempted);
    t.priorityScore = calculatePriorityScore(t.accuracy, t.attempted);
    topicsList.push(t);
  });

  // Filter weak topics and rank by priority score descending
  const weakTopics = topicsList
    .filter((t) => t.status === 'CRITICAL' || t.status === 'NEEDS_PRACTICE')
    .sort((a, b) => b.priorityScore - a.priorityScore);

  // 3. Aggregate overall and subject metrics
  let totalAttempted = 0;
  let totalCorrect = 0;
  let totalWrong = 0;
  let totalMarks = 0;

  const difficultyStats = {
    Easy: { attempted: 0, correct: 0, wrong: 0, accuracy: 0 },
    Medium: { attempted: 0, correct: 0, wrong: 0, accuracy: 0 },
    Hard: { attempted: 0, correct: 0, wrong: 0, accuracy: 0 },
  };

  const subjectStatsMap = new Map<string, SubjectPerformanceMetric>();
  allSubjects.forEach((s) => {
    subjectStatsMap.set(s._id.toString(), {
      subjectId: s._id.toString(),
      subjectName: s.name,
      subjectSlug: s.slug,
      attempted: 0,
      correct: 0,
      wrong: 0,
      accuracy: 0,
      totalMarks: 0,
      averageMarks: 0,
    });
  });

  // Detailed subject & difficulty aggregation
  const detailedAggregates = await QuestionAttempt.aggregate([
    { $match: matchFilter },
    {
      $group: {
        _id: {
          subjectId: '$subjectId',
          difficulty: '$difficulty',
        },
        attempted: { $sum: 1 },
        correct: { $sum: { $cond: ['$isCorrect', 1, 0] } },
        wrong: { $sum: { $cond: ['$isCorrect', 0, 1] } },
        marks: { $sum: '$marks' },
      },
    },
  ]);

  detailedAggregates.forEach((item) => {
    const sId = item._id.subjectId.toString();
    // Only tally stats for subjects that belong to this exam
    if (allSubjects.length > 0 && !subjectStatsMap.has(sId)) {
      return;
    }

    totalAttempted += item.attempted;
    totalCorrect += item.correct;
    totalWrong += item.wrong;
    totalMarks += item.marks;

    const diff = item._id.difficulty as 'Easy' | 'Medium' | 'Hard';
    if (difficultyStats[diff]) {
      difficultyStats[diff].attempted += item.attempted;
      difficultyStats[diff].correct += item.correct;
      difficultyStats[diff].wrong += item.wrong;
    }

    if (subjectStatsMap.has(sId)) {
      const sStat = subjectStatsMap.get(sId)!;
      sStat.attempted += item.attempted;
      sStat.correct += item.correct;
      sStat.wrong += item.wrong;
      sStat.totalMarks += item.marks;
    }
  });

  // Calculate difficulty accuracies
  (['Easy', 'Medium', 'Hard'] as const).forEach((d) => {
    const entry = difficultyStats[d];
    entry.accuracy = entry.attempted > 0 ? Number(((entry.correct / entry.attempted) * 100).toFixed(1)) : 0;
  });

  // Calculate subject accuracies and average marks
  const subjectsList: SubjectPerformanceMetric[] = [];
  subjectStatsMap.forEach((s) => {
    s.accuracy = s.attempted > 0 ? Number(((s.correct / s.attempted) * 100).toFixed(1)) : 0;
    s.averageMarks = s.attempted > 0 ? Number((s.totalMarks / s.attempted).toFixed(2)) : 0;
    subjectsList.push(s);
  });

  const overallAccuracy =
    totalAttempted > 0 ? Number(((totalCorrect / totalAttempted) * 100).toFixed(1)) : 0;

  return {
    userId: normalizedUserId,
    totalQuestions: totalAttempted,
    totalAttempted,
    totalCorrect,
    totalWrong,
    overallAccuracy,
    totalMarks: Number(totalMarks.toFixed(2)),
    subjects: subjectsList,
    topics: topicsList.sort((a, b) => b.attempted - a.attempted),
    weakTopics,
    difficulty: difficultyStats,
    hasEnoughData: totalAttempted >= 5,
  };
}

/**
 * Selects the optimal recommended practice drill for the student.
 * 1. Identifies the highest priority weak topic (or under-practiced topic).
 * 2. Selects the ideal difficulty based on current mastery level.
 * 3. STRICTLY validates question inventory availability in MongoDB before responding.
 */
export async function getRecommendedPractice(
  userId: string = 'guest_default',
  limit: number = 3,
  examId?: string
): Promise<PracticeRecommendation> {
  const normalizedUserId = userId?.trim() || 'guest_default';
  const performance = await getUserPerformance(normalizedUserId, examId);

  // Resolve exam doc to formulate exam-relevant starter topics & copy
  let resolvedExamDoc: any = null;
  if (examId) {
    if (mongoose.Types.ObjectId.isValid(examId)) {
      resolvedExamDoc = await Exam.findById(examId);
    } else {
      resolvedExamDoc = await Exam.findOne({ slug: examId.toLowerCase(), isActive: true });
    }
  }
  if (!resolvedExamDoc) {
    resolvedExamDoc = await Exam.findOne({ slug: 'ssc-cgl', isActive: true });
  }

  let targetTopic: TopicPerformanceMetric | null = null;
  let recommendedDifficulty: 'Easy' | 'Medium' | 'Hard' = 'Medium';
  let reason = '';
  let status: WeaknessStatus = 'INSUFFICIENT_DATA';

  if (performance.weakTopics.length > 0) {
    // Top priority weak topic
    targetTopic = performance.weakTopics[0];
    status = targetTopic.status;

    if (status === 'CRITICAL') {
      // If critical and weak in Easy, start with Easy to rebuild foundation
      const easyAcc = targetTopic.difficultyBreakdown.Easy.accuracy;
      if (easyAcc < 60 && targetTopic.difficultyBreakdown.Easy.attempted > 0) {
        recommendedDifficulty = 'Easy';
        reason = `Your accuracy in ${targetTopic.topicName} is ${targetTopic.accuracy}%. Rebuild fundamental formulas with Easy practice.`;
      } else {
        recommendedDifficulty = 'Medium';
        reason = `Your accuracy in ${targetTopic.topicName} is ${targetTopic.accuracy}% with ${targetTopic.attempted} attempts. Focus drill recommended.`;
      }
    } else {
      // NEEDS_PRACTICE
      recommendedDifficulty = 'Medium';
      reason = `Your accuracy in ${targetTopic.topicName} is ${targetTopic.accuracy}%. Practice Medium sets to reach 75%+ exam accuracy.`;
    }
  } else if (performance.topics.length > 0) {
    // If no critical weaknesses, find a topic that is GOOD (recommend Hard/Medium) or least practiced
    const goodTopic = performance.topics.find((t) => t.status === 'GOOD');
    if (goodTopic) {
      targetTopic = goodTopic;
      status = 'GOOD';
      recommendedDifficulty = 'Hard';
      reason = `You have good accuracy (${goodTopic.accuracy}%) in ${goodTopic.topicName}. Challenge yourself with Hard questions!`;
    } else {
      targetTopic = performance.topics[0];
      status = targetTopic.status;
      recommendedDifficulty = 'Medium';
      reason = `Continue building speed and precision in ${targetTopic.topicName}.`;
    }
  } else {
    // New student with 0 attempts: pick first subject & topic belonging to THIS specific exam
    const examSubject = await Subject.findOne({
      examId: resolvedExamDoc?._id,
      isActive: true,
    }).sort({ order: 1 });

    if (examSubject) {
      const examStarterTopic = await Topic.findOne({
        subjectId: examSubject._id,
        isActive: true,
      }).sort({ order: 1 });

      if (examStarterTopic) {
        targetTopic = {
          topicId: examStarterTopic._id.toString(),
          topicName: examStarterTopic.name,
          topicSlug: examStarterTopic.slug,
          subjectId: examSubject._id.toString(),
          subjectName: examSubject.name,
          subjectSlug: examSubject.slug,
          attempted: 0,
          correct: 0,
          wrong: 0,
          accuracy: 0,
          lastAttempted: null,
          status: 'INSUFFICIENT_DATA',
          priorityScore: 0,
          difficultyBreakdown: {
            Easy: { attempted: 0, correct: 0, accuracy: 0 },
            Medium: { attempted: 0, correct: 0, accuracy: 0 },
            Hard: { attempted: 0, correct: 0, accuracy: 0 },
          },
        };
        recommendedDifficulty = 'Easy';
        const examName = resolvedExamDoc?.name || 'Exam';
        reason = `Kickstart your ${examName} preparation with high-yield ${examStarterTopic.name} practice!`;
      }
    }
  }

  // Fallback if no topic found
  if (!targetTopic) {
    const fallbackTopic = await Topic.findOne(
      resolvedExamDoc ? { examId: resolvedExamDoc._id, isActive: true } : { isActive: true }
    );
    const fallbackSub = fallbackTopic ? await Subject.findById(fallbackTopic.subjectId) : null;
    targetTopic = {
      topicId: fallbackTopic?._id.toString() || '',
      topicName: fallbackTopic?.name || 'General Practice',
      topicSlug: fallbackTopic?.slug || '',
      subjectId: fallbackSub?._id.toString() || '',
      subjectName: fallbackSub?.name || 'General',
      subjectSlug: fallbackSub?.slug || '',
      attempted: 0,
      correct: 0,
      wrong: 0,
      accuracy: 0,
      lastAttempted: null,
      status: 'INSUFFICIENT_DATA',
      priorityScore: 0,
      difficultyBreakdown: {
        Easy: { attempted: 0, correct: 0, accuracy: 0 },
        Medium: { attempted: 0, correct: 0, accuracy: 0 },
        Hard: { attempted: 0, correct: 0, accuracy: 0 },
      },
    };
    recommendedDifficulty = 'Easy';
    reason = 'Begin customized question practice to unlock your personal performance analytics.';
  }

  // --- Inventory Validation Guard ---
  // Ensure the target difficulty actually has questions. If not, pick a difficulty tier that does!
  const targetTopicObjId = new mongoose.Types.ObjectId(targetTopic.topicId);
  const targetSubjectObjId = new mongoose.Types.ObjectId(targetTopic.subjectId);

  let availableCount = await Question.countDocuments({
    subjectId: targetSubjectObjId,
    topicId: targetTopicObjId,
    difficulty: recommendedDifficulty,
    isActive: true,
  });

  if (availableCount < 5) {
    // Try fallback difficulties in priority order: Medium -> Easy -> Hard
    const fallbackTiers: Array<'Easy' | 'Medium' | 'Hard'> = ['Medium', 'Easy', 'Hard'];
    for (const tier of fallbackTiers) {
      const count = await Question.countDocuments({
        subjectId: targetSubjectObjId,
        topicId: targetTopicObjId,
        difficulty: tier,
        isActive: true,
      });
      if (count >= 5) {
        recommendedDifficulty = tier;
        availableCount = count;
        break;
      }
    }
  }

  const questionCount = Math.min(10, Math.max(5, availableCount >= 10 ? 10 : 5));

  return {
    topicId: targetTopic.topicId,
    topicName: targetTopic.topicName,
    subjectId: targetTopic.subjectId,
    subjectName: targetTopic.subjectName,
    difficulty: recommendedDifficulty,
    questionCount,
    reason,
    status,
    currentAccuracy: targetTopic.accuracy,
    attemptsCount: targetTopic.attempted,
    availableQuestions: availableCount,
  };
}

/**
 * Retrieves performance analytics for a single topic.
 */
export async function getTopicPerformance(
  userId: string = 'guest_default',
  topicIdStr: string
): Promise<TopicPerformanceMetric | null> {
  const normalizedUserId = userId?.trim() || 'guest_default';
  if (!mongoose.Types.ObjectId.isValid(topicIdStr)) {
    return null;
  }

  const topicObjId = new mongoose.Types.ObjectId(topicIdStr);
  const topicDoc = await Topic.findById(topicObjId);
  if (!topicDoc) return null;

  const subjectDoc = await Subject.findById(topicDoc.subjectId);

  const attempts = await QuestionAttempt.find({
    userId: normalizedUserId,
    topicId: topicObjId,
  }).sort({ attemptedAt: -1 });

  const total = attempts.length;
  const correct = attempts.filter((a) => a.isCorrect).length;
  const wrong = total - correct;
  const accuracy = total > 0 ? Number(((correct / total) * 100).toFixed(1)) : 0;
  const status = classifyWeaknessStatus(accuracy, total);
  const priorityScore = calculatePriorityScore(accuracy, total);

  const difficultyBreakdown = {
    Easy: { attempted: 0, correct: 0, accuracy: 0 },
    Medium: { attempted: 0, correct: 0, accuracy: 0 },
    Hard: { attempted: 0, correct: 0, accuracy: 0 },
  };

  attempts.forEach((a) => {
    const diff = a.difficulty;
    if (difficultyBreakdown[diff]) {
      difficultyBreakdown[diff].attempted++;
      if (a.isCorrect) difficultyBreakdown[diff].correct++;
    }
  });

  (['Easy', 'Medium', 'Hard'] as const).forEach((d) => {
    const b = difficultyBreakdown[d];
    b.accuracy = b.attempted > 0 ? Number(((b.correct / b.attempted) * 100).toFixed(1)) : 0;
  });

  return {
    topicId: topicIdStr,
    topicName: topicDoc.name,
    topicSlug: topicDoc.slug,
    subjectId: topicDoc.subjectId.toString(),
    subjectName: subjectDoc?.name || '',
    subjectSlug: subjectDoc?.slug || '',
    attempted: total,
    correct,
    wrong,
    accuracy,
    lastAttempted: attempts.length > 0 ? attempts[0].attemptedAt : null,
    status,
    priorityScore,
    difficultyBreakdown,
  };
}
