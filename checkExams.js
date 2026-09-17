
const mongoose = require('mongoose');
require('dotenv').config();
async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const Exam = mongoose.model('Exam', new mongoose.Schema({ slug: String, isActive: Boolean, isDefault: Boolean }));
  const exams = await Exam.find({});
  console.log(exams);
  process.exit(0);
}
run();

