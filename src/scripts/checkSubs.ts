import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { ExamPaper as Paper } from '../models/ExamPaper';
import { Subject } from '../models/Subject';
import { Question } from '../models/Question';
dotenv.config();

mongoose.connect(process.env.MONGODB_URI as string).then(async () => {
  const gs1 = await Paper.findOne({ name: 'General Studies I', isActive: true });
  if (!gs1) {
    console.log('General Studies I not found!');
    process.exit(1);
  }

  console.log(`\n--- Paper: ${gs1.name} ---`);
  const subs = await Subject.find({ paperId: gs1._id, isActive: true });
  
  for (const sub of subs) {
    const qs = await Question.countDocuments({ subjectId: sub._id });
    console.log(`- ${sub.name} | Slug: ${sub.slug} | Qs: ${qs}`);
  }

  process.exit(0);
});
