import http from 'http';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import app from '../app';
import { Exam } from '../models/Exam';
import { ExamStage } from '../models/ExamStage';
import { ExamPaper } from '../models/ExamPaper';
import { Subject } from '../models/Subject';
import { Topic } from '../models/Topic';
import { Question } from '../models/Question';
import { QuestionAttempt } from '../models/QuestionAttempt';
import { QuestionRevision } from '../models/QuestionRevision';
import { DailyStudyPlan } from '../models/DailyStudyPlan';
import { MockTestSession } from '../models/MockTestSession';

dotenv.config();

async function runMultiExamApiTests() {
  console.log('====================================================');
  console.log('🧪 PHASE 3: MULTI-EXAM BACKEND APIS & FILTERS TEST');
  console.log('====================================================\n');

  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is not defined in environment');
  }

  console.log('Connecting to MongoDB Atlas...');
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✅ Connected to MongoDB successfully.\n');

  // Start ephemeral HTTP server for Express app
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as any;
  const baseUrl = `http://localhost:${address.port}/api`;
  console.log(`Express server listening on ${baseUrl}\n`);

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

  const testUser = `guest_phase3_${Date.now()}`;

  try {
    // -------------------------------------------------------------
    // TASK 3.1: GET /api/exams
    // -------------------------------------------------------------
    console.log('--- 1. TASK 3.1: GET /api/exams ---');
    const resExams = await fetch(`${baseUrl}/exams`);
    const dataExams = await resExams.json();
    assert(resExams.status === 200, 'GET /api/exams returns HTTP 200');
    assert(dataExams.success === true, 'Response payload has success: true');
    assert(Array.isArray(dataExams.data), 'data is an array');
    assert(dataExams.data.length >= 1, 'Contains at least 1 active exam');

    const sscExam = dataExams.data.find((e: any) => e.slug === 'ssc-cgl');
    assert(!!sscExam, 'Found SSC CGL exam with slug "ssc-cgl"');
    assert(sscExam.name === 'SSC CGL', 'Exam name is "SSC CGL"');

    // -------------------------------------------------------------
    // TASK 3.2: GET /api/exams/:examId/stages
    // -------------------------------------------------------------
    console.log('\n--- 2. TASK 3.2: GET /api/exams/:examId/stages ---');
    // Test with slug
    const resStagesSlug = await fetch(`${baseUrl}/exams/ssc-cgl/stages`);
    const dataStagesSlug = await resStagesSlug.json();
    assert(resStagesSlug.status === 200, 'GET /api/exams/ssc-cgl/stages returns HTTP 200');
    assert(dataStagesSlug.success === true, 'Response payload has success: true');
    assert(dataStagesSlug.data.length >= 1, 'Found at least 1 stage for ssc-cgl');
    const tier1Stage = dataStagesSlug.data.find((s: any) => s.slug === 'tier-1');
    assert(!!tier1Stage, 'Found stage with slug "tier-1"');

    // Test with ObjectId
    const resStagesId = await fetch(`${baseUrl}/exams/${sscExam._id}/stages`);
    const dataStagesId = await resStagesId.json();
    assert(resStagesId.status === 200, 'GET /api/exams/:objectId/stages returns HTTP 200');
    assert(dataStagesId.data.length === dataStagesSlug.data.length, 'Stage count matches between slug and ObjectId');

    // Test non-existent exam
    const resStages404 = await fetch(`${baseUrl}/exams/non-existent-exam/stages`);
    assert(resStages404.status === 404, 'Non-existent exam returns HTTP 404');

    // -------------------------------------------------------------
    // TASK 3.3: GET /api/stages/:stageId/papers & /api/exams/:examId/stages/:stageId/papers
    // -------------------------------------------------------------
    console.log('\n--- 3. TASK 3.3: GET /api/stages/:stageId/papers ---');
    // Test /api/stages/:stageId/papers with slug
    const resPapersSlug = await fetch(`${baseUrl}/stages/tier-1/papers`);
    const dataPapersSlug = await resPapersSlug.json();
    assert(resPapersSlug.status === 200, 'GET /api/stages/tier-1/papers returns HTTP 200');
    assert(dataPapersSlug.data.length >= 1, 'Found at least 1 paper for tier-1 stage');
    const tier1Paper = dataPapersSlug.data.find((p: any) => p.slug === 'tier-1');
    assert(!!tier1Paper, 'Found paper with slug "tier-1"');
    assert(tier1Paper.scoring?.correctMarks === 2, 'Paper scoring.correctMarks is 2');
    assert(Math.abs(tier1Paper.scoring?.wrongMarks) === 0.5, 'Paper scoring.wrongMarks is 0.5 (deduction)');

    // Test /api/stages/:stageId/papers with ObjectId
    const resPapersId = await fetch(`${baseUrl}/stages/${tier1Stage._id}/papers`);
    const dataPapersId = await resPapersId.json();
    assert(resPapersId.status === 200, 'GET /api/stages/:objectId/papers returns HTTP 200');
    assert(dataPapersId.data.length === dataPapersSlug.data.length, 'Paper count matches between slug and ObjectId');

    // Test nested /api/exams/:examId/stages/:stageId/papers
    const resNestedPapers = await fetch(`${baseUrl}/exams/ssc-cgl/stages/tier-1/papers`);
    assert(resNestedPapers.status === 200, 'Nested /api/exams/:examId/stages/:stageId/papers returns HTTP 200');

    // -------------------------------------------------------------
    // TASK 3.4: GET /api/papers/:paperId/subjects & GET /api/subjects
    // -------------------------------------------------------------
    console.log('\n--- 4. TASK 3.4: GET /api/papers/:paperId/subjects & GET /api/subjects ---');
    const resPaperSubjects = await fetch(`${baseUrl}/papers/${tier1Paper._id}/subjects`);
    const dataPaperSubjects = await resPaperSubjects.json();
    assert(resPaperSubjects.status === 200, 'GET /api/papers/:paperId/subjects returns HTTP 200');
    assert(dataPaperSubjects.data.length === 4, 'Paper has exactly 4 SSC subjects linked');

    // Backward compatibility test: GET /api/subjects without query params returns active subjects
    const resAllSubjects = await fetch(`${baseUrl}/subjects`);
    const dataAllSubjects = await resAllSubjects.json();
    assert(resAllSubjects.status === 200, 'GET /api/subjects returns HTTP 200');
    assert(dataAllSubjects.data.length >= 4, 'Returns subjects without parameters');

    // Filter test: GET /api/subjects?examId=...
    const resFilteredSubjects = await fetch(`${baseUrl}/subjects?examId=${sscExam._id}`);
    const dataFilteredSubjects = await resFilteredSubjects.json();
    assert(dataFilteredSubjects.data.length >= 4, 'GET /api/subjects?examId=... returns subjects');

    // Filter test: GET /api/subjects?examId=nonexistent
    const fakeExamId = new mongoose.Types.ObjectId().toString();
    const resEmptySubjects = await fetch(`${baseUrl}/subjects?examId=${fakeExamId}`);
    const dataEmptySubjects = await resEmptySubjects.json();
    assert(dataEmptySubjects.data.length === 0, 'GET /api/subjects with foreign examId returns 0 subjects');

    // -------------------------------------------------------------
    // TASK 3.5: GET /api/subjects/:subjectId/topics
    // -------------------------------------------------------------
    console.log('\n--- 5. TASK 3.5: GET /api/subjects/:subjectId/topics ---');
    const testSubject = dataAllSubjects.data[0];
    const resTopics = await fetch(`${baseUrl}/subjects/${testSubject._id}/topics`);
    const dataTopics = await resTopics.json();
    assert(resTopics.status === 200, 'GET /api/subjects/:subjectId/topics returns HTTP 200');
    assert(dataTopics.data.length >= 1, 'Subject has topics');

    // With examId filter
    const resTopicsFiltered = await fetch(`${baseUrl}/subjects/${testSubject._id}/topics?examId=${sscExam._id}`);
    const dataTopicsFiltered = await resTopicsFiltered.json();
    assert(resTopicsFiltered.status === 200, 'GET /api/subjects/:subjectId/topics with examId filter returns HTTP 200');
    assert(dataTopicsFiltered.data.length === dataTopics.data.length, 'Topic count matches when scoped to SSC');

    const testTopic = dataTopics.data[0];

    // -------------------------------------------------------------
    // TASK 3.6: Practice API with examId scoping
    // -------------------------------------------------------------
    console.log('\n--- 6. TASK 3.6: Practice API (Start & Answer with exam context) ---');
    const resPracticeStart = await fetch(`${baseUrl}/practice/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: testUser,
        subjectId: testSubject._id,
        topicId: testTopic._id,
        difficulty: 'Easy',
        count: 5,
        examId: sscExam._id,
      }),
    });
    const dataPracticeStart = await resPracticeStart.json();
    assert(resPracticeStart.status === 200, 'POST /api/practice/start with examId returns HTTP 200');
    assert(dataPracticeStart.data.questions.length === 5, 'Returned 5 questions');

    // Answer a question and verify QuestionAttempt has examId
    const firstQ = dataPracticeStart.data.questions[0];
    const resAnswer = await fetch(`${baseUrl}/practice/answer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: testUser,
        questionId: firstQ._id,
        selectedAnswer: 'A',
      }),
    });
    const dataAnswer = await resAnswer.json();
    assert(resAnswer.status === 200, 'POST /api/practice/answer returns HTTP 200');
    assert(typeof dataAnswer.data.isCorrect === 'boolean', 'Answer evaluation succeeded');

    // Verify QuestionAttempt saved in database has examId
    const savedAttempt = await QuestionAttempt.findOne({ userId: testUser, questionId: firstQ._id });
    assert(!!savedAttempt, 'QuestionAttempt document persisted');
    assert(!!savedAttempt?.examId, 'QuestionAttempt has examId populated');
    assert(savedAttempt?.examId?.toString() === sscExam._id.toString(), 'QuestionAttempt examId matches SSC CGL');

    // -------------------------------------------------------------
    // TASK 3.7: Mock Test API & Configurable Scoring
    // -------------------------------------------------------------
    console.log('\n--- 7. TASK 3.7: Mock Test API & Configurable Scoring ---');
    const resMockStart = await fetch(`${baseUrl}/mock-tests/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        testType: 'TIER_1',
        examId: sscExam._id,
        paperId: tier1Paper._id,
      }),
    });
    const dataMockStart = await resMockStart.json();
    assert(resMockStart.status === 200, 'POST /api/mock-tests/start returns HTTP 200');
    assert(dataMockStart.data.totalQuestions === 100, 'Mock test contains 100 questions');

    // Verify MockTestSession has scoringConfig and examId
    const mockSession = await MockTestSession.findOne({ sessionId: dataMockStart.data.sessionId });
    assert(!!mockSession, 'MockTestSession document created');
    assert(mockSession?.scoringConfig?.correctMarks === 2, 'Mock scoringConfig.correctMarks is 2');
    assert(mockSession?.scoringConfig?.wrongMarks === 0.5, 'Mock scoringConfig.wrongMarks is 0.5');
    assert(mockSession?.scoringConfig?.unansweredMarks === 0, 'Mock scoringConfig.unansweredMarks is 0');

    // Answer 1 question correctly in section 0
    const mockQ1 = dataMockStart.data.questions[0];
    const originalQ1 = await Question.findById(mockQ1._id);
    await fetch(`${baseUrl}/mock-tests/${dataMockStart.data.sessionId}/answer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        questionId: mockQ1._id,
        selectedAnswer: originalQ1!.correctAnswer,
        isMarkedForReview: true,
      }),
    });

    // Mark question retrieval with examId
    const resMarked = await fetch(`${baseUrl}/mock-tests/marked-questions?examId=${sscExam._id}`);
    const dataMarked = await resMarked.json();
    assert(resMarked.status === 200, 'GET /api/mock-tests/marked-questions?examId=... returns HTTP 200');
    assert(dataMarked.success === true, 'Marked questions returned');

    // Submit mock test & verify dynamic scoring (+2 / -0.5)
    const resSubmit = await fetch(`${baseUrl}/mock-tests/${dataMockStart.data.sessionId}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const dataSubmit = await resSubmit.json();
    assert(resSubmit.status === 200, 'POST /api/mock-tests/:sessionId/submit returns HTTP 200');
    assert(dataSubmit.data.totalCorrect === 1, 'Submitted score has totalCorrect = 1');
    assert(dataSubmit.data.totalScore === 2, 'Dynamic score computation evaluated correct * 2 = 2.00 marks');
    assert(dataSubmit.data.maxMarks === 200, 'Dynamic maxMarks is 200 (100 * 2)');

    // -------------------------------------------------------------
    // TASK 3.8: Analytics & Performance with examId
    // -------------------------------------------------------------
    console.log('\n--- 8. TASK 3.8: Analytics & Performance with examId scoping ---');
    const resPerf = await fetch(`${baseUrl}/performance/summary?examId=${sscExam._id}`, {
      headers: { 'x-guest-id': testUser },
    });
    const dataPerf = await resPerf.json();
    assert(resPerf.status === 200, 'GET /api/performance/summary?examId=... returns HTTP 200');
    assert(dataPerf.data.totalAttempted >= 1, 'Performance summary returns attempts for testUser');

    // Test isolation with foreign examId
    const resPerfForeign = await fetch(`${baseUrl}/performance/summary?examId=${fakeExamId}`, {
      headers: { 'x-guest-id': testUser },
    });
    const dataPerfForeign = await resPerfForeign.json();
    assert(dataPerfForeign.data.totalAttempted === 0, 'Foreign examId returns 0 attempts (complete exam isolation)');

    // -------------------------------------------------------------
    // TASK 3.9: Revision API with examId scoping
    // -------------------------------------------------------------
    console.log('\n--- 9. TASK 3.9: Revision API with examId scoping ---');
    const resRevSummary = await fetch(`${baseUrl}/revision/summary?examId=${sscExam._id}`, {
      headers: { 'x-guest-id': testUser },
    });
    const dataRevSummary = await resRevSummary.json();
    assert(resRevSummary.status === 200, 'GET /api/revision/summary?examId=... returns HTTP 200');
    assert(typeof dataRevSummary.data.dueCount === 'number', 'Summary has numeric dueCount');

    const resRevStats = await fetch(`${baseUrl}/revision/stats?examId=${sscExam._id}`, {
      headers: { 'x-guest-id': testUser },
    });
    const dataRevStats = await resRevStats.json();
    assert(resRevStats.status === 200, 'GET /api/revision/stats?examId=... returns HTTP 200');
    assert(typeof dataRevStats.data.inRevision === 'number', 'Stats has numeric inRevision');

    // -------------------------------------------------------------
    // TASK 3.10: Daily Study Plan with examId scoping
    // -------------------------------------------------------------
    console.log('\n--- 10. TASK 3.10: Daily Study Plan with examId scoping ---');
    const resPlanGenerate = await fetch(`${baseUrl}/study-plan/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-guest-id': testUser,
      },
      body: JSON.stringify({
        goal: 20,
        forceRegenerate: true,
        examId: sscExam._id,
      }),
    });
    const dataPlanGenerate = await resPlanGenerate.json();
    assert(resPlanGenerate.status === 200, 'POST /api/study-plan/generate with examId returns HTTP 200');
    assert(dataPlanGenerate.data.goalQuestions === 20, 'Plan generated with requested goal');

    // Verify persisted plan has examId
    const savedPlan = await DailyStudyPlan.findById(dataPlanGenerate.data._id);
    assert(!!savedPlan?.examId, 'DailyStudyPlan has examId populated');
    assert(savedPlan?.examId?.toString() === sscExam._id.toString(), 'DailyStudyPlan examId matches SSC CGL');

    // Retrieve today's plan with examId
    const resPlanToday = await fetch(`${baseUrl}/study-plan/today?examId=${sscExam._id}`, {
      headers: { 'x-guest-id': testUser },
    });
    const dataPlanToday = await resPlanToday.json();
    assert(resPlanToday.status === 200, 'GET /api/study-plan/today?examId=... returns HTTP 200');
    assert(dataPlanToday.data.goalQuestions === 20, 'Today plan returned matches generated plan');

    // -------------------------------------------------------------
    // Backward Compatibility Verification
    // -------------------------------------------------------------
    console.log('\n--- 11. Backward Compatibility Verification (No Exam Param) ---');
    const resCompatSubjects = await fetch(`${baseUrl}/subjects`);
    assert(resCompatSubjects.status === 200, 'Legacy GET /api/subjects still returns HTTP 200');

    const resCompatPractice = await fetch(`${baseUrl}/practice/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subjectId: testSubject._id,
        topicId: testTopic._id,
        difficulty: 'Easy',
        count: 5,
      }),
    });
    assert(resCompatPractice.status === 200, 'Legacy POST /api/practice/start still returns HTTP 200');

    const resCompatMock = await fetch(`${baseUrl}/mock-tests/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ testType: 'TIER_1' }),
    });
    assert(resCompatMock.status === 200, 'Legacy POST /api/mock-tests/start still returns HTTP 200');

    const resCompatPerf = await fetch(`${baseUrl}/performance/summary`, {
      headers: { 'x-guest-id': testUser },
    });
    assert(resCompatPerf.status === 200, 'Legacy GET /api/performance/summary still returns HTTP 200');

    const resCompatRev = await fetch(`${baseUrl}/revision/summary`, {
      headers: { 'x-guest-id': testUser },
    });
    assert(resCompatRev.status === 200, 'Legacy GET /api/revision/summary still returns HTTP 200');

    console.log('\n====================================================');
    console.log(`🎉 ALL ${passed}/${total} MULTI-EXAM API TESTS PASSED!`);
    console.log('====================================================\n');

  } finally {
    // Clean up test attempts and plans
    await QuestionAttempt.deleteMany({ userId: testUser });
    await QuestionRevision.deleteMany({ userId: testUser });
    await DailyStudyPlan.deleteMany({ userId: testUser });

    server.close();
    await mongoose.disconnect();
  }
}

runMultiExamApiTests().catch((err) => {
  console.error('Test failed with error:', err);
  process.exit(1);
});
