
const mongoose = require('mongoose');
require('dotenv').config();
async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const Topic = mongoose.model('Topic', new mongoose.Schema({ name: String, examId: mongoose.Schema.Types.ObjectId, subjectId: mongoose.Schema.Types.ObjectId }));
  const Exam = mongoose.model('Exam', new mongoose.Schema({ name: String, slug: String }));
  
  const jpsc = await Exam.findOne({ slug: 'jpsc' });
  const topics = await Topic.find({ examId: jpsc._id });
  console.log(topics.filter(t => t.name.toLowerCase().includes('profit')));
  process.exit(0);
}
run();

