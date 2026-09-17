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

const Subject = mongoose.models.Subject || mongoose.model('Subject', subjectSchema);

const NEW_SUBJECT_MARKS = {
  // JPSC General Studies I
  'prelims-gs1-history': { questionCount: 15, marks: 30 },
  'prelims-gs1-geography': { questionCount: 10, marks: 20 },
  'prelims-gs1-polity': { questionCount: 10, marks: 20 },
  'prelims-gs1-economy': { questionCount: 10, marks: 20 },
  'prelims-gs1-science': { questionCount: 15, marks: 30 },
  'prelims-gs1-jharkhand': { questionCount: 10, marks: 20 },
  'prelims-gs1-current': { questionCount: 15, marks: 30 },
  'prelims-gs1-misc': { questionCount: 15, marks: 30 },

  // JPSC General Studies II
  'prelims-gs2-history': { questionCount: 8, marks: 16 },
  'prelims-gs2-movement': { questionCount: 7, marks: 14 },
  'prelims-gs2-identity': { questionCount: 5, marks: 10 },
  'prelims-gs2-folk': { questionCount: 5, marks: 10 },
  'prelims-gs2-literature': { questionCount: 5, marks: 10 },
  'prelims-gs2-educational': { questionCount: 3, marks: 6 },
  'prelims-gs2-sports': { questionCount: 5, marks: 10 },
  'prelims-gs2-land-laws': { questionCount: 12, marks: 24 },
  'prelims-gs2-econ-dev': { questionCount: 10, marks: 20 },
  'prelims-gs2-industrial-policies': { questionCount: 6, marks: 12 },
  'prelims-gs2-industries': { questionCount: 5, marks: 10 },
  'prelims-gs2-schemes': { questionCount: 5, marks: 10 },
  'prelims-gs2-forest': { questionCount: 5, marks: 10 },
  'prelims-gs2-env': { questionCount: 7, marks: 14 },
  'prelims-gs2-disaster': { questionCount: 5, marks: 10 },
  'prelims-gs2-current': { questionCount: 7, marks: 14 },
};

async function run() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) { console.error('No MONGODB_URI'); return; }
  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB.');

  // 1. Deactivate old subjects
  const oldSlugs = [
    'jpsc-history', 'jpsc-geography', 'jpsc-polity', 'jpsc-economy', 
    'jpsc-science', 'jpsc-jharkhand', 'jpsc-current-affairs', 'jpsc-miscellaneous',
    'mains-p3-history', 'mains-p3-geography', 'mains-p4-polity', 'mains-p4-pubad'
  ];
  
  const deactRes = await Subject.updateMany(
    { slug: { $in: oldSlugs } },
    { $set: { isActive: false } }
  );
  console.log(`Deactivated ${deactRes.modifiedCount} old JPSC subjects.`);

  // 2. Set marks on new subjects
  let subjectUpdated = 0;
  for (const [slug, data] of Object.entries(NEW_SUBJECT_MARKS)) {
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
      console.log(`✅ Subject [${slug}]: set ${data.questionCount} Qs • ${data.marks} Marks`);
      subjectUpdated += result.modifiedCount;
    } else {
      console.log(`⚠️ Subject [${slug}] NOT found or not active.`);
    }
  }

  console.log(`\n🎯 Total: ${subjectUpdated} new subjects updated.`);
  await mongoose.disconnect();
}

run().catch(console.error);
