import mongoose, { Schema, Document } from 'mongoose';

export interface ITopic extends Document {
  examId?: mongoose.Types.ObjectId;
  stageId?: mongoose.Types.ObjectId;
  paperId?: mongoose.Types.ObjectId;
  subjectId: mongoose.Types.ObjectId;
  name: string;
  slug: string;
  order: number;
  isActive: boolean;
  targetQuestions?: number;
  questionCount?: number;
  marks?: number;
  marksSpecifiedByPDF: boolean;
  questionCountSpecifiedByPDF: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const topicSchema = new Schema<ITopic>(
  {
    examId: { type: Schema.Types.ObjectId, ref: 'Exam', required: false, index: true },
    stageId: { type: Schema.Types.ObjectId, ref: 'ExamStage', required: false, index: true },
    paperId: { type: Schema.Types.ObjectId, ref: 'ExamPaper', required: false, index: true },
    subjectId: { type: Schema.Types.ObjectId, ref: 'Subject', required: true, index: true },
    name: { type: String, required: true },
    slug: { type: String, required: true },
    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    targetQuestions: { type: Number, required: false },
    questionCount: { type: Number },
    marks: { type: Number },
    marksSpecifiedByPDF: { type: Boolean, default: false },
    questionCountSpecifiedByPDF: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Indexes
topicSchema.index({ subjectId: 1, isActive: 1 });
topicSchema.index({ subjectId: 1, order: 1 });
topicSchema.index({ examId: 1, stageId: 1, paperId: 1, subjectId: 1, isActive: 1, order: 1 });

export const Topic = mongoose.model<ITopic>('Topic', topicSchema);
