import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { Subject } from '../models/Subject';
import { Topic } from '../models/Topic';
import { Exam } from '../models/Exam';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function run() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) { console.error('No MONGODB_URI'); return; }
  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB.');

  // Find SSC-CGL exam
  const sscExam = await Exam.findOne({ slug: 'ssc-cgl' });
  if (!sscExam) {
    console.error('SSC-CGL exam not found!');
    process.exit(1);
  }
  console.log(`Found SSC-CGL exam: ${sscExam.name} (${sscExam._id})`);

  // List all SSC subjects
  const sscSubjects = await Subject.find({ examId: sscExam._id, isActive: true }).sort({ order: 1 });
  console.log(`\nFound ${sscSubjects.length} SSC-CGL subjects:`);
  for (const s of sscSubjects) {
    console.log(`  - [${s.slug}] ${s.name} | questionCount=${s.questionCount} marks=${s.marks} marksSpec=${s.marksSpecifiedByPDF} qCountSpec=${s.questionCountSpecifiedByPDF}`);
    const topics = await Topic.find({ subjectId: s._id, isActive: true }).sort({ order: 1 });
    for (const t of topics) {
      console.log(`      - [${t.slug}] ${t.name} | questionCount=${t.questionCount} marks=${t.marks} marksSpec=${t.marksSpecifiedByPDF} qCountSpec=${t.questionCountSpecifiedByPDF}`);
    }
  }

  await mongoose.disconnect();
}

run().catch(console.error);
