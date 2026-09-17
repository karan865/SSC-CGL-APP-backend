import { StudyStreak, IStudyStreak } from '../models/StudyStreak';
import { DailyStudyPlan } from '../models/DailyStudyPlan';
import { getTodayDateKey } from './dailyStudyPlanService';

export interface StreakStatusResponse {
  currentStreak: number;
  longestStreak: number;
  totalCompletedDays: number;
  todayCompleted: boolean;
}

/**
 * Calculates yesterday's dateKey given a YYYY-MM-DD reference string.
 */
export function getYesterdayDateKey(refDateKey: string = getTodayDateKey()): string {
  const [year, month, day] = refDateKey.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() - 1);
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Pure calculation function for updating streak metrics.
 */
export function calculateStreakUpdate(
  lastCompletedDate: string | null,
  currentStreak: number,
  longestStreak: number,
  totalCompletedDays: number,
  targetDateKey: string
) {
  // Idempotent: Same date completed multiple times returns existing metrics
  if (lastCompletedDate === targetDateKey) {
    return {
      currentStreak,
      longestStreak,
      totalCompletedDays,
      lastCompletedDate,
      todayCompleted: true,
      wasAlreadyCompleted: true,
    };
  }

  const yesterdayKey = getYesterdayDateKey(targetDateKey);

  let newCurrentStreak = 1;
  if (lastCompletedDate === yesterdayKey) {
    // Consecutive completion: Extend streak
    newCurrentStreak = currentStreak + 1;
  } else {
    // Missed day or first completion: Reset streak to 1
    newCurrentStreak = 1;
  }

  const newLongestStreak = Math.max(longestStreak, newCurrentStreak);
  const newTotalCompletedDays = totalCompletedDays + 1;

  return {
    currentStreak: newCurrentStreak,
    longestStreak: newLongestStreak,
    totalCompletedDays: newTotalCompletedDays,
    lastCompletedDate: targetDateKey,
    todayCompleted: true,
    wasAlreadyCompleted: false,
  };
}

/**
 * Retrieves the current streak status for a user.
 */
export async function getStudyStreak(userId: string): Promise<StreakStatusResponse> {
  const normalizedUserId = userId?.trim() || 'guest_default';
  const todayKey = getTodayDateKey();
  const yesterdayKey = getYesterdayDateKey(todayKey);

  let streakDoc = await StudyStreak.findOne({ userId: normalizedUserId });
  if (!streakDoc) {
    return {
      currentStreak: 0,
      longestStreak: 0,
      totalCompletedDays: 0,
      todayCompleted: false,
    };
  }

  const lastDate = streakDoc.lastCompletedDate;
  let activeStreak = 0;
  let todayCompleted = false;

  if (lastDate === todayKey) {
    todayCompleted = true;
    activeStreak = streakDoc.currentStreak;
  } else if (lastDate === yesterdayKey) {
    // Completed yesterday, streak is currently active pending today's goal
    todayCompleted = false;
    activeStreak = streakDoc.currentStreak;
  } else {
    // Lapsed streak (missed yesterday)
    todayCompleted = false;
    activeStreak = 0;
  }

  return {
    currentStreak: activeStreak,
    longestStreak: streakDoc.longestStreak,
    totalCompletedDays: streakDoc.totalCompletedDays,
    todayCompleted,
  };
}

/**
 * Records daily goal completion for a given dateKey (defaults to today).
 * Idempotent: Calling multiple times for the same date does not increment streak again.
 */
export async function recordDailyGoalCompletion(
  userId: string,
  dateKey: string = getTodayDateKey()
): Promise<StreakStatusResponse> {
  const normalizedUserId = userId?.trim() || 'guest_default';

  let streakDoc = await StudyStreak.findOne({ userId: normalizedUserId });
  if (!streakDoc) {
    streakDoc = new StudyStreak({
      userId: normalizedUserId,
      currentStreak: 0,
      longestStreak: 0,
      lastCompletedDate: null,
      totalCompletedDays: 0,
    });
  }

  const updated = calculateStreakUpdate(
    streakDoc.lastCompletedDate,
    streakDoc.currentStreak,
    streakDoc.longestStreak,
    streakDoc.totalCompletedDays,
    dateKey
  );

  streakDoc.currentStreak = updated.currentStreak;
  streakDoc.longestStreak = updated.longestStreak;
  streakDoc.totalCompletedDays = updated.totalCompletedDays;
  streakDoc.lastCompletedDate = updated.lastCompletedDate;

  await streakDoc.save();

  return {
    currentStreak: streakDoc.currentStreak,
    longestStreak: streakDoc.longestStreak,
    totalCompletedDays: streakDoc.totalCompletedDays,
    todayCompleted: true,
  };
}

/**
 * Synchronizes today's completion status by checking DailyStudyPlan (single source of truth).
 */
export async function getTodayStatus(userId: string): Promise<StreakStatusResponse> {
  const normalizedUserId = userId?.trim() || 'guest_default';
  const todayKey = getTodayDateKey();

  // Check if today's study plan is already COMPLETED
  const todayPlan = await DailyStudyPlan.findOne({
    userId: normalizedUserId,
    dateKey: todayKey,
  });

  if (todayPlan && todayPlan.status === 'COMPLETED') {
    // Ensure streak record is updated idempotently
    return recordDailyGoalCompletion(normalizedUserId, todayKey);
  }

  return getStudyStreak(normalizedUserId);
}
