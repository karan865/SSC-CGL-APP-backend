import { Request, Response, NextFunction } from 'express';
import {
  startMockTest,
  saveMockAnswer,
  advanceMockSection,
  submitMockTest,
  getMockTestReview,
  getMarkedQuestions,
} from '../services/mockTestService';
import { successResponse, errorResponse } from '../utils/apiResponse';

export const startMockTestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { testType, examId, stageId, paperId } = req.body;
    const result = await startMockTest(testType || 'TIER_1', examId, stageId, paperId);

    res.status(200).json(
      successResponse('Mock Test started successfully', result)
    );
  } catch (error: any) {
    if (error.message && error.message.startsWith('INSUFFICIENT_QUESTIONS')) {
      res.status(400).json(errorResponse(`Cannot start mock test: ${error.message}`));
      return;
    }
    if (error.message && error.message.startsWith('SUBJECT_NOT_FOUND')) {
      res.status(404).json(errorResponse(`Subject configuration error: ${error.message}`));
      return;
    }
    next(error);
  }
};

export const saveAnswerHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const sessionId = Array.isArray(req.params.sessionId)
      ? req.params.sessionId[0]
      : req.params.sessionId;
    const { questionId, selectedAnswer, isMarkedForReview } = req.body;

    if (!questionId) {
      res.status(400).json(errorResponse('Missing required field: questionId'));
      return;
    }

    try {
      const result = await saveMockAnswer(
        sessionId,
        questionId,
        selectedAnswer ?? null,
        Boolean(isMarkedForReview)
      );
      res.status(200).json(successResponse('Answer saved successfully', result));
    } catch (err: any) {
      switch (err.message) {
        case 'INVALID_QUESTION_ID':
          res.status(400).json(errorResponse('Invalid question ID format'));
          break;
        case 'SESSION_NOT_FOUND':
          res.status(404).json(errorResponse('Mock test session not found'));
          break;
        case 'SESSION_NOT_ACTIVE':
          res.status(400).json(errorResponse('This mock test session is no longer active'));
          break;
        case 'SECTION_LOCKED_EXPIRED':
          res.status(403).json(errorResponse('Section timer has expired. Section is locked.'));
          break;
        case 'QUESTION_IN_LOCKED_SECTION':
          res.status(403).json(errorResponse('Cannot modify questions in a locked section'));
          break;
        case 'QUESTION_IN_UPCOMING_SECTION':
          res.status(403).json(errorResponse('Cannot answer question from an upcoming section before advancing to it'));
          break;
        case 'QUESTION_NOT_IN_SESSION':
          res.status(400).json(errorResponse('Question does not belong to active section in this session'));
          break;
        case 'INVALID_OPTION_CHOICE':
          res.status(400).json(errorResponse('Option must be one of A, B, C, D, or null to clear'));
          break;
        default:
          throw err;
      }
    }
  } catch (error) {
    next(error);
  }
};

export const advanceSectionHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const sessionId = Array.isArray(req.params.sessionId)
      ? req.params.sessionId[0]
      : req.params.sessionId;
    const { currentSectionIndex } = req.body;

    if (typeof currentSectionIndex !== 'number') {
      res.status(400).json(errorResponse('Missing or invalid currentSectionIndex'));
      return;
    }

    try {
      const result = await advanceMockSection(sessionId, currentSectionIndex);
      res.status(200).json(successResponse('Advanced to next section successfully', result));
    } catch (err: any) {
      switch (err.message) {
        case 'SESSION_NOT_FOUND':
          res.status(404).json(errorResponse('Mock test session not found'));
          break;
        case 'SESSION_NOT_ACTIVE':
          res.status(400).json(errorResponse('Session is no longer active'));
          break;
        case 'INVALID_SECTION_INDEX':
          res.status(400).json(errorResponse('Invalid section index'));
          break;
        default:
          throw err;
      }
    }
  } catch (error) {
    next(error);
  }
};

export const submitMockTestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const sessionId = Array.isArray(req.params.sessionId)
      ? req.params.sessionId[0]
      : req.params.sessionId;

    try {
      const userId =
        (req.headers['x-guest-id'] as string) ||
        req.body?.guestId ||
        req.body?.userId ||
        'guest_default';
      const scoreSummary = await submitMockTest(sessionId, userId);
      res.status(200).json(
        successResponse('Mock test submitted successfully', scoreSummary)
      );
    } catch (err: any) {
      switch (err.message) {
        case 'SESSION_NOT_FOUND':
          res.status(404).json(errorResponse('Mock test session not found'));
          break;
        default:
          throw err;
      }
    }
  } catch (error) {
    next(error);
  }
};

export const getMockReviewHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const sessionId = Array.isArray(req.params.sessionId)
      ? req.params.sessionId[0]
      : req.params.sessionId;

    try {
      const review = await getMockTestReview(sessionId);
      res.status(200).json(
        successResponse('Post-exam review fetched successfully', review)
      );
    } catch (err: any) {
      switch (err.message) {
        case 'SESSION_NOT_FOUND':
          res.status(404).json(errorResponse('Mock test session not found'));
          break;
        case 'SESSION_NOT_COMPLETED':
          res.status(403).json(
            errorResponse('Review is strictly prohibited before the mock test is submitted')
          );
          break;
        default:
          throw err;
      }
    }
  } catch (error) {
    next(error);
  }
};

export const getMarkedQuestionsHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const sessionId = typeof req.query.sessionId === 'string' ? req.query.sessionId : undefined;
    const examId = typeof req.query.examId === 'string' ? req.query.examId : undefined;
    const result = await getMarkedQuestions(sessionId, examId);
    res.status(200).json(
      successResponse('Marked questions retrieved successfully', result)
    );
  } catch (error) {
    next(error);
  }
};

