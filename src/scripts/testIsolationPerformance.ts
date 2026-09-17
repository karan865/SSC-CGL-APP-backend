import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();
import { getUserPerformance, getRecommendedPractice } from '../services/performanceService';

async function testIsolation() {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/ssc-cgl-app';
  await mongoose.connect(uri);
  
  console.log('--- Testing SSC-CGL Performance & Recommendations ---');
  const sscPerf = await getUserPerformance('guest_default', 'ssc-cgl');
  console.log(`SSC Attempted: ${sscPerf.totalAttempted}`);
  console.log(`SSC Subjects count: ${sscPerf.subjects.length}`);
  console.log(`SSC Weak topics: ${sscPerf.weakTopics.map((w) => w.topicName).join(', ') || 'None'}`);
  const sscRec = await getRecommendedPractice('guest_default', 3, 'ssc-cgl');
  console.log(`SSC Rec: [${sscRec.subjectName}] -> ${sscRec.topicName} | "${sscRec.reason}"`);

  console.log('\n--- Testing JPSC Performance & Recommendations ---');
  const jpscPerf = await getUserPerformance('guest_default', 'jpsc');
  console.log(`JPSC Attempted: ${jpscPerf.totalAttempted}`);
  console.log(`JPSC Subjects count: ${jpscPerf.subjects.length}`);
  console.log(`JPSC Weak topics: ${jpscPerf.weakTopics.map((w) => w.topicName).join(', ') || 'None'}`);
  const jpscRec = await getRecommendedPractice('guest_default', 3, 'jpsc');
  console.log(`JPSC Rec: [${jpscRec.subjectName}] -> ${jpscRec.topicName} | "${jpscRec.reason}"`);

  await mongoose.disconnect();
}

testIsolation()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
