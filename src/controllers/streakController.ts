import { Request, Response } from 'express';
import { getTodayStatus, recordDailyGoalCompletion } from '../services/studyStreakService';

export const getStreak = async (req: Request, res: Response): Promise<void> => {
  try {
    const rawUserId = req.headers['x-guest-id'] as string;
    const userId = rawUserId?.trim() || 'guest_default';

    const streakData = await getTodayStatus(userId);

    res.status(200).json({
      success: true,
      message: 'Study streak fetched successfully',
      data: streakData,
    });
  } catch (error: any) {
    console.error('Error fetching study streak:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch study streak',
      errors: [error.message],
    });
  }
};

export const completeGoal = async (req: Request, res: Response): Promise<void> => {
  try {
    const rawUserId = req.headers['x-guest-id'] as string;
    const userId = rawUserId?.trim() || 'guest_default';
    const { dateKey } = req.body || {};

    const updatedStreak = await recordDailyGoalCompletion(userId, dateKey);

    res.status(200).json({
      success: true,
      message: 'Daily goal completed',
      data: updatedStreak,
    });
  } catch (error: any) {
    console.error('Error completing daily goal:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to complete daily goal',
      errors: [error.message],
    });
  }
};
