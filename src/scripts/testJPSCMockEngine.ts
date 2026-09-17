import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

import { Exam } from '../models/Exam';
import { ExamStage } from '../models/ExamStage';
import { ExamPaper } from '../models/ExamPaper';
import { Question } from '../models/Question';
import { MockTestSession } from '../models/MockTestSession';
import * as mockService from '../services/mockTestService';

async function runMockEngineTests() {
  console.log('====================================================');
  console.log('🚀 RUNNING JPSC & SSC MULTI-EXAM MOCK ENGINE TEST SUITE');
  console.log('====================================================\n');

  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/ssc-cgl-app';
  await mongoose.connect(mongoUri);
  console.log(' Connected to MongoDB Atlas');

  const jpscExam = await Exam.findOne({ slug: 'jpsc' });
  const sscExam = await Exam.findOne({ slug: 'ssc-cgl' });
  if (!jpscExam || !sscExam) {
    throw new Error('Missing JPSC or SSC Exam record in database.');
  }

  const jpscPrelims = await ExamStage.findOne({ examId: jpscExam._id, slug: 'prelims' });
  const sscTier1 = await ExamStage.findOne({ examId: sscExam._id, slug: 'tier-1' });
  if (!jpscPrelims || !sscTier1) {
    throw new Error('Missing Prelims or Tier-1 stage records.');
  }

  const paper1 = await ExamPaper.findOne({ stageId: jpscPrelims._id, slug: 'paper-1' });
  const paper2 = await ExamPaper.findOne({ stageId: jpscPrelims._id, slug: 'paper-2' });
  const sscTier1Paper = await ExamPaper.findOne({ stageId: sscTier1._id, slug: 'tier-1' });

  if (!paper1 || !paper2 || !sscTier1Paper) {
    throw new Error(`Missing ExamPaper records: p1=${!!paper1}, p2=${!!paper2}, ssc=${!!sscTier1Paper}`);
  }

  console.log(`Resolved Papers:
  - JPSC Paper 1: ${paper1._id} (${paper1.name})
  - JPSC Paper 2: ${paper2._id} (${paper2.name})
  - SSC Tier-1:   ${sscTier1Paper._id} (${sscTier1Paper.name})\n`);

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition: boolean, testName: string, extraInfo?: string) {
    totalTests++;
    if (condition) {
      console.log(` PASS: ${testName}`);
      passedTests++;
    } else {
      console.error(` FAIL: ${testName}`);
      if (extraInfo) console.error(`   Details: ${extraInfo}`);
    }
  }

  const createdSessionIds: string[] = [];

  try {
    // -------------------------------------------------------------
    // TEST 1: JPSC Paper I Mock Generation & Cross-Exam Isolation
    // -------------------------------------------------------------
    console.log('--- Test 1: JPSC Paper I Mock Generation & Isolation ---');
    const p1Mock = await mockService.startMockTest(
      'FULL',
      jpscExam._id.toString(),
      jpscPrelims._id.toString(),
      paper1._id.toString()
    );
    createdSessionIds.push(p1Mock.sessionId);

    assert(p1Mock.totalQuestions === 100, 'JPSC Paper I mock must contain exactly 100 questions', `Got: ${p1Mock.totalQuestions}`);
    assert(p1Mock.totalDurationMinutes === 120, 'JPSC Paper I duration must be 120 minutes', `Got: ${p1Mock.totalDurationMinutes}`);
    assert(p1Mock.scoringConfig?.correctMarks === 2 && p1Mock.scoringConfig?.wrongMarks === 0, 'JPSC Paper I scoring must be +2 / 0', JSON.stringify(p1Mock.scoringConfig));

    // Verify questions isolation in Paper I session
    const p1Session = await MockTestSession.findOne({ sessionId: p1Mock.sessionId });
    const p1QuestionIds: mongoose.Types.ObjectId[] = [];
    p1Session!.sections.forEach((s) => p1QuestionIds.push(...s.questionIds));
    const p1DbQuestions = await Question.find({ _id: { $in: p1QuestionIds } });

    const sscInP1 = p1DbQuestions.filter((q) => q.examId?.toString() === sscExam._id.toString());
    const p2InP1 = p1DbQuestions.filter((q) => q.paperId?.toString() === paper2._id.toString());
    const validP1 = p1DbQuestions.filter((q) => q.examId?.toString() === jpscExam._id.toString() && q.paperId?.toString() === paper1._id.toString());

    assert(sscInP1.length === 0, 'Zero SSC questions in JPSC Paper I mock', `Found: ${sscInP1.length}`);
    assert(p2InP1.length === 0, 'Zero JPSC Paper II questions in JPSC Paper I mock', `Found: ${p2InP1.length}`);
    assert(validP1.length === 100, 'All 100 questions belong strictly to JPSC Paper I', `Found: ${validP1.length}`);

    // -------------------------------------------------------------
    // TEST 2: JPSC Paper II Mock Generation & Cross-Exam Isolation
    // -------------------------------------------------------------
    console.log('\n--- Test 2: JPSC Paper II Mock Generation & Isolation ---');
    const p2Mock = await mockService.startMockTest(
      'FULL',
      jpscExam._id.toString(),
      jpscPrelims._id.toString(),
      paper2._id.toString()
    );
    createdSessionIds.push(p2Mock.sessionId);

    assert(p2Mock.totalQuestions === 100, 'JPSC Paper II mock must contain exactly 100 questions', `Got: ${p2Mock.totalQuestions}`);
    assert(p2Mock.totalDurationMinutes === 120, 'JPSC Paper II duration must be 120 minutes', `Got: ${p2Mock.totalDurationMinutes}`);
    assert(p2Mock.scoringConfig?.correctMarks === 2 && p2Mock.scoringConfig?.wrongMarks === 0, 'JPSC Paper II scoring must be +2 / 0', JSON.stringify(p2Mock.scoringConfig));

    const p2Session = await MockTestSession.findOne({ sessionId: p2Mock.sessionId });
    const p2QuestionIds: mongoose.Types.ObjectId[] = [];
    p2Session!.sections.forEach((s) => p2QuestionIds.push(...s.questionIds));
    const p2DbQuestions = await Question.find({ _id: { $in: p2QuestionIds } });

    const sscInP2 = p2DbQuestions.filter((q) => q.examId?.toString() === sscExam._id.toString());
    const p1InP2 = p2DbQuestions.filter((q) => q.paperId?.toString() === paper1._id.toString());
    const validP2 = p2DbQuestions.filter((q) => q.examId?.toString() === jpscExam._id.toString() && q.paperId?.toString() === paper2._id.toString());

    assert(sscInP2.length === 0, 'Zero SSC questions in JPSC Paper II mock', `Found: ${sscInP2.length}`);
    assert(p1InP2.length === 0, 'Zero JPSC Paper I questions in JPSC Paper II mock', `Found: ${p1InP2.length}`);
    assert(validP2.length === 100, 'All 100 questions belong strictly to JPSC Paper II', `Found: ${validP2.length}`);

    // -------------------------------------------------------------
    // TEST 3: SSC CGL Tier-1 Mock Isolation & Format Preservation
    // -------------------------------------------------------------
    console.log('\n--- Test 3: SSC CGL Tier-1 Mock Isolation & Format Preservation ---');
    const sscMock = await mockService.startMockTest(
      'TIER_1',
      sscExam._id.toString(),
      sscTier1._id.toString(),
      sscTier1Paper._id.toString()
    );
    createdSessionIds.push(sscMock.sessionId);

    assert(sscMock.totalQuestions === 100, 'SSC Tier-1 mock must contain exactly 100 questions', `Got: ${sscMock.totalQuestions}`);
    assert(sscMock.totalDurationMinutes === 60, 'SSC Tier-1 duration must be 60 minutes', `Got: ${sscMock.totalDurationMinutes}`);
    assert(sscMock.scoringConfig?.correctMarks === 2 && sscMock.scoringConfig?.wrongMarks === 0.5, 'SSC Tier-1 scoring must remain +2 / -0.50', JSON.stringify(sscMock.scoringConfig));
    assert(sscMock.sections.length === 4, 'SSC Tier-1 mock must have 4 sections', `Got: ${sscMock.sections.length}`);

    const sscSession = await MockTestSession.findOne({ sessionId: sscMock.sessionId });
    const sscQuestionIds: mongoose.Types.ObjectId[] = [];
    sscSession!.sections.forEach((s) => sscQuestionIds.push(...s.questionIds));
    const sscDbQuestions = await Question.find({ _id: { $in: sscQuestionIds } });

    const jpscInSsc = sscDbQuestions.filter((q) => q.examId?.toString() === jpscExam._id.toString());
    assert(jpscInSsc.length === 0, 'Zero JPSC questions in SSC Tier-1 mock', `Found: ${jpscInSsc.length}`);

    // -------------------------------------------------------------
    // TEST 4: Question Security (No correctAnswer or explanation in start payload)
    // -------------------------------------------------------------
    console.log('\n--- Test 4: Question Security in Active Mock Payloads ---');
    let hasLeakedAnswerOrExplanation = false;
    for (const q of p1Mock.questions) {
      if ((q as any).correctAnswer !== undefined || (q as any).explanation !== undefined) {
        hasLeakedAnswerOrExplanation = true;
      }
    }
    assert(!hasLeakedAnswerOrExplanation, 'Mock payload NEVER leaks correctAnswer or explanation to client');

    // -------------------------------------------------------------
    // TEST 5: JPSC Scoring Engine (+2 / 0 / 0, Max 200)
    // -------------------------------------------------------------
    console.log('\n--- Test 5: JPSC Scoring Engine (+2 / 0 / 0) ---');
    // Scenario A: 80 Correct, 20 Wrong -> Score should be exactly 160, Max 200
    const p1QuestionsWithAnswers = await Question.find({ _id: { $in: p1QuestionIds } });
    const answerMap = new Map(p1QuestionsWithAnswers.map((q) => [q._id.toString(), q.correctAnswer]));

    // Answer 80 correct, 20 wrong
    for (let i = 0; i < p1QuestionIds.length; i++) {
      const qId = p1QuestionIds[i].toString();
      const correctAns = answerMap.get(qId)!;
      const wrongAns = correctAns === 'A' ? 'B' : 'A';
      const selected = i < 80 ? (correctAns as 'A' | 'B' | 'C' | 'D') : (wrongAns as 'A' | 'B' | 'C' | 'D');

      await mockService.saveMockAnswer(
        p1Session!.sessionId,
        qId,
        selected,
        false
      );
    }

    const p1Result = await mockService.submitMockTest(p1Session!.sessionId, 'test_user_p1');
    assert(p1Result.totalCorrect === 80, 'JPSC: Exactly 80 correct answers recorded', `Got: ${p1Result.totalCorrect}`);
    assert(p1Result.totalWrong === 20, 'JPSC: Exactly 20 wrong answers recorded', `Got: ${p1Result.totalWrong}`);
    assert(p1Result.totalScore === 160, 'JPSC: 80 correct + 20 wrong yields exactly 160 marks (zero penalty)', `Got: ${p1Result.totalScore}`);
    assert(p1Result.maxMarks === 200, 'JPSC: Maximum marks is 200', `Got: ${p1Result.maxMarks}`);
    assert(p1Result.accuracy === 80, 'JPSC: Accuracy is 80%', `Got: ${p1Result.accuracy}`);
    assert(p1Result.sectionResults && p1Result.sectionResults.length > 0, 'JPSC: Subject performance breakdown generated', `Count: ${p1Result.sectionResults?.length}`);

    // Scenario B: 0 Correct, 100 Wrong -> Score should be 0 (cannot be negative)
    const p2QuestionsWithAnswers = await Question.find({ _id: { $in: p2QuestionIds } });
    const p2AnswerMap = new Map(p2QuestionsWithAnswers.map((q) => [q._id.toString(), q.correctAnswer]));

    for (let i = 0; i < p2QuestionIds.length; i++) {
      const qId = p2QuestionIds[i].toString();
      const correctAns = p2AnswerMap.get(qId)!;
      const wrongAns = correctAns === 'A' ? 'B' : 'A';
      await mockService.saveMockAnswer(
        p2Session!.sessionId,
        qId,
        wrongAns as 'A' | 'B' | 'C' | 'D',
        false
      );
    }

    const p2Result = await mockService.submitMockTest(p2Session!.sessionId, 'test_user_p2');
    assert(p2Result.totalCorrect === 0, 'JPSC: 0 correct recorded', `Got: ${p2Result.totalCorrect}`);
    assert(p2Result.totalWrong === 100, 'JPSC: 100 wrong recorded', `Got: ${p2Result.totalWrong}`);
    assert(p2Result.totalScore === 0, 'JPSC: 0 correct + 100 wrong yields exactly 0 marks (not negative)', `Got: ${p2Result.totalScore}`);

    // -------------------------------------------------------------
    // TEST 6: SSC CGL Scoring Preservation (+2 / -0.50, Max 200)
    // -------------------------------------------------------------
    console.log('\n--- Test 6: SSC CGL Tier-1 Scoring Preservation (+2 / -0.50) ---');
    // Scenario: 80 Correct, 20 Wrong -> Score should be (80*2) - (20*0.5) = 160 - 10 = 150
    const sscQuestionsWithAnswers = await Question.find({ _id: { $in: sscQuestionIds } });
    const sscAnswerMap = new Map(sscQuestionsWithAnswers.map((q) => [q._id.toString(), q.correctAnswer]));

    // Unlock all sections in memory/db for answer saving or save section by section
    for (let sIdx = 0; sIdx < sscSession!.sections.length; sIdx++) {
      sscSession!.currentSectionIndex = sIdx;
      await sscSession!.save();

      const sec = sscSession!.sections[sIdx];
      for (let qIdx = 0; qIdx < sec.questionIds.length; qIdx++) {
        const qId = sec.questionIds[qIdx].toString();
        const globalIdx = sIdx * 25 + qIdx;
        const correctAns = sscAnswerMap.get(qId)!;
        const wrongAns = correctAns === 'A' ? 'B' : 'A';
        const selected = globalIdx < 80 ? (correctAns as 'A' | 'B' | 'C' | 'D') : (wrongAns as 'A' | 'B' | 'C' | 'D');

        await mockService.saveMockAnswer(
          sscSession!.sessionId,
          qId,
          selected,
          false
        );
      }
    }

    const sscResult = await mockService.submitMockTest(sscSession!.sessionId, 'test_user_ssc');
    assert(sscResult.totalCorrect === 80, 'SSC: 80 correct answers recorded', `Got: ${sscResult.totalCorrect}`);
    assert(sscResult.totalWrong === 20, 'SSC: 20 wrong answers recorded', `Got: ${sscResult.totalWrong}`);
    assert(sscResult.totalScore === 150, 'SSC: 80 correct (160) - 20 wrong (10) = 150 marks strictly preserved', `Got: ${sscResult.totalScore}`);
    assert(sscResult.maxMarks === 200, 'SSC: Maximum marks is 200', `Got: ${sscResult.maxMarks}`);

    // -------------------------------------------------------------
    // TEST 7: Review Payload Verification (Answers & Explanations present post-submission)
    // -------------------------------------------------------------
    console.log('\n--- Test 7: Post-Submission Review Payload Verification ---');
    const reviewData = await mockService.getMockTestReview(p1Session!.sessionId);
    assert(reviewData.questions.length === 100, 'Review contains all 100 questions', `Got: ${reviewData.questions.length}`);

    const q0 = reviewData.questions[0];
    assert(q0.correctAnswer !== undefined, 'Review question reveals correctAnswer', `Value: ${q0.correctAnswer}`);
    assert(typeof q0.explanation === 'string' && q0.explanation.length > 0, 'Review question provides explanation', q0.explanation?.substring(0, 30));
    assert(q0.marksAwarded === 2, 'Review correctly awards +2 marks for correct answer', `Got: ${q0.marksAwarded}`);

    // Find an incorrect question in review
    const incorrectQ = reviewData.questions.find((q) => q.isCorrect === false);
    assert(incorrectQ !== undefined && incorrectQ.marksAwarded === 0, 'Review awards 0 penalty marks for JPSC incorrect answer', `Got: ${incorrectQ?.marksAwarded}`);

    // -------------------------------------------------------------
    // Clean up test sessions
    // -------------------------------------------------------------
    // Allow any background async tasks to finish
    await new Promise((r) => setTimeout(r, 1000));
    await MockTestSession.deleteMany({ sessionId: { $in: createdSessionIds } });
    console.log('\n Cleaned up test sessions.');
  } catch (err: any) {
    console.error('❌ Test suite failed with exception:', err);
    totalTests++;
  } finally {
    await new Promise((r) => setTimeout(r, 500));
    await mongoose.disconnect();
    console.log(' Disconnected from MongoDB.');
  }

  console.log('\n====================================================');
  console.log(`📊 FINAL SUMMARY: ${passedTests}/${totalTests} TESTS PASSED`);
  console.log('====================================================');

  if (passedTests === totalTests && totalTests > 0) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runMockEngineTests().catch((err) => {
  console.error('Fatal error in mock test runner:', err);
  process.exit(1);
});
