import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { StudyStreak } from '../models/StudyStreak';
import { DailyStudyPlan } from '../models/DailyStudyPlan';
import {
  calculateStreakUpdate,
  getYesterdayDateKey,
  getStudyStreak,
  recordDailyGoalCompletion,
} from '../services/studyStreakService';
import {
  getTodayPlan,
  completePlanItem,
  getTodayDateKey,
} from '../services/dailyStudyPlanService';

dotenv.config();

async function runStreakFlowTests() {
  console.log('====================================================');
  console.log('🧪 SIMPLE STUDY STREAK + DAILY GOAL ENGINE SUITE');
  console.log('====================================================\n');

  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is not defined in environment');
  }

  console.log('Connecting to MongoDB Atlas...');
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✅ Connected to MongoDB successfully.\n');

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, testName: string) {
    total++;
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${testName}`);
      throw new Error(`Assertion failed: ${testName}`);
    }
  }

  const userA = `guest_streak_A_${Date.now()}`;
  const userB = `guest_streak_B_${Date.now()}`;
  const userPlan = `guest_streak_plan_${Date.now()}`;

  try {
    // =============================================================
    // SUITE 1: Pure Streak Calculation Logic
    // =============================================================
    console.log('--- SUITE 1: Pure Streak Calculation Logic ---');

    // Case 1: First completion (current: 0 -> 1, longest: 0 -> 1)
    const firstCalc = calculateStreakUpdate(
      null,
      0,
      0,
      0,
      '2026-09-06'
    );
    assert(firstCalc.currentStreak === 1, 'First completion: currentStreak becomes 1');
    assert(firstCalc.longestStreak === 1, 'First completion: longestStreak becomes 1');
    assert(firstCalc.totalCompletedDays === 1, 'First completion: totalCompletedDays becomes 1');
    assert(firstCalc.lastCompletedDate === '2026-09-06', 'First completion: lastCompletedDate set to today');

    // Case 2: Consecutive day completion (2026-09-05 -> 2026-09-06)
    const consecutiveCalc = calculateStreakUpdate(
      '2026-09-05',
      7,
      12,
      20,
      '2026-09-06'
    );
    assert(consecutiveCalc.currentStreak === 8, 'Consecutive day: currentStreak 7 -> 8');
    assert(consecutiveCalc.longestStreak === 12, 'Consecutive day: longestStreak remains 12');
    assert(consecutiveCalc.totalCompletedDays === 21, 'Consecutive day: totalCompletedDays 20 -> 21');

    // Case 2b: Consecutive day exceeding longest streak
    const newRecordCalc = calculateStreakUpdate(
      '2026-09-05',
      12,
      12,
      30,
      '2026-09-06'
    );
    assert(newRecordCalc.currentStreak === 13, 'Consecutive new record: currentStreak 12 -> 13');
    assert(newRecordCalc.longestStreak === 13, 'Consecutive new record: longestStreak becomes 13');

    // Case 3: Missed day reset (e.g. last completed 2026-09-03, today 2026-09-06)
    const missedDayCalc = calculateStreakUpdate(
      '2026-09-03',
      7,
      12,
      20,
      '2026-09-06'
    );
    assert(missedDayCalc.currentStreak === 1, 'Missed day: currentStreak resets to 1');
    assert(missedDayCalc.longestStreak === 12, 'Missed day: longestStreak preserved at 12');
    assert(missedDayCalc.totalCompletedDays === 21, 'Missed day: totalCompletedDays increments to 21');

    // Case 4: Same-day duplicate completion
    const sameDayCalc = calculateStreakUpdate(
      '2026-09-06',
      8,
      12,
      21,
      '2026-09-06'
    );
    assert(sameDayCalc.currentStreak === 8, 'Same day duplicate: currentStreak stays 8');
    assert(sameDayCalc.longestStreak === 12, 'Same day duplicate: longestStreak stays 12');
    assert(sameDayCalc.totalCompletedDays === 21, 'Same day duplicate: totalCompletedDays stays 21');

    // Date helper test: getYesterdayDateKey
    assert(getYesterdayDateKey('2026-09-06') === '2026-09-05', 'Yesterday of 2026-09-06 is 2026-09-05');
    assert(getYesterdayDateKey('2026-03-01') === '2026-02-28', 'Yesterday across non-leap month boundary is correct');
    assert(getYesterdayDateKey('2024-03-01') === '2024-02-29', 'Yesterday across leap year February is correct');

    // =============================================================
    // SUITE 2: Service Layer & Database Operations
    // =============================================================
    console.log('\n--- SUITE 2: Service Layer & Database Operations ---');

    // New user initial state
    const initialStatusA = await getStudyStreak(userA);
    assert(initialStatusA.currentStreak === 0, 'New user starts with currentStreak = 0');
    assert(initialStatusA.longestStreak === 0, 'New user starts with longestStreak = 0');
    assert(initialStatusA.totalCompletedDays === 0, 'New user starts with totalCompletedDays = 0');
    assert(initialStatusA.todayCompleted === false, 'New user starts with todayCompleted = false');

    // Multiple fetches do not alter state (Case 5)
    const secondFetchA = await getStudyStreak(userA);
    assert(secondFetchA.currentStreak === 0, 'Subsequent fetch does not alter currentStreak');
    assert(secondFetchA.totalCompletedDays === 0, 'Subsequent fetch does not alter totalCompletedDays');

    // User A completes today's goal
    const today = getTodayDateKey();
    const completeA1 = await recordDailyGoalCompletion(userA, today);
    assert(completeA1.currentStreak === 1, 'User A completed today: currentStreak = 1');
    assert(completeA1.longestStreak === 1, 'User A completed today: longestStreak = 1');
    assert(completeA1.totalCompletedDays === 1, 'User A completed today: totalCompletedDays = 1');
    assert(completeA1.todayCompleted === true, 'User A todayCompleted is true');

    // Duplicate completion on same day (Case 4)
    const completeA2 = await recordDailyGoalCompletion(userA, today);
    assert(completeA2.currentStreak === 1, 'Duplicate same-day call does NOT increment currentStreak');
    assert(completeA2.totalCompletedDays === 1, 'Duplicate same-day call does NOT increment totalCompletedDays');

    // Reopen app check (Case 10)
    const reopenedStatusA = await getStudyStreak(userA);
    assert(reopenedStatusA.todayCompleted === true, 'Reopening app preserves todayCompleted = true');
    assert(reopenedStatusA.currentStreak === 1, 'Reopening app preserves currentStreak = 1');

    // User Isolation (Case 9)
    const initialStatusB = await getStudyStreak(userB);
    assert(initialStatusB.currentStreak === 0, 'User B is unaffected by User A: currentStreak = 0');
    assert(initialStatusB.totalCompletedDays === 0, 'User B is unaffected by User A: totalCompletedDays = 0');
    assert(initialStatusB.todayCompleted === false, 'User B todayCompleted is false');

    // Simulate streak progression for User B:
    // Yesterday completed
    const yesterday = getYesterdayDateKey(today);
    await StudyStreak.create({
      userId: userB,
      currentStreak: 5,
      longestStreak: 10,
      lastCompletedDate: yesterday,
      totalCompletedDays: 15,
    });

    const preCompleteB = await getStudyStreak(userB);
    assert(preCompleteB.currentStreak === 5, 'User B completed yesterday, streak active at 5 before today');
    assert(preCompleteB.todayCompleted === false, 'User B todayCompleted is false before completing today');

    // Complete today for User B -> consecutive streak 5 -> 6
    const postCompleteB = await recordDailyGoalCompletion(userB, today);
    assert(postCompleteB.currentStreak === 6, 'User B consecutive day completion: 5 -> 6');
    assert(postCompleteB.longestStreak === 10, 'User B longestStreak preserved at 10');
    assert(postCompleteB.totalCompletedDays === 16, 'User B totalCompletedDays 15 -> 16');

    // =============================================================
    // SUITE 3: Integration with Daily Study Plan
    // =============================================================
    console.log('\n--- SUITE 3: Integration with Daily Study Plan ---');

    // Generate today's plan for userPlan
    const plan = await getTodayPlan(userPlan);
    assert(plan.status === 'NOT_STARTED', 'Plan starts in NOT_STARTED status');
    assert(plan.completedQuestions === 0, 'Plan starts with 0 completed questions');

    // Check streak before completing plan
    const prePlanStreak = await getStudyStreak(userPlan);
    assert(prePlanStreak.todayCompleted === false, 'Streak reports todayCompleted = false while plan NOT_STARTED');

    // Case 7: Partial completion does not complete streak
    const firstItem = plan.items[0];
    await completePlanItem(userPlan, firstItem._id.toString(), 1);
    const midPlan = await getTodayPlan(userPlan);
    assert(midPlan.status === 'IN_PROGRESS', 'Plan is IN_PROGRESS after partial completion');
    assert(midPlan.completedQuestions < midPlan.goalQuestions, 'Plan completedQuestions < goalQuestions');

    const midStreak = await getStudyStreak(userPlan);
    assert(midStreak.todayCompleted === false, 'Streak is NOT completed after partial plan progress');
    assert(midStreak.currentStreak === 0, 'Streak remains 0 after partial plan progress');

    // Case 8: Complete remaining plan items across sessions to reach goal
    let currentPlan = midPlan;
    for (const item of currentPlan.items) {
      if (!item.completed) {
        const needed = item.questionCount - item.completedCount;
        const res = await completePlanItem(userPlan, item._id.toString(), needed);
        currentPlan = res.plan;
      }
    }

    const completedPlan = await getTodayPlan(userPlan);
    assert(completedPlan.status === 'COMPLETED', 'Plan status transitioned to COMPLETED');
    assert(completedPlan.completedQuestions >= completedPlan.goalQuestions, 'Plan completedQuestions reached goalQuestions');

    // Verify streak automatically incremented via completePlanItem hook
    const finalStreak = await getStudyStreak(userPlan);
    assert(finalStreak.todayCompleted === true, 'Streak automatically completed upon plan completion');
    assert(finalStreak.currentStreak === 1, 'Plan completion incremented currentStreak to 1');
    assert(finalStreak.totalCompletedDays === 1, 'Plan completion incremented totalCompletedDays to 1');

    console.log('\n====================================================');
    console.log(`🎉 ALL ${passed}/${total} STREAK & DAILY GOAL TESTS PASSED!`);
    console.log('====================================================\n');
  } finally {
    // Cleanup test records
    console.log('Cleaning up test documents...');
    await StudyStreak.deleteMany({ userId: { $in: [userA, userB, userPlan] } });
    await DailyStudyPlan.deleteMany({ userId: { $in: [userA, userB, userPlan] } });
    await mongoose.disconnect();
    console.log('MongoDB disconnected.');
  }
}

runStreakFlowTests().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});
