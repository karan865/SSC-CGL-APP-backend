require('dotenv').config();
const mongoose = require('mongoose');
const Subject = require('./dist/models/Subject').Subject;
const Topic = require('./dist/models/Topic').Topic;
const Exam = require('./dist/models/Exam').Exam;

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const jpsc = await Exam.findOne({ slug: 'jpsc-cce' });
  if(!jpsc) return;
  const subjects = await Subject.find({ examId: jpsc._id, isActive: true }).sort({ order: 1 });
  for(const sub of subjects) {
    console.log('\n## ' + sub.name);
    const topics = await Topic.find({ subjectId: sub._id, isActive: true }).sort({ order: 1 });
    for(const t of topics) {
      console.log('- ' + t.name);
    }
  }
  await mongoose.disconnect();
}
run().catch(console.error);
