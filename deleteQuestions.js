require('dotenv').config();
const mongoose = require('mongoose');
const Question = require('./dist/models/Question').Question;
const Topic = require('./dist/models/Topic').Topic;

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  
  const topic = await Topic.findOne({ slug: 'prelims-gs1-jh-gk' });
  
  if (topic) {
      const result = await Question.deleteMany({ topicId: topic._id });
      console.log('Deleted questions:', result.deletedCount);
  } else {
      console.log('Could not find topic.');
  }
  
  await mongoose.disconnect();
}
run().catch(console.error);
