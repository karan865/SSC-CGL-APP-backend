
const mongoose = require('mongoose');
require('dotenv').config();
async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const Plan = mongoose.model('DailyStudyPlan', new mongoose.Schema({}, { strict: false }));
  const result = await Plan.deleteMany({ dateKey: '2026-09-17' });
  console.log('Deleted corrupted plans:', result.deletedCount);
  process.exit(0);
}
run();

