import mongoose, { Schema, Document } from 'mongoose';

export interface IExamPaperScoring {
  correctMarks: number;
  wrongMarks: number;
  unansweredMarks: number;
}

export interface IExamPaper extends Document {
  examId: mongoose.Types.ObjectId;
  stageId: mongoose.Types.ObjectId;
  name: string;
  slug: string;
  order: number;
  totalQuestions?: number;
  totalMarks?: number;
  durationMinutes?: number;
  scoring?: IExamPaperScoring;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const examPaperSchema = new Schema<IExamPaper>(
  {
    examId: { type: Schema.Types.ObjectId, ref: 'Exam', required: true, index: true },
    stageId: { type: Schema.Types.ObjectId, ref: 'ExamStage', required: true, index: true },
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, trim: true, lowercase: true },
    order: { type: Number, required: true, default: 0 },
    totalQuestions: { type: Number },
    totalMarks: { type: Number },
    durationMinutes: { type: Number },
    scoring: {
      correctMarks: { type: Number, default: 2 },
      wrongMarks: { type: Number, default: 0 },
      unansweredMarks: { type: Number, default: 0 },
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Compound uniqueness: a paper slug must be unique within a stage
examPaperSchema.index({ stageId: 1, slug: 1 }, { unique: true });

// Query sorting index
examPaperSchema.index({ examId: 1, stageId: 1, isActive: 1, order: 1 });

export const ExamPaper = mongoose.model<IExamPaper>('ExamPaper', examPaperSchema);
