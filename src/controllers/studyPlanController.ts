import { Request, Response, NextFunction } from 'express';
import {
  getTodayPlan,
  generateDailyPlan,
  startDailyPlan,
  completePlanItem,
  getPlanProgress,
  updateDailyGoal,
} from '../services/dailyStudyPlanService';
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

export const getTodayPlanHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = getUserId(req);
    const examId = (req.query.examId as string) || undefined;
    const progress = await getPlanProgress(userId, examId);
    res.status(200).json(successResponse("Today's study plan fetched successfully", progress));
  } catch (error) {
    next(error);
  }
};

export const generatePlanHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = getUserId(req);
    const goalQuestions = Number(req.body?.goalQuestions || req.body?.goal) || 35;
    const force = req.body?.force === true || req.body?.forceRegenerate === true;
    const examId = (req.body?.examId || req.query?.examId) as string | undefined;
    const plan = await generateDailyPlan(userId, goalQuestions, force, examId);
    res.status(200).json(successResponse('Daily study plan generated successfully', plan));
  } catch (error) {
    next(error);
  }
};

export const startPlanHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = getUserId(req);
    const examId = (req.body?.examId || req.query?.examId) as string | undefined;
    const result = await startDailyPlan(userId, examId);
    res.status(200).json(successResponse('Daily study plan started', result));
  } catch (error) {
    next(error);
  }
};

export const completePlanItemHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = getUserId(req);
    const itemId = Array.isArray(req.params.itemId) ? req.params.itemId[0] : req.params.itemId;
    const answeredCount = Number(req.body?.count || req.body?.answeredCount) || 1;

    if (!itemId) {
      res.status(400).json(errorResponse('Missing plan itemId parameter'));
      return;
    }

    try {
      const examId = (req.body?.examId || req.query?.examId) as string | undefined;
      const result = await completePlanItem(userId, itemId, answeredCount, examId);
      res.status(200).json(successResponse('Study plan item progress recorded', result));
    } catch (err: any) {
      if (err.message === 'PLAN_ITEM_NOT_FOUND') {
        res.status(404).json(errorResponse('Study plan item not found'));
        return;
      }
      throw err;
    }
  } catch (error) {
    next(error);
  }
};

export const getPlanProgressHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = getUserId(req);
    const examId = (req.query.examId as string) || undefined;
    const progress = await getPlanProgress(userId, examId);
    res.status(200).json(successResponse('Study plan progress fetched successfully', progress));
  } catch (error) {
    next(error);
  }
};

export const updateGoalHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = getUserId(req);
    const goalQuestions = Number(req.body?.goalQuestions || req.body?.goal);

    if (!goalQuestions || ![20, 35, 50].includes(goalQuestions)) {
      res.status(400).json(errorResponse('Daily goal must be 20, 35, or 50 questions'));
      return;
    }

    const examId = (req.body?.examId || req.query?.examId) as string | undefined;
    const plan = await updateDailyGoal(userId, goalQuestions, examId);
    const progress = await getPlanProgress(userId, examId);
    res.status(200).json(successResponse('Daily study goal updated successfully', progress));
  } catch (error) {
    next(error);
  }
};
