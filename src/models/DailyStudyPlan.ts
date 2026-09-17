import mongoose, { Schema, Document } from 'mongoose';

export type PlanItemType =
  | 'REVISION'
  | 'WEAK_TOPIC'
  | 'RECOMMENDED'
  | 'BALANCED_PRACTICE'
  | 'MINI_MOCK';

export type PlanStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';

export interface IStudyPlanItem {
  _id: mongoose.Types.ObjectId;
  type: PlanItemType;
  title: string;
  subjectId?: mongoose.Types.ObjectId;
  subjectName?: string;
  topicId?: mongoose.Types.ObjectId;
  topicName?: string;
  difficulty?: 'Easy' | 'Medium' | 'Hard';
  questionCount: number;
  completedCount: number;
  priority: number;
  completed: boolean;
}

export interface IDailyStudyPlan extends Document {
  userId: string;
  examId?: mongoose.Types.ObjectId;
  dateKey: string; // YYYY-MM-DD
  goalQuestions: number;
  completedQuestions: number;
  status: PlanStatus;
  estimatedMinutes: number;
  items: mongoose.Types.DocumentArray<IStudyPlanItem & Document>;
  createdAt: Date;
  updatedAt: Date;
}

const studyPlanItemSchema = new Schema<IStudyPlanItem>({
  type: {
    type: String,
    enum: ['REVISION', 'WEAK_TOPIC', 'RECOMMENDED', 'BALANCED_PRACTICE', 'MINI_MOCK'],
    required: true,
  },
  title: { type: String, required: true },
  subjectId: { type: Schema.Types.ObjectId, ref: 'Subject' },
  subjectName: { type: String },
  topicId: { type: Schema.Types.ObjectId, ref: 'Topic' },
  topicName: { type: String },
  difficulty: { type: String, enum: ['Easy', 'Medium', 'Hard'] },
  questionCount: { type: Number, required: true, min: 1 },
  completedCount: { type: Number, default: 0, min: 0 },
  priority: { type: Number, default: 50 },
  completed: { type: Boolean, default: false },
});

const dailyStudyPlanSchema = new Schema<IDailyStudyPlan>(
  {
    userId: { type: String, required: true, default: 'guest_default', index: true, trim: true },
    examId: { type: Schema.Types.ObjectId, ref: 'Exam', required: false, index: true },
    dateKey: { type: String, required: true, index: true },
    goalQuestions: { type: Number, required: true, default: 35 },
    completedQuestions: { type: Number, default: 0, min: 0 },
    status: {
      type: String,
      enum: ['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED'],
      default: 'NOT_STARTED',
      index: true,
    },
    estimatedMinutes: { type: Number, default: 30 },
    items: [studyPlanItemSchema],
  },
  { timestamps: true }
);

// One canonical study plan per user per exam per day
dailyStudyPlanSchema.index({ userId: 1, dateKey: 1, examId: 1 }, { unique: true });
dailyStudyPlanSchema.index({ userId: 1, status: 1 });
dailyStudyPlanSchema.index({ examId: 1, userId: 1, dateKey: 1 });

export const DailyStudyPlan = mongoose.model<IDailyStudyPlan>(
  'DailyStudyPlan',
  dailyStudyPlanSchema
);
