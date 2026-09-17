
const mongoose = require('mongoose');
require('dotenv').config();
async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const Exam = mongoose.model('Exam', new mongoose.Schema({ name: String, slug: String, isActive: Boolean }));
  const exams = await Exam.find({});
  console.log('Exams:', exams.map(e => e.slug));
  process.exit(0);
}
run();

