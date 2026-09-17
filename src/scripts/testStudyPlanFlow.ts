import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Question } from '../models/Question';
import { Subject } from '../models/Subject';
import { Topic } from '../models/Topic';
import { QuestionAttempt } from '../models/QuestionAttempt';
import { QuestionRevision } from '../models/QuestionRevision';
import { DailyStudyPlan } from '../models/DailyStudyPlan';
import {
  generateDailyPlan,
  getTodayPlan,
  getPlanProgress,
  startDailyPlan,
  completePlanItem,
  updateDailyGoal,
  getTodayDateKey,
} from '../services/dailyStudyPlanService';

dotenv.config();

async function runStudyPlanFlowTests() {
  console.log('====================================================');
  console.log('🧪 DAILY SMART STUDY PLAN ENGINE SUITE');
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

  const userNew = `guest_plan_new_${Date.now()}`;
  const userExperienced = `guest_plan_exp_${Date.now()}`;
  const userB = `guest_plan_B_${Date.now()}`;

  try {
    // -------------------------------------------------------------
    // SETUP: Fetch subjects, topics, and questions
    // -------------------------------------------------------------
    const subjects = await Subject.find({ isActive: true });
    assert(subjects.length >= 4, 'Found at least 4 active SSC CGL subjects');

    const topics = await Topic.find({ isActive: true });
    assert(topics.length >= 4, 'Found at least 4 active topics');

    const questions = await Question.find({ isActive: true }).limit(20);
    assert(questions.length >= 10, 'Found questions in question bank');

    // -------------------------------------------------------------
    // 1. New User: Starter Plan (< 5 attempts)
    // -------------------------------------------------------------
    console.log('\n--- 1. New User: Starter Plan (< 5 attempts) ---');
    const newPlan = await generateDailyPlan(userNew, 20);
    assert(newPlan !== null, 'Starter plan created successfully');
    assert(newPlan.goalQuestions === 20, 'Goal questions is 20 for starter plan');
    assert(newPlan.status === 'NOT_STARTED', 'Initial status is NOT_STARTED');
    assert(newPlan.items.length >= 1, 'Starter plan has practice items');
    assert(
      newPlan.items.every((it) => it.type === 'BALANCED_PRACTICE' || it.type === 'RECOMMENDED'),
      'Starter plan items are balanced/recommended practices across subjects'
    );
    assert(
      newPlan.items.reduce((acc, it) => acc + it.questionCount, 0) <= 20,
      'Total item question count matches or does not exceed requested goal'
    );

    // -------------------------------------------------------------
    // 2. Plan Stability: Same user + same day returns identical plan
    // -------------------------------------------------------------
    console.log('\n--- 2. Plan Stability (Idempotent per day) ---');
    const retrievedToday = await getTodayPlan(userNew);
    assert(retrievedToday._id.toString() === newPlan._id.toString(), 'getTodayPlan returns existing plan');
    assert(retrievedToday.dateKey === getTodayDateKey(), 'DateKey is correct today key');
    
    // Generating again on the same day must not create a duplicate row
    const regenerated = await generateDailyPlan(userNew, 20);
    assert(regenerated._id.toString() === newPlan._id.toString(), 'generateDailyPlan returns existing plan on same day');
    const countPlansNew = await DailyStudyPlan.countDocuments({ userId: userNew, dateKey: getTodayDateKey() });
    assert(countPlansNew === 1, 'Only one canonical plan exists per user per day');

    // -------------------------------------------------------------
    // 3. Setup Experienced User Performance Data
    // -------------------------------------------------------------
    console.log('\n--- 3. Experienced User: Setup Performance & Due Revisions ---');
    const weakTopic = topics[0];
    const strongTopic = topics[1];

    // Seed 10 attempts on weak topic: 2 correct, 8 incorrect (20% accuracy -> CRITICAL WEAK)
    const weakQuestions = await Question.find({ topicId: weakTopic._id, isActive: true }).limit(8);
    for (let i = 0; i < weakQuestions.length; i++) {
      const q = weakQuestions[i];
      const isCorrect = i < 2;
      const selected = isCorrect ? q.correctAnswer : (q.correctAnswer === 'A' ? 'B' : 'A');
      await QuestionAttempt.create({
        userId: userExperienced,
        questionId: q._id,
        subjectId: q.subjectId,
        topicId: q.topicId,
        selectedAnswer: selected,
        correctAnswer: q.correctAnswer,
        isCorrect,
        marks: isCorrect ? 1 : 0,
        difficulty: q.difficulty || 'Medium',
        source: 'PRACTICE',
        attemptedAt: new Date(),
      });
    }

    // Seed 2 due revision items for userExperienced
    const revQ1 = questions[0];
    const revQ2 = questions[1];
    await QuestionRevision.create({
      userId: userExperienced,
      questionId: revQ1._id,
      subjectId: revQ1.subjectId,
      topicId: revQ1.topicId,
      revisionLevel: 1,
      status: 'SCHEDULED',
      nextRevisionAt: new Date(Date.now() - 3600000), // Due 1 hour ago
      wrongRevisionAttempts: 0,
      totalRevisionAttempts: 0,
    });
    await QuestionRevision.create({
      userId: userExperienced,
      questionId: revQ2._id,
      subjectId: revQ2.subjectId,
      topicId: revQ2.topicId,
      revisionLevel: 2,
      status: 'SCHEDULED',
      nextRevisionAt: new Date(Date.now() - 7200000), // Due 2 hours ago
      wrongRevisionAttempts: 0,
      totalRevisionAttempts: 1,
    });

    // -------------------------------------------------------------
    // 4. Experienced User Plan: Revision & Weak Topic Prioritization
    // -------------------------------------------------------------
    console.log('\n--- 4. Experienced User: Plan Generation & Priority Ordering ---');
    const expPlan = await generateDailyPlan(userExperienced, 35);
    assert(expPlan !== null, 'Experienced user plan generated');
    assert(expPlan.items.length > 0, 'Plan has items');

    // Due revision should be priority 100 and appear first
    const firstItem = expPlan.items[0];
    assert(firstItem.type === 'REVISION', 'Revision is prioritized as Item #1 when due revisions exist');
    assert(firstItem.priority === 100, 'Revision priority score is 100');
    assert(firstItem.questionCount === 2, 'Revision item questionCount matches due revision inventory (2)');

    // Weak topic item should follow revision
    const weakItem = expPlan.items.find((it) => it.type === 'WEAK_TOPIC');
    assert(weakItem !== undefined, 'Plan includes a WEAK_TOPIC item');
    assert(
      weakItem?.priority === 90 || weakItem?.priority === 75,
      'Weak topic priority is 90 (critical) or 75 (needs practice)'
    );
    assert(weakItem?.topicId?.toString() === weakTopic._id.toString(), 'Weak topic matches seeded weak topic');

    // -------------------------------------------------------------
    // 5. Inventory-Aware Redistribution
    // -------------------------------------------------------------
    console.log('\n--- 5. Inventory-Aware Allocation Check ---');
    // Total allocated questions must not exceed what's available
    const totalAllocated = expPlan.items.reduce((sum, it) => sum + it.questionCount, 0);
    assert(totalAllocated <= 35, `Total allocated questions (${totalAllocated}) is <= goal (35)`);
    assert(totalAllocated > 0, 'Total allocated questions is greater than 0');

    // -------------------------------------------------------------
    // 6. User Isolation
    // -------------------------------------------------------------
    console.log('\n--- 6. User Isolation ---');
    const userBPlan = await generateDailyPlan(userB, 20);
    assert(userBPlan.userId === userB, 'User B receives their own distinct plan');
    assert(userBPlan._id.toString() !== expPlan._id.toString(), 'User B plan ID is distinct from Experienced User');
    assert(userBPlan.items.every((it) => it.type !== 'REVISION'), 'User B has no revisions because User B has no due items');

    // -------------------------------------------------------------
    // 7. Plan Lifecycle & Progress Tracking (0/35 -> 10/35 -> 35/35)
    // -------------------------------------------------------------
    console.log('\n--- 7. Plan Lifecycle: Start, Progress, and Item Completion ---');
    const startedResult = await startDailyPlan(userExperienced);
    assert(startedResult.plan.status === 'IN_PROGRESS', 'Plan status updated to IN_PROGRESS upon starting');
    assert(startedResult.nextItem !== undefined, 'Next item returned on starting plan');

    const progressInitial = await getPlanProgress(userExperienced);
    assert(progressInitial.completedQuestions === 0, 'Initial completed questions is 0');
    assert(progressInitial.progressPercent === 0, 'Initial progressPercent is 0');

    // Complete the revision item partially: 1 of 2 questions
    const revItemId = firstItem._id.toString();
    const partialRev = await completePlanItem(userExperienced, revItemId, 1);
    const updatedRevItem1 = partialRev.plan.items.find((it) => it._id.toString() === revItemId);
    assert(updatedRevItem1?.completedCount === 1, 'Revision item completedCount updated to 1');
    assert(updatedRevItem1?.completed === false, 'Revision item is not yet marked completed (1/2)');
    assert(partialRev.plan.completedQuestions === 1, 'Plan completedQuestions incremented to 1');

    // Complete the rest of revision item (1 more question -> 2/2)
    const completedRev = await completePlanItem(userExperienced, revItemId, 1);
    const updatedRevItem2 = completedRev.plan.items.find((it) => it._id.toString() === revItemId);
    assert(updatedRevItem2?.completedCount === 2, 'Revision item completedCount reached 2');
    assert(updatedRevItem2?.completed === true, 'Revision item marked completed === true');

    // Complete all remaining items
    let currentPlan = completedRev.plan;
    for (const item of currentPlan.items) {
      if (!item.completed) {
        const needed = item.questionCount - item.completedCount;
        const res = await completePlanItem(userExperienced, item._id.toString(), needed);
        currentPlan = res.plan;
      }
    }

    assert(currentPlan.status === 'COMPLETED', 'When all items are finished, plan status becomes COMPLETED');
    assert(
      currentPlan.completedQuestions >= currentPlan.items.reduce((s, it) => s + it.questionCount, 0),
      'Completed questions matches sum of item question counts'
    );

    const progressFinal = await getPlanProgress(userExperienced);
    assert(progressFinal.status === 'COMPLETED', 'Progress reports COMPLETED status');
    assert(progressFinal.progressPercent === 100, 'Progress reports 100%');
    assert(progressFinal.remainingQuestions === 0, 'Remaining questions is 0');

    // -------------------------------------------------------------
    // 8. Goal Adjustment (updateDailyGoal)
    // -------------------------------------------------------------
    console.log('\n--- 8. Goal Adjustment (20, 35, 50) ---');
    // Test on new user whose plan is NOT_STARTED
    const plan20to50 = await updateDailyGoal(userNew, 50);
    assert(plan20to50.goalQuestions === 50, 'Goal successfully updated to 50');

    const plan50to35 = await updateDailyGoal(userNew, 35);
    assert(plan50to35.goalQuestions === 35, 'Goal successfully updated to 35');

    const plan35to20 = await updateDailyGoal(userNew, 20);
    assert(plan35to20.goalQuestions === 20, 'Goal successfully updated to 20');

    // -------------------------------------------------------------
    // 9. Cleanup Test Data
    // -------------------------------------------------------------
    console.log('\n--- 9. Cleanup Isolated Test Data ---');
    await DailyStudyPlan.deleteMany({ userId: { $in: [userNew, userExperienced, userB] } });
    await QuestionAttempt.deleteMany({ userId: { $in: [userNew, userExperienced, userB] } });
    await QuestionRevision.deleteMany({ userId: { $in: [userNew, userExperienced, userB] } });
    console.log('Cleaned up test plans, attempts, and revisions.\n');

    console.log('====================================================');
    console.log(`🎉 ALL ${passed}/${total} STUDY PLAN TESTS PASSED!`);
    console.log('====================================================\n');
  } catch (error) {
    console.error('Test execution failed:', error);
    // Cleanup on failure
    await DailyStudyPlan.deleteMany({ userId: { $in: [userNew, userExperienced, userB] } });
    await QuestionAttempt.deleteMany({ userId: { $in: [userNew, userExperienced, userB] } });
    await QuestionRevision.deleteMany({ userId: { $in: [userNew, userExperienced, userB] } });
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

runStudyPlanFlowTests();
