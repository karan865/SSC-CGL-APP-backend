import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { QuestionRevision } from '../models/QuestionRevision';
import { Question } from '../models/Question';
import { QuestionAttempt } from '../models/QuestionAttempt';
import {
  recordMistakeForRevision,
  getRevisionSummary,
  getDueRevisions,
  startRevisionSession,
  processRevisionAnswer,
  getRevisionStats,
  REVISION_INTERVALS_DAYS,
} from '../services/revisionService';
import { evaluateAnswer } from '../services/practiceService';

dotenv.config();

async function runRevisionFlowTests() {
  console.log('====================================================');
  console.log('🧪 SMART REVISION & MISTAKE REVISION ENGINE SUITE');
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

  const userA = `guest_rev_A_${Date.now()}`;
  const userB = `guest_rev_B_${Date.now()}`;

  try {
    // -------------------------------------------------------------
    // SETUP: Find valid active questions to test with
    // -------------------------------------------------------------
    const testQuestions = await Question.find({ isActive: true }).limit(5);
    assert(testQuestions.length >= 3, 'Found at least 3 active questions in bank');

    const [q1, q2, q3] = testQuestions;

    // --- 1. Mistake Creation & Integration with Practice Mode ---
    console.log("\n--- 1. Mistake Creation on Practice Answer ---");
    // Get wrong answer for q1
    const wrongAnswerQ1 = q1.correctAnswer === 'A' ? 'B' : 'A';
    const evalRes = await evaluateAnswer(q1._id.toString(), wrongAnswerQ1, userA);
    assert(evalRes.isCorrect === false, 'Answer correctly marked wrong');

    const revRecord1 = await QuestionRevision.findOne({ userId: userA, questionId: q1._id });
    assert(revRecord1 !== null, 'QuestionRevision automatically created for wrong answer');
    assert(revRecord1?.status === 'SCHEDULED', 'Initial status is SCHEDULED');
    assert(revRecord1?.revisionLevel === 1, 'Initial revisionLevel is 1');
    assert(revRecord1?.wrongRevisionAttempts === 0, 'Initial wrongRevisionAttempts is 0');

    // --- 2. Duplicate Protection (Idempotent Upsert) ---
    console.log("\n--- 2. Duplicate Protection ---");
    await recordMistakeForRevision(userA, q1._id, q1.subjectId, q1.topicId);
    const countQ1 = await QuestionRevision.countDocuments({ userId: userA, questionId: q1._id });
    assert(countQ1 === 1, 'Duplicate wrong attempt does not create duplicate revision rows');

    // --- 3. Spaced Repetition Scheduling Intervals ---
    console.log("\n--- 3. Scheduling Intervals Verification ---");
    assert(REVISION_INTERVALS_DAYS[1] === 1, 'Level 1 interval is 1 day');
    assert(REVISION_INTERVALS_DAYS[2] === 3, 'Level 2 interval is 3 days');
    assert(REVISION_INTERVALS_DAYS[3] === 7, 'Level 3 interval is 7 days');
    assert(REVISION_INTERVALS_DAYS[4] === 14, 'Level 4 interval is 14 days');
    assert(REVISION_INTERVALS_DAYS[5] === 30, 'Level 5 interval is 30 days');

    // --- 4. Correct Revision Answer Advances Level ---
    console.log("\n--- 4. Correct Revision Answer Progression ---");
    // Make q1 due right now by setting nextRevisionAt in the past
    await QuestionRevision.updateOne(
      { userId: userA, questionId: q1._id },
      { $set: { nextRevisionAt: new Date(Date.now() - 3600000) } }
    );

    const revAnswer1 = await processRevisionAnswer(userA, q1._id.toString(), q1.correctAnswer);
    assert(revAnswer1.isCorrect === true, 'Revision answer evaluated as correct');
    assert(revAnswer1.revision.revisionLevel === 2, 'Revision level advanced from 1 to 2');
    assert(revAnswer1.revision.status === 'SCHEDULED', 'Status remains SCHEDULED');

    // Advance from Level 2 to Level 3
    const revAnswer2 = await processRevisionAnswer(userA, q1._id.toString(), q1.correctAnswer);
    assert(revAnswer2.revision.revisionLevel === 3, 'Revision level advanced to 3');

    // Advance from Level 3 to Level 4
    const revAnswer3 = await processRevisionAnswer(userA, q1._id.toString(), q1.correctAnswer);
    assert(revAnswer3.revision.revisionLevel === 4, 'Revision level advanced to 4');

    // Advance from Level 4 to Level 5
    const revAnswer4 = await processRevisionAnswer(userA, q1._id.toString(), q1.correctAnswer);
    assert(revAnswer4.revision.revisionLevel === 5, 'Revision level advanced to 5');

    // --- 5. Mastery Achieved on Level 5 + Correct ---
    console.log("\n--- 5. Mastery State Achieved ---");
    const revAnswerMastery = await processRevisionAnswer(userA, q1._id.toString(), q1.correctAnswer);
    assert(revAnswerMastery.revision.status === 'MASTERED', 'Status changed to MASTERED at Level 5+ correct');

    // Verify mastered question is excluded from due revisions
    const dueAfterMastery = await getDueRevisions(userA, 10);
    const hasMasteredInDue = dueAfterMastery.questions.some((q) => q._id.toString() === q1._id.toString());
    assert(hasMasteredInDue === false, 'Mastered question does not appear in due revisions');

    // --- 6. Mistake Resets Revision Level to 1 ---
    console.log("\n--- 6. Mistake Reset to Level 1 ---");
    // Add q2 and advance to level 3
    await recordMistakeForRevision(userA, q2._id, q2.subjectId, q2.topicId);
    await QuestionRevision.updateOne({ userId: userA, questionId: q2._id }, { $set: { revisionLevel: 3 } });

    const wrongAnswerQ2 = q2.correctAnswer === 'A' ? 'B' : 'A';
    const revAnswerWrong = await processRevisionAnswer(userA, q2._id.toString(), wrongAnswerQ2);
    assert(revAnswerWrong.isCorrect === false, 'Answer marked incorrect');
    assert(revAnswerWrong.revision.revisionLevel === 1, 'Mistake resets revisionLevel to 1');
    assert(revAnswerWrong.revision.status === 'SCHEDULED', 'Status is SCHEDULED');

    // --- 7. Due Query Respects nextRevisionAt <= now ---
    console.log("\n--- 7. Due Query Filtering ---");
    // Set q2 to future date (not due)
    await QuestionRevision.updateOne(
      { userId: userA, questionId: q2._id },
      { $set: { nextRevisionAt: new Date(Date.now() + 86400000) } } // 1 day in future
    );

    let dueCheck = await getDueRevisions(userA, 10);
    const q2InDueFuture = dueCheck.questions.some((q) => q._id.toString() === q2._id.toString());
    assert(q2InDueFuture === false, 'Future scheduled revision is NOT returned in due list');

    // Set q2 to past date (due)
    await QuestionRevision.updateOne(
      { userId: userA, questionId: q2._id },
      { $set: { nextRevisionAt: new Date(Date.now() - 60000) } }
    );

    dueCheck = await getDueRevisions(userA, 10);
    const q2InDuePast = dueCheck.questions.some((q) => q._id.toString() === q2._id.toString());
    assert(q2InDuePast === true, 'Overdue revision IS returned in due list');

    // --- 8. User Isolation ---
    console.log("\n--- 8. User Isolation ---");
    const userBDue = await getDueRevisions(userB, 10);
    assert(userBDue.dueCount === 0, 'User B has 0 due revisions despite User A having due revisions');
    const userBSummary = await getRevisionSummary(userB);
    assert(userBSummary.hasRevision === false, 'User B summary reports hasRevision = false');

    // --- 9. Security Projection Verification ---
    console.log("\n--- 9. Security Projections ---");
    const session = await startRevisionSession(userA, 5);
    assert(session.questions.length > 0, 'Revision session returned questions');
    for (const q of session.questions) {
      assert(q.correctAnswer === undefined, 'Security: correctAnswer is scrubbed before submission');
      assert(q.explanation === undefined, 'Security: explanation is scrubbed before submission');
      assert(typeof q.questionText === 'string', 'Question text is present');
    }

    // Solution revealed after submitting answer
    const submitResp = await processRevisionAnswer(userA, session.questions[0]._id.toString(), 'A');
    assert(typeof submitResp.correctAnswer === 'string', 'Security: correctAnswer provided after answer submission');
    assert(typeof submitResp.explanation === 'string', 'Security: explanation provided after answer submission');

    // --- 10. Summary and Stats Verification ---
    console.log("\n--- 10. Summary and Stats Verification ---");
    // Ensure q3 is scheduled as due
    await recordMistakeForRevision(userA, q3._id, q3.subjectId, q3.topicId);
    await QuestionRevision.updateOne(
      { userId: userA, questionId: q3._id },
      { $set: { nextRevisionAt: new Date(Date.now() - 60000) } }
    );

    const summary = await getRevisionSummary(userA);
    assert(summary.dueCount >= 1, 'Revision summary returns valid dueCount');
    assert(summary.hasRevision === true, 'Revision summary hasRevision is true');
    assert(summary.topicCount >= 1, 'Revision summary returns valid topicCount');

    const stats = await getRevisionStats(userA);
    assert(stats.mastered >= 1, 'Stats reflects at least 1 mastered question');
    assert(stats.totalMistakes >= 2, 'Stats reflects total mistakes recorded');

    console.log('\n====================================================');
    console.log(`🎉 ALL ${passed}/${total} AUTOMATED REVISION TESTS PASSED!`);
    console.log('====================================================\n');
  } finally {
    // Clean up test records
    await QuestionRevision.deleteMany({ userId: { $in: [userA, userB] } });
    await QuestionAttempt.deleteMany({ userId: { $in: [userA, userB] } });
    await mongoose.disconnect();
  }
}

runRevisionFlowTests().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
