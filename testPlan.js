
const mongoose = require('mongoose');
const { getTodayPlan } = require('./dist/services/dailyStudyPlanService'); // assuming dist exists
require('dotenv').config();

async function run() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/ssc-cgl-app');
  try {
    const plan = await getTodayPlan('test_user_1', 'jpsc-cce');
    console.log('SUCCESS:', plan.goalQuestions);
  } catch (e) {
    console.log('ERROR:', e.message);
  }
  process.exit(0);
}
run();

