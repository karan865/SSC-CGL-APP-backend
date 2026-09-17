
const mongoose = require('mongoose');
require('dotenv').config();
async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const Topic = mongoose.model('Topic', new mongoose.Schema({ name: String, examId: mongoose.Schema.Types.ObjectId, subjectId: mongoose.Schema.Types.ObjectId }));
  const Exam = mongoose.model('Exam', new mongoose.Schema({ name: String, slug: String }));
  const Subject = mongoose.model('Subject', new mongoose.Schema({ name: String }));
  
  const jpsc = await Exam.findOne({ slug: 'jpsc' });
  console.log('JPSC Exam ID:', jpsc ? jpsc._id : 'not found');
  
  const topics = await Topic.find({ name: /Profit and Loss/i });
  for (const t of topics) {
    const s = await Subject.findById(t.subjectId);
    const e = await Exam.findById(t.examId);
    console.log('Topic:', t.name, '| Exam:', e ? e.slug : 'null', '| Subject:', s ? s.name : 'null');
  }
  process.exit(0);
}
run();

