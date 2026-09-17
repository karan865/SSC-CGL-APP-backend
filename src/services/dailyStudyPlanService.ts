import mongoose from 'mongoose';
import { DailyStudyPlan, IDailyStudyPlan, IStudyPlanItem } from '../models/DailyStudyPlan';
import { Question } from '../models/Question';
import { Subject } from '../models/Subject';
import { Topic } from '../models/Topic';
import { Exam } from '../models/Exam';
import { getUserPerformance, getRecommendedPractice } from './performanceService';
import { getDueRevisions } from './revisionService';
import { recordDailyGoalCompletion } from './studyStreakService';

export function getTodayDateKey(date?: Date): string {
  const d = date || new Date();
  return d.toISOString().split('T')[0];
}

export interface PlanProgressSummary {
  date: string;
  goalQuestions: number;
  completedQuestions: number;
  remainingQuestions: number;
  progressPercent: number;
  estimatedMinutes: number;
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';
  items: Array<{
    id: string;
    type: string;
    title: string;
    subjectId?: string;
    subjectName?: string;
    topicId?: string;
    topicName?: string;
    difficulty?: string;
    questionCount: number;
    completedCount: number;
    remainingCount: number;
    completed: boolean;
  }>;
}

async function resolveExamObjectId(examId?: string): Promise<mongoose.Types.ObjectId | undefined> {
  if (!examId) {
    const defaultExam = (await Exam.findOne({ isDefault: true, isActive: true })) || (await Exam.findOne({ slug: 'ssc-cgl', isActive: true }));
    return defaultExam?._id as mongoose.Types.ObjectId | undefined;
  }
  if (mongoose.Types.ObjectId.isValid(examId)) return new mongoose.Types.ObjectId(examId);
  const examDoc = await Exam.findOne({ slug: examId.toLowerCase(), isActive: true });
  return examDoc?._id as mongoose.Types.ObjectId | undefined;
}

/**
 * Generates or retrieves today's Daily Smart Study Plan.
 * Idempotent: generates once per day unless forceRegenerate is true.
 */
