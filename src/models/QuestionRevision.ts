import mongoose, { Schema, Document } from 'mongoose';

export type RevisionStatus = 'DUE' | 'SCHEDULED' | 'MASTERED';

export interface IQuestionRevision extends Document {
  userId: string;
  questionId: mongoose.Types.ObjectId;
  subjectId: mongoose.Types.ObjectId;
  topicId: mongoose.Types.ObjectId;
  status: RevisionStatus;
  revisionLevel: number;
  nextRevisionAt: Date;
  lastAttemptAt: Date;
  totalRevisionAttempts: number;
  correctRevisionAttempts: number;
  wrongRevisionAttempts: number;
  lastRevisionCorrect: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const questionRevisionSchema = new Schema<IQuestionRevision>(
  {
    userId: { type: String, required: true, default: 'guest_default', index: true, trim: true },
    questionId: { type: Schema.Types.ObjectId, ref: 'Question', required: true, index: true },
    subjectId: { type: Schema.Types.ObjectId, ref: 'Subject', required: true, index: true },
    topicId: { type: Schema.Types.ObjectId, ref: 'Topic', required: true, index: true },
    status: {
      type: String,
      enum: ['DUE', 'SCHEDULED', 'MASTERED'],
      required: true,
      default: 'SCHEDULED',
      index: true,
    },
    revisionLevel: { type: Number, required: true, default: 1, min: 1, max: 5 },
    nextRevisionAt: { type: Date, required: true, index: true },
    lastAttemptAt: { type: Date, default: Date.now },
    totalRevisionAttempts: { type: Number, default: 0 },
    correctRevisionAttempts: { type: Number, default: 0 },
    wrongRevisionAttempts: { type: Number, default: 0 },
    lastRevisionCorrect: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Enforce unique revision item per user per question
questionRevisionSchema.index({ userId: 1, questionId: 1 }, { unique: true });

// Compound indexes for optimal due revisions and stats lookups
questionRevisionSchema.index({ userId: 1, status: 1, nextRevisionAt: 1 });
questionRevisionSchema.index({ userId: 1, nextRevisionAt: 1 });
questionRevisionSchema.index({ userId: 1, topicId: 1, nextRevisionAt: 1 });

export const QuestionRevision = mongoose.model<IQuestionRevision>(
  'QuestionRevision',
  questionRevisionSchema
);
