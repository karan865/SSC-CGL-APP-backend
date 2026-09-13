import mongoose, { Schema, Document } from 'mongoose';

export type QuestionType = 'PYQ' | 'PYQ_INSPIRED' | 'SAMPLE_PAPER' | 'RELATED_PRACTICE';
export type SourceType = 'OFFICIAL_PYQ' | 'INTERNAL' | 'REFERENCE_BOOK' | 'EXAM_MEMORY';
export type QAStatus = 'DRAFT' | 'REVIEW' | 'VERIFIED' | 'REJECTED';

export interface IQuestion extends Document {
  subjectId: mongoose.Types.ObjectId;
  topicId: mongoose.Types.ObjectId;
  questionText: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctAnswer: 'A' | 'B' | 'C' | 'D';
  explanation: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  questionType?: QuestionType;
  sourceType?: SourceType;
  qaStatus?: QAStatus;
  year?: number;
  exam?: string;
  tier?: number;
  shift?: string;
  source?: string;
  sourceUrl?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const questionSchema = new Schema<IQuestion>(
  {
    subjectId: { type: Schema.Types.ObjectId, ref: 'Subject', required: true },
    topicId: { type: Schema.Types.ObjectId, ref: 'Topic', required: true },
    questionText: { type: String, required: true },
    optionA: { type: String, required: true },
    optionB: { type: String, required: true },
    optionC: { type: String, required: true },
    optionD: { type: String, required: true },
    correctAnswer: { type: String, enum: ['A', 'B', 'C', 'D'], required: true },
    explanation: { type: String, required: true },
    difficulty: { type: String, enum: ['Easy', 'Medium', 'Hard'], required: true },
    questionType: {
      type: String,
      enum: ['PYQ', 'PYQ_INSPIRED', 'SAMPLE_PAPER', 'RELATED_PRACTICE'],
      default: 'PYQ_INSPIRED',
    },
    sourceType: {
      type: String,
      enum: ['OFFICIAL_PYQ', 'INTERNAL', 'REFERENCE_BOOK', 'EXAM_MEMORY'],
      default: 'INTERNAL',
    },
    qaStatus: {
      type: String,
      enum: ['DRAFT', 'REVIEW', 'VERIFIED', 'REJECTED'],
      default: 'VERIFIED',
    },
    year: { type: Number },
    exam: { type: String },
    tier: { type: Number },
    shift: { type: String },
    source: { type: String },
    sourceUrl: { type: String },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Indexes
questionSchema.index({ subjectId: 1 });
questionSchema.index({ topicId: 1 });
questionSchema.index({ difficulty: 1 });
questionSchema.index({ isActive: 1 });
questionSchema.index({ qaStatus: 1 });
questionSchema.index({ questionType: 1 });
questionSchema.index({ subjectId: 1, topicId: 1, difficulty: 1, isActive: 1 });

export const Question = mongoose.model<IQuestion>('Question', questionSchema);