export async function generateDailyPlan(
  userId: string = 'guest_default',
  requestedGoal: number = 35,
  forceRegenerate: boolean = false,
  examId?: string
): Promise<IDailyStudyPlan> {
  const normalizedUserId = userId?.trim() || 'guest_default';
  const dateKey = getTodayDateKey();
  const goal = [20, 35, 50].includes(Number(requestedGoal)) ? Number(requestedGoal) : 35;
  const examObjId = await resolveExamObjectId(examId);

  const planQuery: any = { userId: normalizedUserId, dateKey };
  if (examObjId) planQuery.examId = examObjId;

  // Plan stability: If plan already exists for today, return it
  if (!forceRegenerate) {
    const existingPlan = await DailyStudyPlan.findOne(planQuery);
    if (existingPlan) {
      return existingPlan;
    }
  }

  const performance = await getUserPerformance(normalizedUserId, examId);
  const attempts = performance.totalAttempted;

  let planItems: Array<Partial<IStudyPlanItem>> = [];

  // =========================================================================
  // CASE A: NEW USER (< 5 ATTEMPTS) -> BALANCED STARTER DRILL
  // =========================================================================
  if (attempts < 5) {
    const validTopics = await Topic.find({
      isActive: true,
      subjectId: { $exists: true, $ne: null },
      ...(examObjId ? { examId: examObjId } : {}),
    });
    const validSubjectIds = [
      ...new Set(
        validTopics
          .filter((t) => t.subjectId)
          .map((t) => t.subjectId.toString())
      ),
    ];
    const allSubjects = await Subject.find({
      _id: { $in: validSubjectIds },
      isActive: true,
      ...(examObjId ? { examId: examObjId } : {}),
    }).sort({ order: 1 });
    const targetPerSubject = Math.floor(goal / Math.max(1, allSubjects.length));
    let distributed = 0;

    for (let i = 0; i < allSubjects.length; i++) {
      const sub = allSubjects[i];
      const isLast = i === allSubjects.length - 1;
      const count = isLast ? goal - distributed : targetPerSubject;

      // Find an active topic with enough questions
      const topic = await Topic.findOne({ subjectId: sub._id, isActive: true }).sort({ order: 1 });
      if (topic) {
        const available = await Question.countDocuments({
          subjectId: sub._id,
          topicId: topic._id,
          isActive: true,
        });

        const allocated = Math.min(count, available > 0 ? available : count);
        planItems.push({
          type: 'BALANCED_PRACTICE',
          title: `${sub.name} Foundation`,
          subjectId: sub._id,
          subjectName: sub.name,
          topicId: topic._id,
          topicName: topic.name,
          difficulty: 'Easy',
          questionCount: allocated,
          completedCount: 0,
          priority: 50,
          completed: false,
        });
        distributed += allocated;
      }
    }
  } else {
    // =========================================================================
    // CASE B: EXPERIENCED USER (>= 5 ATTEMPTS) -> SMART PERSONALIZED PLAN
    // Priority: Revision -> Critical Weakness -> Needs Practice -> Recommended -> Balanced -> Mini Mock
    // =========================================================================
    let remainingSlots = goal;

    // 1. PRIORITY 1: DUE REVISION
    try {
      const dueData = await getDueRevisions(normalizedUserId, 15, undefined, examId);
      if (dueData && dueData.dueCount > 0) {
        const maxRevision = Math.min(
          dueData.dueCount,
          Math.max(1, Math.min(10, Math.floor(goal * 0.35)))
        );
        if (maxRevision > 0) {
          planItems.push({
            type: 'REVISION',
            title: "Today's Spaced Revision",
            questionCount: maxRevision,
            completedCount: 0,
            priority: 100,
            completed: false,
          });
          remainingSlots -= maxRevision;
        }
      }
    } catch (err) {
      console.warn('Failed to check revision due in study planner:', err);
    }

    // 2. PRIORITY 2: CRITICAL & NEEDS-PRACTICE WEAK TOPICS
    if (performance.weakTopics && performance.weakTopics.length > 0) {
      for (const weak of performance.weakTopics) {
        if (remainingSlots < 4) break;

        const targetCount = Math.min(10, remainingSlots);
        const diff = weak.status === 'CRITICAL' ? 'Easy' : 'Medium';

        const available = await Question.countDocuments({
          topicId: new mongoose.Types.ObjectId(weak.topicId),
          isActive: true,
        });

        if (available >= 4) {
          const allocated = Math.min(targetCount, available, remainingSlots);
          planItems.push({
            type: 'WEAK_TOPIC',
            title: weak.topicName,
            subjectId: new mongoose.Types.ObjectId(weak.subjectId),
            subjectName: weak.subjectName,
            topicId: new mongoose.Types.ObjectId(weak.topicId),
            topicName: weak.topicName,
            difficulty: diff,
            questionCount: allocated,
            completedCount: 0,
            priority: weak.status === 'CRITICAL' ? 90 : 75,
            completed: false,
          });
          remainingSlots -= allocated;
        }
        if (planItems.filter((it) => it.type === 'WEAK_TOPIC').length >= 2) break;
      }
    }

    // 3. PRIORITY 3: PERSONALIZED RECOMMENDATION
    if (remainingSlots >= 5) {
      try {
        const rec = await getRecommendedPractice(normalizedUserId);
        const alreadyIncluded = planItems.some(
          (it) => it.topicId && it.topicId.toString() === rec.topicId
        );

        if (!alreadyIncluded && rec.availableQuestions >= 4) {
          const allocated = Math.min(remainingSlots, 10, rec.availableQuestions);
          planItems.push({
            type: 'RECOMMENDED',
            title: rec.topicName,
            subjectId: new mongoose.Types.ObjectId(rec.subjectId),
            subjectName: rec.subjectName,
            topicId: new mongoose.Types.ObjectId(rec.topicId),
            topicName: rec.topicName,
            difficulty: rec.difficulty,
            questionCount: allocated,
            completedCount: 0,
            priority: 65,
            completed: false,
          });
          remainingSlots -= allocated;
        }
      } catch (err) {
        console.warn('Failed to get recommendation for planner:', err);
      }
    }

    // 4. PRIORITY 4: BALANCED PRACTICE (UNDER-PRACTICED SUBJECT)
    if (remainingSlots >= 5) {
      // Find subject with lowest recent attempts
      const sortedSubjects = [...performance.subjects].sort(
        (a, b) => a.attempted - b.attempted
      );
      const underPracticed = sortedSubjects[0];

      if (underPracticed) {
        const subId = new mongoose.Types.ObjectId(underPracticed.subjectId);
        const topic = await Topic.findOne({ subjectId: subId, isActive: true }).sort({ order: 1 });
        if (topic) {
          const available = await Question.countDocuments({
            subjectId: subId,
            topicId: topic._id,
            isActive: true,
          });

          if (available >= 4) {
            const allocated = Math.min(remainingSlots, 10, available);
            planItems.push({
              type: 'BALANCED_PRACTICE',
              title: `${underPracticed.subjectName} Practice`,
              subjectId: subId,
              subjectName: underPracticed.subjectName,
              topicId: topic._id,
              topicName: topic.name,
              difficulty: 'Medium',
              questionCount: allocated,
              completedCount: 0,
              priority: 50,
              completed: false,
            });
            remainingSlots -= allocated;
          }
        }
      }
    }

    // 5. PRIORITY 5: MINI MOCK DRILL
    if (remainingSlots >= 5) {
      const mockSlots = remainingSlots;
      planItems.push({
        type: 'MINI_MOCK',
        title: 'Tier-1 Mini Mock Sprint',
        questionCount: mockSlots,
        completedCount: 0,
        priority: 40,
        completed: false,
      });
      remainingSlots = 0;
    } else if (remainingSlots > 0 && planItems.length > 0) {
      // Absorb 1-4 leftover questions into first practice task
      const firstTask = planItems.find((it) => it.type !== 'REVISION') || planItems[0];
      firstTask.questionCount = (firstTask.questionCount || 0) + remainingSlots;
      remainingSlots = 0;
    }
  }

  // Sort plan items deterministically by priority descending
  planItems.sort((a, b) => (b.priority || 0) - (a.priority || 0));

  const totalQuestions = planItems.reduce((sum, item) => sum + (item.questionCount || 0), 0);
  const estimatedMinutes = Math.round(totalQuestions * 1.2);

  const plan = await DailyStudyPlan.findOneAndUpdate(
    planQuery,
    {
      userId: normalizedUserId,
      examId: examObjId,
      dateKey,
      goalQuestions: totalQuestions,
      completedQuestions: 0,
      status: 'NOT_STARTED',
      estimatedMinutes,
      items: planItems,
    },
    { upsert: true, returnDocument: 'after' }
  );

  if (!plan) {
    throw new Error('FAILED_TO_GENERATE_PLAN');
  }

  return plan;
}

