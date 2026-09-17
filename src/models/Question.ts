import mongoose, { Schema, Document } from 'mongoose';

export type QuestionType =
  | 'PYQ'
  | 'PYQ_INSPIRED'
  | 'SAMPLE_PAPER'
  | 'RELATED_PRACTICE'
  | 'PRACTICE'
  | 'MODEL'
  | 'CURRENT_AFFAIRS';

export type SourceType =
  | 'OFFICIAL_PYQ'
  | 'INTERNAL'
  | 'REFERENCE_BOOK'
  | 'EXAM_MEMORY'
  | string;

export type QAStatus = 'DRAFT' | 'REVIEW' | 'VERIFIED' | 'REJECTED';

export interface IQuestion extends Document {
  examId?: mongoose.Types.ObjectId;
  stageId?: mongoose.Types.ObjectId;
  paperId?: mongoose.Types.ObjectId;
  subjectId: mongoose.Types.ObjectId;
  topicId: mongoose.Types.ObjectId;
  questionText: string;
  questionText_hi?: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  optionA_hi?: string;
  optionB_hi?: string;
  optionC_hi?: string;
  optionD_hi?: string;
  correctAnswer: 'A' | 'B' | 'C' | 'D';
  explanation: string;
  explanation_hi?: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  questionType?: QuestionType;
  sourceType?: SourceType;
  qaStatus?: QAStatus;
  year?: number;
  sourceYear?: number;
  sourceDate?: Date;
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
    examId: { type: Schema.Types.ObjectId, ref: 'Exam', required: false },
    stageId: { type: Schema.Types.ObjectId, ref: 'ExamStage', required: false },
    paperId: { type: Schema.Types.ObjectId, ref: 'ExamPaper', required: false },
    subjectId: { type: Schema.Types.ObjectId, ref: 'Subject', required: true },
    topicId: { type: Schema.Types.ObjectId, ref: 'Topic', required: true },
    questionText: { type: String, required: true },
    questionText_hi: { type: String, required: false },
    optionA: { type: String, required: true },
    optionB: { type: String, required: true },
    optionC: { type: String, required: true },
    optionD: { type: String, required: true },
    optionA_hi: { type: String, required: false },
    optionB_hi: { type: String, required: false },
    optionC_hi: { type: String, required: false },
    optionD_hi: { type: String, required: false },
    correctAnswer: { type: String, enum: ['A', 'B', 'C', 'D'], required: true },
    explanation: { type: String, required: true },
    explanation_hi: { type: String, required: false },
    difficulty: { type: String, enum: ['Easy', 'Medium', 'Hard'], required: true },
    questionType: {
      type: String,
      enum: ['PYQ', 'PYQ_INSPIRED', 'SAMPLE_PAPER', 'RELATED_PRACTICE', 'PRACTICE', 'MODEL', 'CURRENT_AFFAIRS'],
      default: 'PYQ_INSPIRED',
    },
    sourceType: {
      type: String,
      default: 'INTERNAL',
    },
    qaStatus: {
      type: String,
      enum: ['DRAFT', 'REVIEW', 'VERIFIED', 'REJECTED'],
      default: 'VERIFIED',
    },
    year: { type: Number },
    sourceYear: { type: Number },
    sourceDate: { type: Date },
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

// Multi-exam query indexes
questionSchema.index({ examId: 1, isActive: 1 });
questionSchema.index({
  examId: 1,
  stageId: 1,
  paperId: 1,
  subjectId: 1,
  topicId: 1,
  difficulty: 1,
  isActive: 1,
});

export const Question = mongoose.model<IQuestion>('Question', questionSchema);
