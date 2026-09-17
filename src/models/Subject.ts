import mongoose, { Schema, Document } from 'mongoose';

export interface ISubject extends Document {
  examId?: mongoose.Types.ObjectId;
  stageId?: mongoose.Types.ObjectId;
  paperId?: mongoose.Types.ObjectId;
  name: string;
  slug: string;
  description?: string;
  order: number;
  isActive: boolean;
  questionCount?: number;
  marks?: number;
  marksPerQuestion?: number;
  totalMarks?: number;
  marksSpecifiedByPDF: boolean;
  questionCountSpecifiedByPDF: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const subjectSchema = new Schema<ISubject>(
  {
    examId: { type: Schema.Types.ObjectId, ref: 'Exam', required: false, index: true },
    stageId: { type: Schema.Types.ObjectId, ref: 'ExamStage', required: false, index: true },
    paperId: { type: Schema.Types.ObjectId, ref: 'ExamPaper', required: false, index: true },
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    description: { type: String },
    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    questionCount: { type: Number },
    marks: { type: Number },
    marksPerQuestion: { type: Number },
    totalMarks: { type: Number },
    marksSpecifiedByPDF: { type: Boolean, default: false },
    questionCountSpecifiedByPDF: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Indexes
subjectSchema.index({ examId: 1, stageId: 1, paperId: 1, isActive: 1, order: 1 });

export const Subject = mongoose.model<ISubject>('Subject', subjectSchema);