/**
 * Returns today's active study plan, auto-generating if not yet created.
 */
export async function getTodayPlan(
  userId: string,
  examId?: string
): Promise<IDailyStudyPlan> {
  const normalizedUserId = userId?.trim() || 'guest_default';
  const dateKey = getTodayDateKey();
  const examObjId = await resolveExamObjectId(examId);

  const planQuery: any = { userId: normalizedUserId, dateKey };
  if (examObjId) planQuery.examId = examObjId;

  const existing = await DailyStudyPlan.findOne(planQuery);
  if (existing) {
    return existing;
  }

  return generateDailyPlan(normalizedUserId, 35, false, examId);
}

/**
 * Formats daily study plan progress for API responses.
 */
export async function getPlanProgress(
  userId: string,
  examId?: string
): Promise<PlanProgressSummary> {
  const plan = await getTodayPlan(userId, examId);
  const remainingQuestions = Math.max(0, plan.goalQuestions - plan.completedQuestions);
  const progressPercent =
    plan.goalQuestions > 0
      ? Math.round((plan.completedQuestions / plan.goalQuestions) * 100)
      : 0;

  const itemsSummary = plan.items.map((item) => {
    const rem = Math.max(0, item.questionCount - item.completedCount);
    return {
      id: item._id.toString(),
      type: item.type,
      title: item.title,
      subjectId: item.subjectId ? item.subjectId.toString() : undefined,
      subjectName: item.subjectName,
      topicId: item.topicId ? item.topicId.toString() : undefined,
      topicName: item.topicName,
      difficulty: item.difficulty,
      questionCount: item.questionCount,
      completedCount: item.completedCount,
      remainingCount: rem,
      completed: item.completed,
    };
  });

  return {
    date: plan.dateKey,
    goalQuestions: plan.goalQuestions,
    completedQuestions: plan.completedQuestions,
    remainingQuestions,
    progressPercent,
    estimatedMinutes: plan.estimatedMinutes,
    status: plan.status,
    items: itemsSummary,
  };
}

/**
 * Starts the daily study plan (transitions status to IN_PROGRESS).
 */
export async function startDailyPlan(userId: string) {
  const plan = await getTodayPlan(userId);
  if (plan.status === 'NOT_STARTED') {
    plan.status = 'IN_PROGRESS';
    await plan.save();
  }

  const nextItem = plan.items.find((it) => !it.completed) || plan.items[0];

  return {
    plan,
    nextItem,
  };
}

/**
 * Records completion of questions towards a specific study plan item.
 */
export async function completePlanItem(
  userId: string,
  itemId: string,
  answeredCount: number = 1
) {
  const plan = await getTodayPlan(userId);
  const targetItem = plan.items.id(itemId);

  if (!targetItem) {
    throw new Error('PLAN_ITEM_NOT_FOUND');
  }

  const addedCount = Math.max(1, Number(answeredCount) || 1);
  targetItem.completedCount += addedCount;

  if (targetItem.completedCount >= targetItem.questionCount) {
    targetItem.completed = true;
    targetItem.completedCount = targetItem.questionCount;
  }

  // Recalculate total completed questions across all plan items
  plan.completedQuestions = plan.items.reduce((sum, it) => sum + it.completedCount, 0);

  const allCompleted = plan.items.every((it) => it.completed);
  if (allCompleted || plan.completedQuestions >= plan.goalQuestions) {
    plan.status = 'COMPLETED';
    plan.completedQuestions = plan.goalQuestions;
  } else {
    plan.status = 'IN_PROGRESS';
  }

  await plan.save();

  if (plan.status === 'COMPLETED') {
    try {
      await recordDailyGoalCompletion(userId, plan.dateKey);
    } catch (streakErr) {
      console.warn('Failed to update streak upon plan completion:', streakErr);
    }
  }

  const nextItem = plan.items.find((it) => !it.completed) || null;

  return {
    plan,
    updatedItem: targetItem,
    nextItem,
  };
}

/**
 * Updates the user's daily study goal (20, 35, 50 questions) and rescales the plan.
 */
export async function updateDailyGoal(userId: string, goalQuestions: number) {
  const validGoal = [20, 35, 50].includes(Number(goalQuestions)) ? Number(goalQuestions) : 35;
  return generateDailyPlan(userId, validGoal, true);
}
