import mongoose, { Schema, Document } from 'mongoose';

export interface IExamStage extends Document {
  examId: mongoose.Types.ObjectId;
  name: string;
  slug: string;
  order: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const examStageSchema = new Schema<IExamStage>(
  {
    examId: { type: Schema.Types.ObjectId, ref: 'Exam', required: true, index: true },
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, trim: true, lowercase: true },
    order: { type: Number, required: true, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Compound uniqueness: a stage slug must be unique within an exam
examStageSchema.index({ examId: 1, slug: 1 }, { unique: true });

// Query sorting index
examStageSchema.index({ examId: 1, isActive: 1, order: 1 });

export const ExamStage = mongoose.model<IExamStage>('ExamStage', examStageSchema);
