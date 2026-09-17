import { Request, Response, NextFunction } from 'express';
import {
  getUserPerformance,
  getRecommendedPractice,
  getTopicPerformance,
} from '../services/performanceService';
import { successResponse, errorResponse } from '../utils/apiResponse';

export const getPerformanceHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId =
      (req.headers['x-guest-id'] as string) ||
      (req.query.guestId as string) ||
      (req.query.userId as string) ||
      'guest_default';
    const examId = (req.query.examId || req.query.examSlug || req.query.exam) as string | undefined;

    const performance = await getUserPerformance(userId, examId);
    res.status(200).json(
      successResponse('Performance summary fetched successfully', performance)
    );
  } catch (error) {
    next(error);
  }
};

export const getRecommendationsHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId =
      (req.headers['x-guest-id'] as string) ||
      (req.query.guestId as string) ||
      (req.query.userId as string) ||
      'guest_default';
    const examId = (req.query.examId || req.query.examSlug || req.query.exam) as string | undefined;

    const recommendation = await getRecommendedPractice(userId, 3, examId);
    res.status(200).json(
      successResponse('Recommended practice generated successfully', recommendation)
    );
  } catch (error) {
    next(error);
  }
};

export const getTopicPerformanceHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId =
      (req.headers['x-guest-id'] as string) ||
      (req.query.guestId as string) ||
      (req.query.userId as string) ||
      'guest_default';

    const topicId = Array.isArray(req.params.topicId)
      ? req.params.topicId[0]
      : req.params.topicId;

    if (!topicId) {
      res.status(400).json(errorResponse('Topic ID is required'));
      return;
    }

    const topicMetric = await getTopicPerformance(userId, topicId);
    if (!topicMetric) {
      res.status(404).json(errorResponse('Topic not found or invalid ID'));
      return;
    }

    res.status(200).json(
      successResponse('Topic performance fetched successfully', topicMetric)
    );
  } catch (error) {
    next(error);
  }
};
