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
  
  const q = new Question({
        subjectId: subject._id,
        topicId: topic._id,
        examId: subject.examId,
        stageId: subject.stageId,
        paperId: subject.paperId,
        questionType: 'PRACTICE',
        sourceType: 'USER_SUBMITTED',
        qaStatus: 'VERIFIED',
        isActive: true,
        
        questionText: 'qEng',
        questionText_hi: 'qHi',
        
        optionA: 'oAe',
        optionB: 'oBe',
        optionC: 'oCe',
        optionD: 'oDe',
        
        optionA_hi: 'oAh',
        optionB_hi: 'oBh',
        optionC_hi: 'oCh',
        optionD_hi: 'oDh',
        
        correctAnswer: 'A',
        
        explanation: 'expEngMatch',
        explanation_hi: 'expHiMatch',
        
        difficulty: 'Medium'
  });
  try {
    await q.save();
    console.log('Saved successfully!');
  } catch (err: any) {
    console.error('Validation error:', err.message);
  }

  await mongoose.disconnect();
}

run();
