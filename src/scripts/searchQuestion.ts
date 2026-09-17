import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Question } from '../models/Question';

dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI as string);
  
  const qs = await Question.find({ questionText: { $regex: /Birsa Ulgulan/i } });
  console.log(`Found ${qs.length} questions matching Birsa Ulgulan.`);
  for (const q of qs) {
    console.log(`ID: ${q._id}, Subject: ${q.subjectId}, Topic: ${q.topicId}`);
  }
  
  await mongoose.disconnect();
}

run();
