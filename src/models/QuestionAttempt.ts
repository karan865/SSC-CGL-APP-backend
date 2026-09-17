import mongoose, { Schema, Document } from 'mongoose';

export type AttemptSource = 'PRACTICE' | 'MOCK_TEST';

export interface IQuestionAttempt extends Document {
  userId: string;
  examId?: mongoose.Types.ObjectId;
  stageId?: mongoose.Types.ObjectId;
  paperId?: mongoose.Types.ObjectId;
  questionId: mongoose.Types.ObjectId;
  subjectId: mongoose.Types.ObjectId;
  topicId: mongoose.Types.ObjectId;
  selectedAnswer: 'A' | 'B' | 'C' | 'D';
  correctAnswer: 'A' | 'B' | 'C' | 'D';
  isCorrect: boolean;
  marks: number;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  source: AttemptSource;
  sessionId?: string;
  attemptedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const questionAttemptSchema = new Schema<IQuestionAttempt>(
  {
    userId: { type: String, required: true, default: 'guest_default', index: true, trim: true },
    examId: { type: Schema.Types.ObjectId, ref: 'Exam', required: false, index: true },
    stageId: { type: Schema.Types.ObjectId, ref: 'ExamStage', required: false, index: true },
    paperId: { type: Schema.Types.ObjectId, ref: 'ExamPaper', required: false, index: true },
    questionId: { type: Schema.Types.ObjectId, ref: 'Question', required: true, index: true },
    subjectId: { type: Schema.Types.ObjectId, ref: 'Subject', required: true, index: true },
    topicId: { type: Schema.Types.ObjectId, ref: 'Topic', required: true, index: true },
    selectedAnswer: { type: String, enum: ['A', 'B', 'C', 'D'], required: true },
    correctAnswer: { type: String, enum: ['A', 'B', 'C', 'D'], required: true },
    isCorrect: { type: Boolean, required: true, index: true },
    marks: { type: Number, required: true },
    difficulty: { type: String, enum: ['Easy', 'Medium', 'Hard'], required: true, index: true },
    source: { type: String, enum: ['PRACTICE', 'MOCK_TEST'], required: true, default: 'PRACTICE', index: true },
    sessionId: { type: String, index: true },
    attemptedAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true }
);

// Compound indexes for optimal performance aggregations & anti-repetition lookups
questionAttemptSchema.index({ userId: 1, subjectId: 1, topicId: 1, attemptedAt: -1 });
questionAttemptSchema.index({ userId: 1, topicId: 1, questionId: 1 });
questionAttemptSchema.index({ userId: 1, attemptedAt: -1 });
questionAttemptSchema.index({ userId: 1, difficulty: 1 });
questionAttemptSchema.index({ userId: 1, sessionId: 1, questionId: 1 });
questionAttemptSchema.index({ examId: 1, userId: 1, attemptedAt: -1 });

export const QuestionAttempt = mongoose.model<IQuestionAttempt>('QuestionAttempt', questionAttemptSchema);
