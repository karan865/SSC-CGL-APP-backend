import mongoose from 'mongoose';
import dotenv from 'dotenv';
import {
  recordPracticeAttempt,
  recordMockTestAttempts,
  getUserPerformance,
  getRecommendedPractice,
  getTopicPerformance,
  classifyWeaknessStatus,
  calculatePriorityScore,
} from '../services/performanceService';
import { evaluateAnswer } from '../services/practiceService';
import { QuestionAttempt } from '../models/QuestionAttempt';
import { Question } from '../models/Question';
import { Subject } from '../models/Subject';
import { Topic } from '../models/Topic';

dotenv.config();

async function runPerformanceTests() {
  console.log('====================================================');
  console.log('🧪 SSC CGL PERFORMANCE & RECOMMENDATIONS TEST SUITE');
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

  const testUserId = `test_guest_${Date.now()}`;

  try {
    // -------------------------------------------------------------
    // TEST 1: THRESHOLD CLASSIFICATION UNIT TESTS
    // -------------------------------------------------------------
    console.log('--- 1. Weak Topic Threshold Classifier Unit Tests ---');
    assert(classifyWeaknessStatus(40, 2) === 'INSUFFICIENT_DATA', '< 5 attempts returns INSUFFICIENT_DATA');
    assert(classifyWeaknessStatus(40, 5) === 'CRITICAL', '40% with 5 attempts returns CRITICAL');
    assert(classifyWeaknessStatus(49.9, 10) === 'CRITICAL', '49.9% returns CRITICAL');
    assert(classifyWeaknessStatus(50, 10) === 'NEEDS_PRACTICE', '50% returns NEEDS_PRACTICE');
    assert(classifyWeaknessStatus(69.9, 8) === 'NEEDS_PRACTICE', '69.9% returns NEEDS_PRACTICE');
    assert(classifyWeaknessStatus(70, 12) === 'GOOD', '70% returns GOOD');
    assert(classifyWeaknessStatus(84.9, 15) === 'GOOD', '84.9% returns GOOD');
    assert(classifyWeaknessStatus(85, 20) === 'STRONG', '85% returns STRONG');
    assert(classifyWeaknessStatus(95, 30) === 'STRONG', '95% returns STRONG');

    // -------------------------------------------------------------
    // TEST 2: PRIORITY RANKING FORMULA
    // -------------------------------------------------------------
    console.log('\n--- 2. Weak Topic Priority Ranking Formula ---');
    const scoreA = calculatePriorityScore(42, 40); // 40 attempts @ 42%
    const scoreB = calculatePriorityScore(48, 5);  // 5 attempts @ 48%
    assert(scoreA > scoreB, `40 attempts @ 42% (score: ${scoreA}) ranks higher than 5 attempts @ 48% (score: ${scoreB})`);

    // -------------------------------------------------------------
    // TEST 3: PRACTICE ATTEMPT RECORDING & DEDUPLICATION
    // -------------------------------------------------------------
    console.log('\n--- 3. Practice Attempt Recording & Deduplication ---');
    const sampleQuestion = await Question.findOne({ isActive: true });
    assert(Boolean(sampleQuestion), 'Found active question in bank');

    const evalResult = await evaluateAnswer(
      sampleQuestion!._id.toString(),
      sampleQuestion!.correctAnswer,
      testUserId
    );
    assert(evalResult.isCorrect === true, 'Answer evaluated as correct');

    // Give MongoDB write a moment to persist
    await new Promise((r) => setTimeout(r, 200));

    const attemptDoc = await QuestionAttempt.findOne({
      userId: testUserId,
      questionId: sampleQuestion!._id,
    });
    assert(Boolean(attemptDoc), 'Attempt record successfully created in MongoDB');
    assert(attemptDoc?.isCorrect === true, 'Attempt marks isCorrect true');
    assert(attemptDoc?.source === 'PRACTICE', 'Attempt tagged with source PRACTICE');
    assert(attemptDoc?.marks === 1, 'Attempt awarded 1 mark for practice correct');

    // Deduplication test
    const dupAttempt = await recordPracticeAttempt(
      testUserId,
      sampleQuestion!._id.toString(),
      sampleQuestion!.correctAnswer,
      true,
      1
    );
    assert(dupAttempt?._id.toString() === attemptDoc?._id.toString(), 'Deduplication returns existing attempt without duplicate');

    // -------------------------------------------------------------
    // TEST 4: PERFORMANCE AGGREGATION CALCULATIONS
    // -------------------------------------------------------------
    console.log('\n--- 4. Performance Aggregation Calculations ---');
    // Seed a few controlled attempts to verify math
    const qList = await Question.find({ isActive: true }).limit(6);
    assert(qList.length >= 6, 'Found at least 6 questions for math tests');

    // Record 3 correct, 3 wrong across the questions
    for (let i = 0; i < 6; i++) {
      const isCorr = i < 4; // 4 correct, 2 wrong -> 66.7%
      await QuestionAttempt.create({
        userId: testUserId,
        questionId: qList[i]._id,
        subjectId: qList[i].subjectId,
        topicId: qList[i].topicId,
        selectedAnswer: isCorr ? qList[i].correctAnswer : (qList[i].correctAnswer === 'A' ? 'B' : 'A'),
        correctAnswer: qList[i].correctAnswer,
        isCorrect: isCorr,
        marks: isCorr ? 1 : 0,
        difficulty: qList[i].difficulty,
        source: 'PRACTICE',
        attemptedAt: new Date(),
      });
    }

    const performance = await getUserPerformance(testUserId);
    assert(performance.totalAttempted >= 6, `Total attempted recorded (got ${performance.totalAttempted})`);
    assert(performance.totalCorrect >= 4, `Total correct recorded (got ${performance.totalCorrect})`);
    assert(performance.overallAccuracy > 0, `Overall accuracy calculated (${performance.overallAccuracy}%)`);
    assert(performance.subjects.length === 4, 'Includes all 4 canonical SSC CGL subjects');
    assert(Boolean(performance.difficulty.Easy), 'Includes Easy difficulty stats');
    assert(Boolean(performance.difficulty.Medium), 'Includes Medium difficulty stats');
    assert(Boolean(performance.difficulty.Hard), 'Includes Hard difficulty stats');

    // -------------------------------------------------------------
    // TEST 5: PRACTICE RECOMMENDATION ENGINE
    // -------------------------------------------------------------
    console.log('\n--- 5. Practice Recommendation Engine ---');
    const rec = await getRecommendedPractice(testUserId);
    assert(Boolean(rec.topicId), `Recommended topic ID present (${rec.topicId})`);
    assert(Boolean(rec.topicName), `Recommended topic name present (${rec.topicName})`);
    assert(Boolean(rec.subjectName), `Recommended subject name present (${rec.subjectName})`);
    assert(['Easy', 'Medium', 'Hard'].includes(rec.difficulty), `Valid difficulty recommended (${rec.difficulty})`);
    assert(rec.questionCount >= 5, `Question count is at least 5 (got ${rec.questionCount})`);
    assert(rec.availableQuestions >= rec.questionCount, `Verified question inventory availability in DB (${rec.availableQuestions} available >= ${rec.questionCount} required)`);
    assert(rec.reason.length > 5, `Detailed reasoning generated: "${rec.reason}"`);

    // -------------------------------------------------------------
    // TEST 6: TOPIC PERFORMANCE QUERY
    // -------------------------------------------------------------
    console.log('\n--- 6. Single Topic Performance Query ---');
    const topicMetric = await getTopicPerformance(testUserId, rec.topicId);
    assert(Boolean(topicMetric), 'Topic performance fetched successfully');
    assert(topicMetric?.topicId === rec.topicId, 'Topic metric matches requested topic ID');
    assert(Boolean(topicMetric?.difficultyBreakdown), 'Includes difficulty breakdown');

    // -------------------------------------------------------------
    // TEST 7: NEW / EMPTY USER EXPERIENCE (0 ATTEMPTS)
    // -------------------------------------------------------------
    console.log('\n--- 7. New / Empty User Graceful State (0 Attempts) ---');
    const brandNewUser = `new_guest_${Date.now()}`;
    const emptyPerf = await getUserPerformance(brandNewUser);
    assert(emptyPerf.totalAttempted === 0, 'New user has 0 attempted');
    assert(emptyPerf.overallAccuracy === 0, 'New user accuracy is 0');
    assert(emptyPerf.hasEnoughData === false, 'New user hasEnoughData is false');
    assert(emptyPerf.weakTopics.length === 0, 'New user has 0 weak topics');

    const starterRec = await getRecommendedPractice(brandNewUser);
    assert(starterRec.availableQuestions >= 5, `Starter recommendation has sufficient inventory (${starterRec.availableQuestions})`);
    assert(starterRec.topicName === 'Percentage', 'Starter recommendation defaults to core foundation (Percentage)');

    console.log('\n====================================================');
    console.log(`🎉 ALL ${passed}/${total} AUTOMATED PERFORMANCE TESTS PASSED!`);
    console.log('====================================================\n');
  } finally {
    // Clean up test attempts
    await QuestionAttempt.deleteMany({ userId: testUserId });
    await mongoose.disconnect();
  }
}

runPerformanceTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
