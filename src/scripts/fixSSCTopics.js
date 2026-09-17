const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const { Schema } = mongoose;

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function run() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) { console.error('No MONGODB_URI'); return; }
  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB.');
  
  const db = mongoose.connection.db;
  
  // 1. Merge Percentage topics
  const perc1 = await db.collection('topics').findOne({ _id: new mongoose.Types.ObjectId('6a948159a153bbfaa28534c9') });
  const perc2 = await db.collection('topics').findOne({ _id: new mongoose.Types.ObjectId('6a9c6bccd31fb7f0b305e066') });
  
  if (perc1 && perc2) {
    console.log('Merging percentage topics...');
    await db.collection('questions').updateMany(
      { topicId: perc2._id },
      { $set: { topicId: perc1._id } }
    );
    await db.collection('topics').deleteOne({ _id: perc2._id });
  }

  // 2. Merge Profit & Loss topics
  const pl1 = await db.collection('topics').findOne({ _id: new mongoose.Types.ObjectId('6a9c62150374b877646bca26') });
  const pl2 = await db.collection('topics').findOne({ _id: new mongoose.Types.ObjectId('6a9c6bccd31fb7f0b305e067') });
  
  if (pl1 && pl2) {
    console.log('Merging profit & loss topics...');
    await db.collection('questions').updateMany(
      { topicId: pl2._id },
      { $set: { topicId: pl1._id } }
    );
    await db.collection('topics').deleteOne({ _id: pl2._id });
  }

  // 3. Fix Marks for Quantitative Aptitude
  const quantMarks = {
    'percentage': { q: 1, m: 2 },
    'ratio_proportion': { q: 1, m: 2 },
    'profit-and-loss': { q: 2, m: 4 },
    'profit_loss': { q: 2, m: 4 }, // Just in case
    'average': { q: 1, m: 2 },
    'number_system': { q: 1, m: 2 },
    'time_work': { q: 1, m: 2 },
    'time_speed_distance': { q: 1, m: 2 },
    'simple_interest': { q: 1, m: 2 },
    'compound_interest': { q: 1, m: 2 },
    'algebra': { q: 3, m: 6 },
    'geometry': { q: 4, m: 8 },
    'mensuration': { q: 3, m: 6 },
    'trigonometry': { q: 3, m: 6 },
    'data_interpretation': { q: 2, m: 4 }
  };
  
  const sub = await db.collection('subjects').findOne({ slug: 'quantitative-aptitude' });
  if (sub) {
    let totalQ = 0;
    for (const [slug, data] of Object.entries(quantMarks)) {
      await db.collection('topics').updateMany(
        { subjectId: sub._id, slug: slug },
        { $set: { questionCount: data.q, marks: data.m, targetQuestions: data.q } }
      );
    }
  }

  console.log('Done fixing SSC CGL topics!');
  await mongoose.disconnect();
}

run().catch(console.error);
