
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { getTodayPlan } from './src/services/dailyStudyPlanService';

dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/ssc-cgl-app');
  try {
    const plan = await getTodayPlan('test_user', 'jpsc-cce');
    console.log(JSON.stringify(plan, null, 2));
  } catch (e) {
    console.error('ERROR:', e);
  }
  process.exit(0);
}
run();

