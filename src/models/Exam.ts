import mongoose, { Schema, Document } from 'mongoose';

export interface IExam extends Document {
  name: string;
  slug: string;
  description?: string;
  icon?: string;
  order: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const examSchema = new Schema<IExam>(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, trim: true, lowercase: true },
    description: { type: String, trim: true },
    icon: { type: String, trim: true },
    order: { type: Number, required: true, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Indexes
examSchema.index({ isActive: 1, order: 1 });

export const Exam = mongoose.model<IExam>('Exam', examSchema);
