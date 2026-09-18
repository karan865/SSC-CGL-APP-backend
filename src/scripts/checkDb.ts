import mongoose from 'mongoose';
import { Subject } from '../backend/src/models/Subject';
import { Topic } from '../backend/src/models/Topic';

async function check() {
  await mongoose.connect('mongodb://localhost:27017/ssc_cgl_db');
  const s = await Subject.find().limit(2);
  console.log('Subjects:', s.map(x => ({id: x._id, name: x.name, examId: x.examId})));
  
  const t = await Topic.find().limit(2);
  console.log('Topics:', t.map(x => ({id: x._id, name: x.name, examId: x.examId})));
  
  process.exit(0);
}
check();
