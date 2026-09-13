import mongoose, { Schema, Document } from 'mongoose';

export type MockTestStatus = 'IN_PROGRESS' | 'COMPLETED' | 'EXPIRED';

export interface IMockSectionConfig {
  sectionIndex: number;
  subjectSlug: string;
  name: string;
  durationMinutes: number;
  startedAt?: Date;
  expiresAt?: Date;
  isLocked: boolean;
  questionIds: mongoose.Types.ObjectId[];
}

export interface IMockAnswerRecord {
  questionId: mongoose.Types.ObjectId;
  selectedAnswer: 'A' | 'B' | 'C' | 'D' | null;
  isMarkedForReview: boolean;
  updatedAt: Date;
}

export interface IMockSectionResult {
  sectionIndex: number;
  subjectSlug: string;
  name: string;
  totalQuestions: number;
  correct: number;
  wrong: number;
  unanswered: number;
  marks: number;
  accuracy: number;
}

export interface IMockScoreSummary {
  totalQuestions: number;
  maxMarks: number;
  totalScore: number;
  totalCorrect: number;
  totalWrong: number;
  totalUnanswered: number;
  accuracy: number;
  sectionResults: IMockSectionResult[];
}

export interface IMockTestSession extends Document {
  sessionId: string;
  testType: 'TIER_1';
  status: MockTestStatus;
  currentSectionIndex: number;
  sections: IMockSectionConfig[];
  answers: IMockAnswerRecord[];
  startedAt: Date;
  expiresAt: Date;
  submittedAt?: Date;
  scoreSummary?: IMockScoreSummary;
  createdAt: Date;
  updatedAt: Date;
}

const mockSectionConfigSchema = new Schema<IMockSectionConfig>(
  {
    sectionIndex: { type: Number, required: true },
    subjectSlug: { type: String, required: true },
    name: { type: String, required: true },
    durationMinutes: { type: Number, required: true, default: 15 },
    startedAt: { type: Date },
    expiresAt: { type: Date },
    isLocked: { type: Boolean, default: false },
    questionIds: [{ type: Schema.Types.ObjectId, ref: 'Question', required: true }],
  },
  { _id: false }
);

const mockAnswerRecordSchema = new Schema<IMockAnswerRecord>(
  {
    questionId: { type: Schema.Types.ObjectId, ref: 'Question', required: true },
    selectedAnswer: { type: String, enum: ['A', 'B', 'C', 'D', null], default: null },
    isMarkedForReview: { type: Boolean, default: false },
    updatedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const mockSectionResultSchema = new Schema<IMockSectionResult>(
  {
    sectionIndex: { type: Number, required: true },
    subjectSlug: { type: String, required: true },
    name: { type: String, required: true },
    totalQuestions: { type: Number, required: true },
    correct: { type: Number, required: true },
    wrong: { type: Number, required: true },
    unanswered: { type: Number, required: true },
    marks: { type: Number, required: true },
    accuracy: { type: Number, required: true },
  },
  { _id: false }
);

const mockScoreSummarySchema = new Schema<IMockScoreSummary>(
  {
    totalQuestions: { type: Number, required: true },
    maxMarks: { type: Number, required: true, default: 200 },
    totalScore: { type: Number, required: true },
    totalCorrect: { type: Number, required: true },
    totalWrong: { type: Number, required: true },
    totalUnanswered: { type: Number, required: true },
    accuracy: { type: Number, required: true },
    sectionResults: [mockSectionResultSchema],
  },
  { _id: false }
);

const mockTestSessionSchema = new Schema<IMockTestSession>(
  {
    sessionId: { type: String, required: true, unique: true, index: true },
    testType: { type: String, enum: ['TIER_1'], default: 'TIER_1', required: true },
    status: {
      type: String,
      enum: ['IN_PROGRESS', 'COMPLETED', 'EXPIRED'],
      default: 'IN_PROGRESS',
      required: true,
      index: true,
    },
    currentSectionIndex: { type: Number, default: 0 },
    sections: [mockSectionConfigSchema],
    answers: [mockAnswerRecordSchema],
    startedAt: { type: Date, required: true, default: Date.now },
    expiresAt: { type: Date, required: true },
    submittedAt: { type: Date },
    scoreSummary: mockScoreSummarySchema,
  },
  { timestamps: true }
);

export const MockTestSession = mongoose.model<IMockTestSession>(
  'MockTestSession',
  mockTestSessionSchema
);
