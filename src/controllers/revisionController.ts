import { Request, Response, NextFunction } from 'express';
import {
  getRevisionSummary,
  getDueRevisions,
  startRevisionSession,
  processRevisionAnswer,
  getRevisionStats,
} from '../services/revisionService';
import { successResponse, errorResponse } from '../utils/apiResponse';

const getUserId = (req: Request): string => {
  return (
    (req.headers['x-guest-id'] as string) ||
    req.body?.guestId ||
    req.body?.userId ||
    (req.query?.guestId as string) ||
    (req.query?.userId as string) ||
    'guest_default'
  );
};

export const getRevisionSummaryHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = getUserId(req);
    const summary = await getRevisionSummary(userId);
    res.status(200).json(successResponse('Revision summary fetched successfully', summary));
  } catch (error) {
    next(error);
  }
};

export const getDueRevisionsHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = getUserId(req);
    const limit = Number(req.query.limit) || 10;
    const dueData = await getDueRevisions(userId, limit);
    res.status(200).json(successResponse('Due revision questions fetched successfully', dueData));
  } catch (error) {
    next(error);
  }
};

export const startRevisionHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = getUserId(req);
    const limit = Number(req.body?.limit || req.body?.count) || 10;
    const session = await startRevisionSession(userId, limit);
    res.status(200).json(successResponse('Revision session started successfully', session));
  } catch (error) {
    next(error);
  }
};

export const submitRevisionAnswerHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = getUserId(req);
    const { questionId, selectedAnswer } = req.body;

    if (!questionId || !selectedAnswer) {
      res.status(400).json(errorResponse('Missing required fields: questionId, selectedAnswer'));
      return;
    }

    try {
      const result = await processRevisionAnswer(userId, questionId, selectedAnswer);
      res.status(200).json(successResponse('Revision answer processed successfully', result));
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

export const getRevisionStatsHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = getUserId(req);
    const stats = await getRevisionStats(userId);
    res.status(200).json(successResponse('Revision statistics fetched successfully', stats));
  } catch (error) {
    next(error);
  }
};
