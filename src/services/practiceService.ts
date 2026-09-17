import mongoose from 'mongoose';
import { Subject } from '../models/Subject';
import { Topic } from '../models/Topic';
import { Question } from '../models/Question';
import { MarkedQuestion } from '../models/MarkedQuestion';

import { selectPracticeQuestions } from './questionSelectionService';

export const generatePracticeTest = async (
  subjectId: string,
  topicId: string,
  difficulty: string,
  count: number = 25,
  userId: string = 'guest_default',
  examId?: string,
  stageId?: string,
  paperId?: string
) => {
  return selectPracticeQuestions({
    userId,
    subjectId,
    topicId,
    difficulty,
    count,
    examId,
    stageId,
    paperId,
  });
};

import { recordPracticeAttempt } from './performanceService';
import { recordMistakeForRevision } from './revisionService';

export const evaluateAnswer = async (
  questionId: string,
  selectedAnswer: string,
  userId: string = 'guest_default'
) => {
  if (!mongoose.Types.ObjectId.isValid(questionId)) {
    throw new Error('INVALID_QUESTION_ID');
  }

  const validOptions = ['A', 'B', 'C', 'D'];
  if (!validOptions.includes(selectedAnswer)) {
    throw new Error('INVALID_ANSWER');
  }

  const question = await Question.findOne({ _id: questionId, isActive: true });
  
  if (!question) {
    throw new Error('QUESTION_NOT_FOUND');
  }

  const isCorrect = selectedAnswer === question.correctAnswer;
  const marks = isCorrect ? 1 : 0; // No negative marking in V1

  // Persist attempt for personalized performance tracking
  try {
    await recordPracticeAttempt(
      userId,
      questionId,
      selectedAnswer as 'A' | 'B' | 'C' | 'D',
      isCorrect,
      marks
    );

    // If answer is incorrect, schedule for smart spaced revision
    if (!isCorrect) {
      await recordMistakeForRevision(userId, questionId, question.subjectId, question.topicId);
    }
  } catch (err) {
    console.warn('Failed to record practice question attempt / revision:', err);
  }

  return {
    isCorrect,
    selectedAnswer,
    correctAnswer: question.correctAnswer,
    marks,
    explanation: question.explanation,
    explanation_hi: question.explanation_hi,
  };
};

export const toggleMarkQuestion = async (
  questionId: string,
  userSelectedAnswer?: 'A' | 'B' | 'C' | 'D' | null,
  isMarked: boolean = true,
  source: 'PRACTICE' | 'MOCK_TEST' = 'PRACTICE'
) => {
  if (!mongoose.Types.ObjectId.isValid(questionId)) {
    throw new Error('INVALID_QUESTION_ID');
  }

  const qObjId = new mongoose.Types.ObjectId(questionId);

  const question = await Question.findById(qObjId);
  if (!question || !question.isActive) {
    throw new Error('QUESTION_NOT_FOUND');
  }

  if (!isMarked) {
    await MarkedQuestion.deleteOne({ questionId: qObjId });
    return { questionId, isMarked: false };
  }

  const record = await MarkedQuestion.findOneAndUpdate(
    { questionId: qObjId },
    {
      questionId: qObjId,
      userSelectedAnswer: userSelectedAnswer ?? null,
      source,
      isMarked: true,
    },
    { upsert: true, new: true }
  );

  return { questionId, isMarked: true, record };
};

