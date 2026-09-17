import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

import app from '../app';
import http from 'http';
import { Exam } from '../models/Exam';
import { ExamPaper } from '../models/ExamPaper';
import { Subject } from '../models/Subject';
import { Topic } from '../models/Topic';
import { Question } from '../models/Question';
import { QuestionAttempt } from '../models/QuestionAttempt';

let server: http.Server;
let baseUrl: string;

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`  ❌ FAIL: ${message}`);
    throw new Error(message);
  }
  console.log(`  ✅ PASS: ${message}`);
}

async function apiRequest(path: string, options: RequestInit = {}) {
  const url = `${baseUrl}${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const data = await response.json();
  return { status: response.status, data };
}

async function runTests() {
  console.log('====================================================');
  console.log('🧪 JPSC PRELIMS PAPER I: END-TO-END FLOW VALIDATION');
  console.log('====================================================\n');

  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) throw new Error('MONGODB_URI is not defined');

  await mongoose.connect(mongoUri);

  server = http.createServer(app);
  await new Promise<void>((resolve) => {
    server.listen(0, () => {
      const addr = server.address() as any;
      baseUrl = `http://localhost:${addr.port}/api`;
      resolve();
    });
  });

  try {
    // 1. Verify JPSC Exam & Paper I in database
    console.log('--- 1. Verification of JPSC Exam & Paper I in DB ---');
    const jpscExam = await Exam.findOne({ slug: 'jpsc' });
    assert(!!jpscExam, 'JPSC Exam exists in database');
    assert(jpscExam?.name === 'JPSC', 'JPSC Exam name is "JPSC"');

    const paper1 = await ExamPaper.findOne({ examId: jpscExam!._id, slug: 'paper-1' });
    assert(!!paper1, 'Paper I exists for JPSC');
    assert(paper1?.scoring?.correctMarks === 2, 'Paper I scoring: +2 correctMarks');
    assert(paper1?.scoring?.wrongMarks === 0, 'Paper I scoring: 0 wrongMarks (No negative marking)');

    const subjects = await Subject.find({ examId: jpscExam!._id, paperId: paper1!._id });
    assert(subjects.length === 8, 'Found all 8 Paper I subjects');

    const qCount = await Question.countDocuments({ examId: jpscExam!._id, paperId: paper1!._id });
    assert(qCount === 600, `Found exactly 600 JPSC Paper I questions in DB (Actual: ${qCount})`);

    // 2. API Content Discovery: Subjects and Topics
    console.log('\n--- 2. Discovery APIs: Subjects & Topics Scoped to JPSC ---');
    const subRes = await apiRequest(`/subjects?examId=${jpscExam!._id}&paperId=${paper1!._id}`);
    assert(subRes.status === 200, 'GET /api/subjects returns HTTP 200');
    assert(subRes.data.data.length === 8, 'Returns 8 subjects for JPSC Paper I');

    const historySub = subjects.find((s) => s.slug === 'jpsc-history');
    const topRes = await apiRequest(`/subjects/${historySub!._id}/topics?examId=${jpscExam!._id}`);
    assert(topRes.status === 200, 'GET /api/subjects/:id/topics returns HTTP 200');
    assert(topRes.data.data.length === 3, 'History subject has 3 topics (Ancient, Medieval, Modern)');

    // 3. Practice Test Flow with Security Check
    console.log('\n--- 3. Practice Test: Question Delivery & Security Projection ---');
    const ancientTopic = await Topic.findOne({ subjectId: historySub!._id, slug: 'ancient-india' });

    const practiceStart = await apiRequest('/practice/start', {
      method: 'POST',
      body: JSON.stringify({
        subjectId: historySub!._id.toString(),
        topicId: ancientTopic!._id.toString(),
        difficulty: 'Easy',
        count: 5,
        examId: jpscExam!._id.toString(),
        paperId: paper1!._id.toString(),
      }),
    });

    assert(practiceStart.status === 200, 'POST /api/practice/start returns HTTP 200');
    assert(practiceStart.data.data.questions.length > 0, 'Returns questions for practice');

    const testQ = practiceStart.data.data.questions[0];
    assert(testQ.questionText.length > 0, 'Question has valid questionText');
    assert(!!testQ.optionA && !!testQ.optionB, 'Question has options populated');
    assert(testQ.correctAnswer === undefined, 'SECURITY: correctAnswer is NOT leaked');
    assert(testQ.explanation === undefined, 'SECURITY: explanation is NOT leaked');

    // 4. Practice Answer Submission & Evaluation
    console.log('\n--- 4. Practice Test: Answer Submission & Evaluation ---');
    const answerRes = await apiRequest('/practice/answer', {
      method: 'POST',
      body: JSON.stringify({
        questionId: testQ._id,
        selectedAnswer: 'B',
        timeSpentSeconds: 30,
        examId: jpscExam!._id.toString(),
        paperId: paper1!._id.toString(),
      }),
    });

    assert(answerRes.status === 200, 'POST /api/practice/answer returns HTTP 200');
    assert(typeof answerRes.data.data.isCorrect === 'boolean', 'Response contains isCorrect boolean');
    assert(['A', 'B', 'C', 'D'].includes(answerRes.data.data.correctAnswer), 'Reveals evaluated correctAnswer');
    assert(typeof answerRes.data.data.explanation === 'string' && answerRes.data.data.explanation.length > 15, 'Reveals detailed explanatory reasoning');

    // 5. Check QuestionAttempt stamped with JPSC examId
    console.log('\n--- 5. Attempt Record Exam Stamping ---');
    const latestAttempt = await QuestionAttempt.findOne({ questionId: testQ._id }).sort({ attemptedAt: -1 });
    assert(!!latestAttempt, 'QuestionAttempt persisted in DB');
    assert(latestAttempt?.examId?.toString() === jpscExam!._id.toString(), 'QuestionAttempt has examId matching JPSC');

    // 6. Cross-Exam Isolation Verification
    console.log('\n--- 6. Backward Compatibility & Cross-Exam Isolation ---');
    const sscExam = await Exam.findOne({ slug: 'ssc-cgl' });
    const sscSubRes = await apiRequest(`/subjects?examId=${sscExam!._id}`);
    assert(sscSubRes.status === 200, 'GET /api/subjects for SSC returns HTTP 200');
    assert(sscSubRes.data.data.length >= 4, 'Returns canonical SSC subjects');

    const sscQuestionsCount = await Question.countDocuments({ examId: sscExam!._id });
    assert(sscQuestionsCount === 5662, `SSC CGL has all 5,662 questions intact (Actual: ${sscQuestionsCount})`);

    // Clean up test attempts
    await QuestionAttempt.deleteMany({ questionId: testQ._id });

    console.log('\n====================================================');
    console.log('🎉 ALL JPSC PRELIMS PAPER I E2E TESTS PASSED!');
    console.log('====================================================\n');
  } finally {
    server.close();
    await mongoose.disconnect();
  }
}

runTests().catch((err) => {
  console.error('Test run failed:', err);
  process.exit(1);
});
