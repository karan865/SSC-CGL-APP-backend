import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Question } from '../models/Question';
import { Subject } from '../models/Subject';
import { Topic } from '../models/Topic';

dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI as string);
  const subject = await Subject.findOne({ slug: 'jpsc-jharkhand' });
  const topic = await Topic.findOne({ slug: 'jharkhand-history-culture' });
  
  if (!subject || !topic) {
    console.log('Subject or Topic missing');
    return;
  }
  
  const qCount = await Question.countDocuments({ subjectId: subject._id, topicId: topic._id });
  console.log(`Found ${qCount} questions for subject ${subject.name} and topic ${topic.name}`);
  
  const sample = await Question.findOne({ subjectId: subject._id, topicId: topic._id });
  console.log('Sample question:');
  console.log(JSON.stringify(sample, null, 2));

  await mongoose.disconnect();
}

run();
