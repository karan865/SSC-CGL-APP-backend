import { Request, Response, NextFunction } from 'express';
import { generatePracticeTest, evaluateAnswer, toggleMarkQuestion } from '../services/practiceService';
import { successResponse, errorResponse } from '../utils/apiResponse';

export const startPracticeTest = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { subjectId, topicId, difficulty, count, limit, examId, stageId, paperId } = req.body;
    const requestedCount = Number(count || limit) || 25;

    if (!subjectId || !topicId || !difficulty) {
      res.status(400).json(errorResponse('Missing required fields: subjectId, topicId, difficulty'));
      return;
    }

    try {
      const userId =
        (req.headers['x-guest-id'] as string) ||
        req.body?.guestId ||
        req.body?.userId ||
        'guest_default';

      const result = await generatePracticeTest(
        subjectId,
        topicId,
        difficulty,
        requestedCount,
        userId,
        examId,
        stageId,
        paperId
      );

      if (!result.success) {
        res.status(400).json({
          success: false,
          message: 'Not enough questions available for this test.',
          errors: [
            {
              available: result.available,
              required: result.required
            }
          ]
        });
        return;
      }

      res.status(200).json(successResponse('Practice test started successfully', {
        totalQuestions: result.totalQuestions,
        questions: result.questions,
        selectionInfo: result.selectionInfo,
      }));

    } catch (err: any) {
      switch (err.message) {
        case 'INVALID_ID':
          res.status(400).json(errorResponse('Invalid Subject or Topic ID format'));
          break;
        case 'INVALID_DIFFICULTY':
          res.status(400).json(errorResponse('Difficulty must be Easy, Medium, or Hard'));
          break;
        case 'SUBJECT_NOT_FOUND':
          res.status(404).json(errorResponse('Subject not found or is inactive'));
          break;
        case 'TOPIC_NOT_FOUND':
          res.status(404).json(errorResponse('Topic not found, inactive, or belongs to another subject'));
          break;
        default:
          throw err; // Let the global error handler catch any unexpected errors
      }
    }
  } catch (error) {
    next(error);
  }
};

export const submitAnswer = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { questionId, selectedAnswer } = req.body;

    if (!questionId || !selectedAnswer) {
      res.status(400).json(errorResponse('Missing required fields: questionId, selectedAnswer'));
      return;
    }

    try {
      const userId =
        (req.headers['x-guest-id'] as string) ||
        req.body?.guestId ||
        req.body?.userId ||
        'guest_default';
      const result = await evaluateAnswer(questionId, selectedAnswer, userId);
      res.status(200).json(successResponse('Answer evaluated successfully', result));
    } catch (err: any) {
      switch (err.message) {
        case 'INVALID_QUESTION_ID':
          res.status(400).json(errorResponse('Invalid question ID format'));
          break;
        case 'INVALID_ANSWER':
          res.status(400).json(errorResponse('Selected answer must be one of A, B, C, D'));
          break;
        case 'QUESTION_NOT_FOUND':
          res.status(404).json(errorResponse('Question not found or is inactive'));
          break;
        default:
          throw err;
      }
    }
  } catch (error) {
    next(error);
  }
};

export const markQuestionHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { questionId, userSelectedAnswer, isMarked } = req.body;

    if (!questionId) {
      res.status(400).json(errorResponse('Missing required field: questionId'));
      return;
    }

    try {
      const result = await toggleMarkQuestion(
        questionId,
        userSelectedAnswer ?? null,
        isMarked !== undefined ? Boolean(isMarked) : true,
        'PRACTICE'
      );
      res.status(200).json(successResponse('Question mark status updated', result));
    } catch (err: any) {
      switch (err.message) {
        case 'INVALID_QUESTION_ID':
          res.status(400).json(errorResponse('Invalid question ID format'));
          break;
        case 'QUESTION_NOT_FOUND':
          res.status(404).json(errorResponse('Question not found or is inactive'));
          break;
        default:
          throw err;
      }
    }
  } catch (error) {
    next(error);
  }
};

