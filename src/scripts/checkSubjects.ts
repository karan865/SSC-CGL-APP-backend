import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Subject } from '../models/Subject';
import { Exam } from '../models/Exam';

dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI as string);
  
  const subjects = await Subject.find({ slug: 'jpsc-jharkhand' });
  console.log(`Found ${subjects.length} subjects with slug jpsc-jharkhand`);
  
  for (const s of subjects) {
    const exam = await Exam.findById(s.examId);
    console.log(`Subject ID: ${s._id}, Exam: ${exam ? exam.name : 'Unknown'}, ExamID: ${s.examId}, Active: ${s.isActive}`);
  }
  
  await mongoose.disconnect();
}

run();
