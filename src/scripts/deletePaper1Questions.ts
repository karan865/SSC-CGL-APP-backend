import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { Subject } from '../models/Subject';
import { Question } from '../models/Question';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function run() {
  await mongoose.connect(process.env.MONGODB_URI as string);
  console.log('Connected to MongoDB.');

  const subjectSlug = 'jpsc-jharkhand'; 
  const subject = await Subject.findOne({ slug: subjectSlug });
  
  if (!subject) {
    console.error(`Subject not found with slug: ${subjectSlug}`);
    process.exit(1);
  }

  console.log(`Deleting all questions for Subject: ${subject.name} (ID: ${subject._id})`);

  const result = await Question.deleteMany({ subjectId: subject._id });
  
  console.log(`✅ Successfully deleted ${result.deletedCount} questions from the database.`);

  await mongoose.disconnect();
}

run().catch(console.error);
