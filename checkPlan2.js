
const mongoose = require('mongoose');
require('dotenv').config();
async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const Plan = mongoose.model('DailyStudyPlan', new mongoose.Schema({ userId: String, dateKey: String, examId: mongoose.Schema.Types.ObjectId, items: [Object] }));
  const Exam = mongoose.model('Exam', new mongoose.Schema({ slug: String }));
  
  const jpsc = await Exam.findOne({ slug: 'jpsc' });
  const plans = await Plan.find({ examId: jpsc._id, dateKey: '2026-09-17' });
  console.log('Found JPSC Plans:', plans.length);
  for (const p of plans) {
    console.log('Items:', p.items.map(i => i.topicName || i.title));
  }
  process.exit(0);
}
run();

