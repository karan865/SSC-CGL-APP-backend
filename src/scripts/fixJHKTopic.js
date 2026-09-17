const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function run() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) return;
  await mongoose.connect(mongoUri);
  
  const db = mongoose.connection.db;
  const topic = await db.collection('topics').findOne({ slug: 'prelims-gs1-jh-gk' });
  if (topic) {
    await db.collection('topics').updateOne(
      { _id: topic._id },
      { $set: { questionCount: 10, marks: 20, questionCountSpecifiedByPDF: true, marksSpecifiedByPDF: true } }
    );
    console.log('Fixed topic:', topic.name);
  } else {
    console.log('Topic not found!');
  }
  process.exit(0);
}

run().catch(console.error);
