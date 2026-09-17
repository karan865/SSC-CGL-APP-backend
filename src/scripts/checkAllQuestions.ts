import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Question } from '../models/Question';
import { Subject } from '../models/Subject';
import { Topic } from '../models/Topic';

dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI as string);
  
  const total = await Question.countDocuments();
  console.log(`Total questions in DB: ${total}`);
  
  const recent = await Question.find().sort({ _id: -1 }).limit(5);
  for (const q of recent) {
    console.log(`Question: ${q.questionText}`);
    console.log(`Subject: ${q.subjectId}, Topic: ${q.topicId}`);
  }
  
  await mongoose.disconnect();
}

run();
