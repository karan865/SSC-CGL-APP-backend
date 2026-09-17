
const mongoose = require('mongoose');
require('dotenv').config();
async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const Topic = mongoose.model('Topic', new mongoose.Schema({ name: String, examId: mongoose.Schema.Types.ObjectId }));
  const Exam = mongoose.model('Exam', new mongoose.Schema({ slug: String }));
  
  const jpsc = await Exam.findOne({ slug: 'jpsc' });
  const topics = await Topic.find({ examId: jpsc._id });
  console.log('JPSC Topics:', topics.map(t => t.name).join(', '));
  process.exit(0);
}
run();

