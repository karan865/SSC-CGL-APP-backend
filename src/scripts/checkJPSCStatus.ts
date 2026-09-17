import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

import { Exam } from '../models/Exam';
import { ExamStage } from '../models/ExamStage';
import { ExamPaper } from '../models/ExamPaper';
import { Subject } from '../models/Subject';
import { Topic } from '../models/Topic';
import { Question } from '../models/Question';

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('No MONGODB_URI found');
    process.exit(1);
  }
  await mongoose.connect(uri);
  console.log('Connected to MongoDB');

  const exams = await Exam.find().lean();
  console.log('Exams in DB:', exams.map(e => ({ id: e._id, name: e.name, slug: e.slug })));

  const jpscExam = exams.find(e => e.slug === 'jpsc');
  if (!jpscExam) {
    console.log('JPSC Exam NOT found in DB!');
  } else {
    console.log('Found JPSC Exam:', jpscExam._id);
    const stages = await ExamStage.find({ examId: jpscExam._id }).lean();
    console.log('JPSC Stages:', stages.map(s => ({ id: s._id, name: s.name, slug: s.slug })));

    const papers = await ExamPaper.find({ examId: jpscExam._id }).lean();
    console.log('JPSC Papers:', papers.map(p => ({ id: p._id, stageId: p.stageId, name: p.name, slug: p.slug, scoring: p.scoring })));

    const subjects = await Subject.find({ examId: jpscExam._id }).lean();
    console.log('JPSC Subjects Count:', subjects.length);
    for (const s of subjects) {
      const topicCount = await Topic.countDocuments({ subjectId: s._id });
      console.log(` - Subject: ${s.name} (slug: ${s.slug}, paperId: ${s.paperId}) -> Topics: ${topicCount}`);
    }

    const qCount = await Question.countDocuments({ examId: jpscExam._id });
    console.log('Existing JPSC Questions Count:', qCount);
  }

  await mongoose.disconnect();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
