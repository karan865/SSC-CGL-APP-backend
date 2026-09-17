const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const { Schema } = mongoose;

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const subjectSchema = new Schema({
  slug: { type: String, required: true },
  isActive: { type: Boolean, default: true },
  questionCount: { type: Number },
  marks: { type: Number },
  marksSpecifiedByPDF: { type: Boolean, default: false },
  questionCountSpecifiedByPDF: { type: Boolean, default: false },
});

const topicSchema = new Schema({
  slug: { type: String, required: true },
  isActive: { type: Boolean, default: true },
  questionCount: { type: Number },
  marks: { type: Number },
  marksSpecifiedByPDF: { type: Boolean, default: false },
  questionCountSpecifiedByPDF: { type: Boolean, default: false },
});

const Subject = mongoose.models.Subject || mongoose.model('Subject', subjectSchema);
const Topic = mongoose.models.Topic || mongoose.model('Topic', topicSchema);

const SUBJECT_MARKS = {
  // JPSC General Studies I
  'jpsc-history': { questionCount: 15, marks: 30 },
  'jpsc-geography': { questionCount: 10, marks: 20 },
  'jpsc-polity': { questionCount: 10, marks: 20 },
  'jpsc-economy': { questionCount: 10, marks: 20 },
  'jpsc-science': { questionCount: 15, marks: 30 },
  'jpsc-jharkhand': { questionCount: 10, marks: 20 },
  'jpsc-current-affairs': { questionCount: 15, marks: 30 },
  'jpsc-miscellaneous': { questionCount: 15, marks: 30 },
};

const TOPIC_MARKS = {
  // History of India
  'ancient-india': { questionCount: 5, marks: 10 },
  'medieval-india': { questionCount: 5, marks: 10 },
  'modern-india': { questionCount: 5, marks: 10 },
};

async function run() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) { console.error('No MONGODB_URI'); return; }
  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB.');

  let subjectUpdated = 0;
  for (const [slug, data] of Object.entries(SUBJECT_MARKS)) {
    const result = await Subject.updateMany(
      { slug, isActive: true },
      {
        $set: {
          questionCount: data.questionCount,
          marks: data.marks,
          marksSpecifiedByPDF: true,
          questionCountSpecifiedByPDF: true,
        },
      }
    );
    if (result.modifiedCount > 0) {
      console.log(`✅ Subject [${slug}]: set ${data.questionCount} Qs • ${data.marks} Marks (${result.modifiedCount} updated)`);
      subjectUpdated += result.modifiedCount;
    }
  }

  let topicUpdated = 0;
  for (const [slug, data] of Object.entries(TOPIC_MARKS)) {
    const result = await Topic.updateMany(
      { slug, isActive: true },
      {
        $set: {
          questionCount: data.questionCount,
          marks: data.marks,
          marksSpecifiedByPDF: true,
          questionCountSpecifiedByPDF: true,
        },
      }
    );
    if (result.modifiedCount > 0) {
      console.log(`✅ Topic [${slug}]: set ${data.questionCount} Qs • ${data.marks} Marks (${result.modifiedCount} updated)`);
      topicUpdated += result.modifiedCount;
    }
  }

  console.log(`\n🎯 Total: ${subjectUpdated} subjects updated, ${topicUpdated} topics updated.`);
  await mongoose.disconnect();
}

run().catch(console.error);
