
const mongoose = require('mongoose');
require('dotenv').config();
async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const Rev = mongoose.model('QuestionRevision', new mongoose.Schema({ userId: String, examId: mongoose.Schema.Types.ObjectId, topicId: mongoose.Schema.Types.ObjectId }));
  const Topic = mongoose.model('Topic', new mongoose.Schema({ name: String }));
  const Exam = mongoose.model('Exam', new mongoose.Schema({ slug: String }));
  
  const jpsc = await Exam.findOne({ slug: 'jpsc' });
  const revs = await Rev.find({ examId: jpsc._id });
  for (const r of revs) {
    const t = await Topic.findById(r.topicId);
    console.log('Rev topic:', t ? t.name : 'null');
  }
  process.exit(0);
}
run();

