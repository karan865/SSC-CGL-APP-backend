import mongoose, { Schema, Document } from 'mongoose';

export interface IStudyStreak extends Document {
  userId: string;
  currentStreak: number;
  longestStreak: number;
  lastCompletedDate: string | null; // Date key: 'YYYY-MM-DD'
  totalCompletedDays: number;
  createdAt: Date;
  updatedAt: Date;
}

const studyStreakSchema = new Schema<IStudyStreak>(
  {
    userId: { type: String, required: true, unique: true, index: true, trim: true },
    currentStreak: { type: Number, default: 0 },
    longestStreak: { type: Number, default: 0 },
    lastCompletedDate: { type: String, default: null },
    totalCompletedDays: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export const StudyStreak = mongoose.model<IStudyStreak>('StudyStreak', studyStreakSchema);
