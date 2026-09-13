import mongoose, { Schema, Document } from 'mongoose';

export interface ITopic extends Document {
  subjectId: mongoose.Types.ObjectId;
  name: string;
  slug: string;
  order: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const topicSchema = new Schema<ITopic>(
  {
    subjectId: { type: Schema.Types.ObjectId, ref: 'Subject', required: true },
    name: { type: String, required: true },
    slug: { type: String, required: true },
    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Add useful indexes
topicSchema.index({ subjectId: 1, isActive: 1 });
topicSchema.index({ subjectId: 1, order: 1 }); // For querying and sorting

export const Topic = mongoose.model<ITopic>('Topic', topicSchema);
