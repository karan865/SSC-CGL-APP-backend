import mongoose, { Document, Schema } from 'mongoose';

export interface IMarkedQuestion extends Document {
  questionId: mongoose.Types.ObjectId;
  userSelectedAnswer?: 'A' | 'B' | 'C' | 'D' | null;
  source: 'PRACTICE' | 'MOCK_TEST';
  isMarked: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const markedQuestionSchema = new Schema<IMarkedQuestion>(
  {
    questionId: {
      type: Schema.Types.ObjectId,
      ref: 'Question',
      required: true,
      unique: true,
      index: true,
    },
    userSelectedAnswer: {
      type: String,
      enum: ['A', 'B', 'C', 'D', null],
      default: null,
    },
    source: {
      type: String,
      enum: ['PRACTICE', 'MOCK_TEST'],
      default: 'PRACTICE',
    },
    isMarked: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

export const MarkedQuestion = mongoose.model<IMarkedQuestion>(
  'MarkedQuestion',
  markedQuestionSchema
);
