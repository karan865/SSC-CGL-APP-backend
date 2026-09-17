import mongoose from 'mongoose';
import dotenv from 'dotenv';
import {
  startMockTest,
  saveMockAnswer,
  advanceMockSection,
  submitMockTest,
  getMockTestReview,
  getMarkedQuestions,
} from '../services/mockTestService';
import { generatePracticeTest, evaluateAnswer } from '../services/practiceService';
import { Subject } from '../models/Subject';
import { Topic } from '../models/Topic';

dotenv.config();

async function runTests() {
  console.log('====================================================');
  console.log('🧪 SSC CGL MOCK TEST ENGINE & REGRESSION TEST SUITE');
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

  try {
    // -------------------------------------------------------------
    // TEST 1: REGRESSION CHECK ON PRACTICE MODE
    // -------------------------------------------------------------
    console.log('--- 1. Practice Mode Regression Verification ---');
    const quantSub = await Subject.findOne({ slug: 'quantitative-aptitude' });
    const percentTopic = await Topic.findOne({ subjectId: quantSub?._id, slug: 'percentage' });

    assert(Boolean(quantSub && percentTopic), 'Found canonical subject and topic for practice regression');

    const practiceRes = await generatePracticeTest(
      quantSub!._id.toString(),
      percentTopic!._id.toString(),
      'Easy',
      5
    );

    assert(practiceRes.success && Boolean(practiceRes.questions), 'Practice test generated successfully');
    assert(practiceRes.questions!.length === 5, 'Practice test has exactly 5 questions');
    assert(
      (practiceRes.questions![0] as any).correctAnswer === undefined,
      'Practice questions strictly exclude correctAnswer'
    );
    assert(
      (practiceRes.questions![0] as any).explanation === undefined,
      'Practice questions strictly exclude explanation'
    );

    // Test instant evaluation in Practice Mode (+1 for correct, 0 for wrong, no negative marking)
    const practiceQId = practiceRes.questions![0]._id.toString();
    const evalA = await evaluateAnswer(practiceQId, 'A');
    assert(typeof evalA.isCorrect === 'boolean', 'Practice answer evaluation returns boolean isCorrect');
    assert(evalA.marks === (evalA.isCorrect ? 1 : 0), 'Practice mode awards +1 for correct and 0 for wrong (no negative marking)');
    assert(Boolean(evalA.explanation), 'Practice mode returns instant step-by-step explanation');

    // -------------------------------------------------------------
    // TEST 2: MOCK TEST CREATION & SPECIFICATION
    // -------------------------------------------------------------
    console.log('\n--- 2. Mock Test Creation & Specification (100 Questions) ---');
    const mock = await startMockTest('TIER_1');

    assert(Boolean(mock.sessionId), 'Session ID generated');
    assert(mock.totalQuestions === 100, `Total questions is exactly 100 (got ${mock.totalQuestions})`);
    assert(mock.sections.length === 4, 'Exactly 4 sections generated');
    assert(mock.totalDurationMinutes === 60, 'Total duration is 60 minutes');
    assert(mock.currentSectionIndex === 0, 'Starts at section index 0 (Reasoning)');

    // Verify 25 questions per section
    for (let i = 0; i < 4; i++) {
      const secQs = mock.questions.filter((q) => q.sectionIndex === i);
      assert(secQs.length === 25, `Section ${i} (${mock.sections[i].name}) has exactly 25 questions`);
      assert(mock.sections[i].durationMinutes === 15, `Section ${i} has 15 minutes sectional timer`);
    }

    // Verify 0 duplicate questions across the entire 100 questions
    const uniqueQIds = new Set(mock.questions.map((q) => q._id));
    assert(uniqueQIds.size === 100, 'All 100 questions in mock test are completely unique');

    // Verify strict security projection (NO correctAnswer, NO explanation)
    const leaksAnswer = mock.questions.some((q) => (q as any).correctAnswer !== undefined);
    const leaksExplanation = mock.questions.some((q) => (q as any).explanation !== undefined);
    assert(!leaksAnswer, 'SECURITY: Zero questions leak correctAnswer in mock creation payload');
    assert(!leaksExplanation, 'SECURITY: Zero questions leak explanation in mock creation payload');

    // -------------------------------------------------------------
    // TEST 3: ANSWER SUBMISSION & REVIEW TOGGLING
    // -------------------------------------------------------------
    console.log('\n--- 3. Answering & Review Toggling ---');
    const sec0Qs = mock.questions.filter((q) => q.sectionIndex === 0);
    const q1 = sec0Qs[0];
    const q2 = sec0Qs[1];

    // Answer Q1 with 'B'
    const ans1 = await saveMockAnswer(mock.sessionId, q1._id, 'B', false);
    assert(ans1.success && ans1.selectedAnswer === 'B', 'Answer saved successfully for active section');
    assert((ans1 as any).correctAnswer === undefined, 'SECURITY: Answer endpoint does not reveal correctAnswer');
    assert((ans1 as any).explanation === undefined, 'SECURITY: Answer endpoint does not reveal explanation');

    // Update Q1 answer to 'C' and mark for review
    const ans1Update = await saveMockAnswer(mock.sessionId, q1._id, 'C', true);
    assert(ans1Update.selectedAnswer === 'C', 'Answer updated successfully to C');
    assert(ans1Update.isMarkedForReview === true, 'Marked for review toggled to true');

    // Mark Q2 for review without selecting an answer
    const ans2Review = await saveMockAnswer(mock.sessionId, q2._id, null, true);
    assert(ans2Review.selectedAnswer === null, 'Question marked for review with null answer (unanswered)');
    assert(ans2Review.isMarkedForReview === true, 'Review flag successfully recorded');

    // Attempt answering question from section 1 while in section 0 (should fail)
    const sec1Qs = mock.questions.filter((q) => q.sectionIndex === 1);
    let sec1AnswerError = '';
    try {
      await saveMockAnswer(mock.sessionId, sec1Qs[0]._id, 'A', false);
    } catch (err: any) {
      sec1AnswerError = err.message;
    }
    assert(
      sec1AnswerError === 'QUESTION_IN_UPCOMING_SECTION',
      'Cannot answer question from upcoming section before advancing'
    );

    // -------------------------------------------------------------
    // TEST 4: SECTION ADVANCEMENT & LOCKING
    // -------------------------------------------------------------
    console.log('\n--- 4. Section Advancement & Auto-Locking ---');
    const adv1 = await advanceMockSection(mock.sessionId, 0);
    assert(adv1.currentSectionIndex === 1, 'Advanced from section 0 to section 1');
    assert(adv1.sections[0].isLocked === true, 'Section 0 is now locked');

    // Attempt modifying question from locked section 0 (must be rejected!)
    let lockedSecError = '';
    try {
      await saveMockAnswer(mock.sessionId, q1._id, 'D', false);
    } catch (err: any) {
      lockedSecError = err.message;
    }
    assert(
      lockedSecError === 'QUESTION_IN_LOCKED_SECTION',
      'Modifying question in locked section is strictly rejected'
    );

    // Answer in newly active section 1 works
    const ansSec1 = await saveMockAnswer(mock.sessionId, sec1Qs[0]._id, 'A', false);
    assert(ansSec1.success, 'Successfully answered question in newly unlocked section 1');

    // Advance sections 1 -> 2 -> 3
    await advanceMockSection(mock.sessionId, 1);
    await advanceMockSection(mock.sessionId, 2);

    // -------------------------------------------------------------
    // TEST 5: SUBMISSION & OFFICIAL TIER-1 SCORING (+2 / -0.50)
    // -------------------------------------------------------------
    console.log('\n--- 5. Submission & Official Tier-1 Scoring ---');
    const score = await submitMockTest(mock.sessionId);

    assert(score.totalQuestions === 100, 'Scorecard reflects 100 total questions');
    assert(score.maxMarks === 200, 'Maximum marks is exactly 200');
    assert(score.sectionResults.length === 4, 'Includes 4 section breakdown results');

    const calculatedMarks = Number((score.totalCorrect * 2 - score.totalWrong * 0.5).toFixed(2));
    assert(
      score.totalScore === calculatedMarks,
      `Official marking verified: (${score.totalCorrect} * 2) - (${score.totalWrong} * 0.5) = ${score.totalScore}`
    );
    assert(
      score.totalCorrect + score.totalWrong + score.totalUnanswered === 100,
      'Correct + Wrong + Unanswered equals 100'
    );

    // Test idempotent submission
    const resubmitScore = await submitMockTest(mock.sessionId);
    assert(resubmitScore.totalScore === score.totalScore, 'Duplicate submission is completely idempotent');

    // -------------------------------------------------------------
    // TEST 6: POST-TEST REVIEW ENDPOINT
    // -------------------------------------------------------------
    console.log('\n--- 6. Post-Test Review Endpoint ---');
    const review = await getMockTestReview(mock.sessionId);

    assert(review.questions.length === 100, 'Post-exam review returns all 100 questions');
    assert(Boolean(review.questions[0].correctAnswer), 'Review includes correctAnswer');
    assert(Boolean(review.questions[0].explanation), 'Review includes step-by-step explanation');
    assert(typeof review.questions[0].isCorrect === 'boolean', 'Review includes correctness evaluation');
    assert(
      review.questions[0].marksAwarded === 2 ||
        review.questions[0].marksAwarded === -0.5 ||
        review.questions[0].marksAwarded === 0,
      'Review accurately displays marks awarded (+2, -0.50, or 0)'
    );

    // -------------------------------------------------------------
    // TEST 7: MARKED QUESTIONS QUERY ENDPOINT
    // -------------------------------------------------------------
    console.log('\n--- 7. Marked Questions Query Endpoint ---');
    const markedResult = await getMarkedQuestions(mock.sessionId);
    assert(markedResult.totalMarked >= 2, `Marked questions retrieved (got ${markedResult.totalMarked})`);
    assert(
      markedResult.questions.every((q) => q.isMarkedForReview === true),
      'All returned items are marked for review'
    );
    assert(Boolean(markedResult.questions[0].questionText), 'Marked question has questionText');
    assert(Boolean(markedResult.questions[0].explanation), 'Marked question has full explanation');

    const globalMarked = await getMarkedQuestions();
    assert(globalMarked.totalMarked >= 2, 'Global latest marked query returns valid list');


    console.log('\n====================================================');
    console.log(`🎉 ALL ${passed}/${total} AUTOMATED TESTS PASSED!`);
    console.log('====================================================\n');
  } finally {
    await mongoose.disconnect();
  }
}

runTests().catch((err) => {
  console.error('❌ Test suite failed:', err);
  process.exit(1);
});
