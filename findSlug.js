require('dotenv').config();
const mongoose = require('mongoose');
const Subject = require('./dist/models/Subject').Subject;
const Topic = require('./dist/models/Topic').Topic;

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const subjects = await Subject.find({ slug: /jpsc/i, isActive: true });
  for (const s of subjects) {
    if (s.name.toLowerCase().includes('jharkhand-specific awareness')) {
       console.log('Subject:', s.name, s.slug);
       const topics = await Topic.find({ subjectId: s._id, isActive: true });
       for (const t of topics) {
         console.log('  Topic:', t.name, t.slug);
       }
    }
  }
  await mongoose.disconnect();
}
run().catch(console.error);
