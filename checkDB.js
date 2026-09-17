require('dotenv').config();
const mongoose = require('mongoose');
const Question = require('./dist/models/Question').Question;

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const q = await Question.findOne({ topicSlug: 'prelims-gs1-jh-gk' }); // Wait, topicSlug doesn't exist on questions directly!
  // Find by exam
  const qs = await Question.find({ isActive: true }).sort({ _id: -1 }).limit(1);
  if (qs.length) {
      console.log('Q Eng:', qs[0].questionText.substring(0, 50));
      console.log('Q Hi:', qs[0].questionText_hi.substring(0, 50));
  }
  await mongoose.disconnect();
}
run().catch(console.error);
