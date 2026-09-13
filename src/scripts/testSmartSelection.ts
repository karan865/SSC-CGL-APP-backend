import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { selectPracticeQuestions } from '../services/questionSelectionService';
import { Question } from '../models/Question';
import { Subject } from '../models/Subject';
import { Topic } from '../models/Topic';
import { QuestionAttempt } from '../models/QuestionAttempt';

dotenv.config();

async function runSmartSelectionTests() {
  console.log('====================================================');
  console.log('🧪 SMART QUESTION SELECTION & ANTI-REPETITION SUITE');
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

  const userA = `guest_test_A_${Date.now()}`;
  const userB = `guest_test_B_${Date.now()}`;

  try {
    // -------------------------------------------------------------
    // SETUP: Find a valid active subject and topic with sufficient questions
    // -------------------------------------------------------------
    const subject = await Subject.findOne({ isActive: true });
    assert(Boolean(subject), 'Found active subject for testing');

    const topic = await Topic.findOne({ subjectId: subject!._id, isActive: true });
    assert(Boolean(topic), 'Found active topic for testing');

    const eligibleEasyQuestions = await Question.find({
      subjectId: subject!._id,
      topicId: topic!._id,
      difficulty: 'Easy',
      isActive: true,
    });
    assert(eligibleEasyQuestions.length >= 6, `Found ${eligibleEasyQuestions.length} eligible Easy questions in topic`);

    // Clean any pre-existing test attempts for our test users
    await QuestionAttempt.deleteMany({ userId: { $in: [userA, userB] } });

    // -------------------------------------------------------------
    // TEST 1: ALL UNSEEN QUESTIONS (First-time user)
    // -------------------------------------------------------------
    console.log('\n--- 1. Case 1: All Unseen Questions (0 Previous Attempts) ---');
    const res1 = await selectPracticeQuestions({
      userId: userA,
      subjectId: subject!._id.toString(),
      topicId: topic!._id.toString(),
      difficulty: 'Easy',
      count: 5,
    });

    assert(res1.success === true, 'Selection returned success');
    assert(res1.questions.length === 5, 'Returned exactly 5 requested questions');
    assert(res1.unseenCount === 5, 'All 5 questions are marked as unseen');
    assert(res1.reviewCount === 0, 'Review count is 0');
    assert(res1.selectionInfo?.unseenCount === 5, 'selectionInfo contains unseenCount = 5');
    assert(res1.selectionInfo?.reviewCount === 0, 'selectionInfo contains reviewCount = 0');

    // -------------------------------------------------------------
    // TEST 2: SECURITY PROJECTION (No correctAnswer / explanation leakage)
    // -------------------------------------------------------------
    console.log('\n--- 2. Security Projection Verification ---');
    for (const q of res1.questions) {
      assert(q.correctAnswer === undefined, 'Security: correctAnswer is not leaked');
      assert(q.explanation === undefined, 'Security: explanation is not leaked');
      assert(Boolean(q.questionText), 'Question has questionText');
      assert(Boolean(q.optionA), 'Question has optionA');
    }

    // -------------------------------------------------------------
    // TEST 3: RECORD ATTEMPTS AND TEST CASE 2 (Some Unseen Available)
    // -------------------------------------------------------------
    console.log('\n--- 3. Case 2: Some Unseen Available (Prioritizes Unseen) ---');
    // User A attempts 2 questions from the pool
    const q1 = eligibleEasyQuestions[0];
    const q2 = eligibleEasyQuestions[1];

    await QuestionAttempt.create({
      userId: userA,
      questionId: q1._id,
      subjectId: subject!._id,
      topicId: topic!._id,
      selectedAnswer: q1.correctAnswer,
      correctAnswer: q1.correctAnswer,
      isCorrect: true,
      marks: 1,
      difficulty: 'Easy',
      source: 'PRACTICE',
      attemptedAt: new Date(),
    });

    await QuestionAttempt.create({
      userId: userA,
      questionId: q2._id,
      subjectId: subject!._id,
      topicId: topic!._id,
      selectedAnswer: q2.correctAnswer,
      correctAnswer: q2.correctAnswer,
      isCorrect: true,
      marks: 1,
      difficulty: 'Easy',
      source: 'PRACTICE',
      attemptedAt: new Date(),
    });

    // Request 3 questions for User A. Since pool has >= 6 and 2 are seen, at least 4 are unseen.
    const res2 = await selectPracticeQuestions({
      userId: userA,
      subjectId: subject!._id.toString(),
      topicId: topic!._id.toString(),
      difficulty: 'Easy',
      count: 3,
    });

    assert(res2.success === true, 'Selection returned success');
    assert(res2.questions.length === 3, 'Returned exactly 3 questions');
    assert(res2.unseenCount === 3, 'All 3 questions were sampled from unseen pool');
    assert(res2.reviewCount === 0, 'Review count is 0');

    // Verify none of the returned questions are q1 or q2
    const returnedIdsRes2 = res2.questions.map((q) => q._id.toString());
    assert(!returnedIdsRes2.includes(q1._id.toString()), 'Attempted Q1 was excluded from unseen selection');
    assert(!returnedIdsRes2.includes(q2._id.toString()), 'Attempted Q2 was excluded from unseen selection');

    // -------------------------------------------------------------
    // TEST 4: CASE 3 — NOT ENOUGH UNSEEN (Graceful Fallback)
    // -------------------------------------------------------------
    console.log('\n--- 4. Case 3: Insufficient Unseen Questions (Graceful Fallback) ---');
    // Let's mark all eligible questions except 2 as attempted for User A
    for (let i = 2; i < eligibleEasyQuestions.length - 2; i++) {
      await QuestionAttempt.create({
        userId: userA,
        questionId: eligibleEasyQuestions[i]._id,
        subjectId: subject!._id,
        topicId: topic!._id,
        selectedAnswer: eligibleEasyQuestions[i].correctAnswer,
        correctAnswer: eligibleEasyQuestions[i].correctAnswer,
        isCorrect: true,
        marks: 1,
        difficulty: 'Easy',
        source: 'PRACTICE',
        attemptedAt: new Date(),
      });
    }

    // Now there are exactly 2 unseen questions left, and the rest are attempted.
    // If we request 5 questions: it should return 2 unseen + 3 revision questions = 5 total.
    const res3 = await selectPracticeQuestions({
      userId: userA,
      subjectId: subject!._id.toString(),
      topicId: topic!._id.toString(),
      difficulty: 'Easy',
      count: 5,
    });

    assert(res3.success === true, 'Selection returned success with fallback');
    assert(res3.questions.length === 5, 'Returned exactly 5 questions');
    assert(res3.unseenCount === 2, 'unseenCount is exactly 2');
    assert(res3.reviewCount === 3, 'reviewCount is exactly 3');

    // Verify zero duplicates within the returned session
    const uniqueIdsRes3 = new Set(res3.questions.map((q) => q._id.toString()));
    assert(uniqueIdsRes3.size === 5, 'Zero duplicates in combined unseen + review set');

    // -------------------------------------------------------------
    // TEST 5: CASE 4 — NO UNSEEN QUESTIONS (Full Revision Mode)
    // -------------------------------------------------------------
    console.log('\n--- 5. Case 4: No Unseen Questions (Full Revision Mode) ---');
    // Mark the last 2 remaining questions as attempted
    for (let i = eligibleEasyQuestions.length - 2; i < eligibleEasyQuestions.length; i++) {
      await QuestionAttempt.create({
        userId: userA,
        questionId: eligibleEasyQuestions[i]._id,
        subjectId: subject!._id,
        topicId: topic!._id,
        selectedAnswer: eligibleEasyQuestions[i].correctAnswer,
        correctAnswer: eligibleEasyQuestions[i].correctAnswer,
        isCorrect: true,
        marks: 1,
        difficulty: 'Easy',
        source: 'PRACTICE',
        attemptedAt: new Date(),
      });
    }

    // Now User A has attempted ALL eligible questions in this topic/difficulty
    const res4 = await selectPracticeQuestions({
      userId: userA,
      subjectId: subject!._id.toString(),
      topicId: topic!._id.toString(),
      difficulty: 'Easy',
      count: 5,
    });

    assert(res4.success === true, 'Selection returned success in 100% revision mode');
    assert(res4.questions.length === 5, 'Returned 5 questions from revision pool');
    assert(res4.unseenCount === 0, 'unseenCount is 0');
    assert(res4.reviewCount === 5, 'reviewCount is 5');

    const uniqueIdsRes4 = new Set(res4.questions.map((q) => q._id.toString()));
    assert(uniqueIdsRes4.size === 5, 'Zero duplicate question IDs in revision mode');

    // -------------------------------------------------------------
    // TEST 6: CASE 5 — INSUFFICIENT TOTAL INVENTORY
    // -------------------------------------------------------------
    console.log('\n--- 6. Case 5: Insufficient Total Inventory ---');
    const res5 = await selectPracticeQuestions({
      userId: userA,
      subjectId: subject!._id.toString(),
      topicId: topic!._id.toString(),
      difficulty: 'Easy',
      count: 999, // Way more than exists
    });

    assert(res5.success === false, 'Returns success = false when bank has fewer than requested');
    assert(res5.required === 999, 'Reflects requested count');
    assert(res5.available === eligibleEasyQuestions.length, 'Reflects actual available count in bank');
    assert(res5.questions.length === 0, 'Returns empty question array on insufficient inventory');

    // -------------------------------------------------------------
    // TEST 7: CASE 6 — REPEATED ATTEMPTS (Q1 Attempted 5 times)
    // -------------------------------------------------------------
    console.log('\n--- 7. Case 6: Repeated Attempts on Same Question ---');
    const repeatedUser = `guest_repeated_${Date.now()}`;
    // Attempt Q1 5 times, Q2 3 times
    for (let i = 0; i < 5; i++) {
      await QuestionAttempt.create({
        userId: repeatedUser,
        questionId: q1._id,
        subjectId: subject!._id,
        topicId: topic!._id,
        selectedAnswer: q1.correctAnswer,
        correctAnswer: q1.correctAnswer,
        isCorrect: true,
        marks: 1,
        difficulty: 'Easy',
        source: 'PRACTICE',
        attemptedAt: new Date(Date.now() - (i + 1) * 10000),
      });
    }
    for (let i = 0; i < 3; i++) {
      await QuestionAttempt.create({
        userId: repeatedUser,
        questionId: q2._id,
        subjectId: subject!._id,
        topicId: topic!._id,
        selectedAnswer: q2.correctAnswer,
        correctAnswer: q2.correctAnswer,
        isCorrect: true,
        marks: 1,
        difficulty: 'Easy',
        source: 'PRACTICE',
        attemptedAt: new Date(Date.now() - (i + 1) * 10000),
      });
    }

    const res6 = await selectPracticeQuestions({
      userId: repeatedUser,
      subjectId: subject!._id.toString(),
      topicId: topic!._id.toString(),
      difficulty: 'Easy',
      count: 4,
    });

    assert(res6.success === true, 'Repeated attempts user selection succeeded');
    const returnedIdsRes6 = res6.questions.map((q) => q._id.toString());
    assert(!returnedIdsRes6.includes(q1._id.toString()), 'Multi-attempt Q1 is treated as seen and excluded');
    assert(!returnedIdsRes6.includes(q2._id.toString()), 'Multi-attempt Q2 is treated as seen and excluded');

    // -------------------------------------------------------------
    // TEST 8: CASE 7 — USER ISOLATION (User A vs User B)
    // -------------------------------------------------------------
    console.log('\n--- 8. Case 7: User Isolation (Seen for A, Unseen for B) ---');
    // User B has 0 attempts on this topic
    const res7 = await selectPracticeQuestions({
      userId: userB,
      subjectId: subject!._id.toString(),
      topicId: topic!._id.toString(),
      difficulty: 'Easy',
      count: 5,
    });

    assert(res7.success === true, 'User B query succeeded');
    assert(res7.unseenCount === 5, 'User B has all 5 questions as unseen despite User A having attempted all');
    assert(res7.reviewCount === 0, 'User B review count is 0');

    // -------------------------------------------------------------
    // TEST 9: CASE 8 — DIFFICULTY ISOLATION
    // -------------------------------------------------------------
    console.log('\n--- 9. Case 8: Difficulty Isolation ---');
    // Find a Medium question in the same topic
    const mediumQuestion = await Question.findOne({
      subjectId: subject!._id,
      topicId: topic!._id,
      difficulty: 'Medium',
      isActive: true,
    });

    if (mediumQuestion) {
      // User A has attempted all Easy questions, but 0 Medium questions
      const res8 = await selectPracticeQuestions({
        userId: userA,
        subjectId: subject!._id.toString(),
        topicId: topic!._id.toString(),
        difficulty: 'Medium',
        count: 5,
      });

      if (res8.success) {
        assert(res8.unseenCount === 5, 'Easy attempts do not mark Medium questions as seen');
      } else {
        console.log('  ℹ️ Note: Not enough Medium questions in database for 5-question test');
      }
    }

    // Clean up test attempts
    await QuestionAttempt.deleteMany({ userId: { $in: [userA, userB, repeatedUser] } });

    console.log('\n====================================================');
    console.log(`🎉 ALL ${passed}/${total} AUTOMATED SELECTION TESTS PASSED!`);
    console.log('====================================================\n');
  } finally {
    await mongoose.disconnect();
  }
}

runSmartSelectionTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
