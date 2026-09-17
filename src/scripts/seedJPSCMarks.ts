import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { Subject } from '../models/Subject';
import { Topic } from '../models/Topic';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const SUBJECT_MARKS: Record<string, { questionCount: number; marks: number }> = {
  // JPSC General Studies I
  'jpsc-history': { questionCount: 15, marks: 30 },
  'jpsc-geography': { questionCount: 10, marks: 20 },
  'jpsc-polity': { questionCount: 10, marks: 20 },
  'jpsc-economy': { questionCount: 10, marks: 20 },
  'jpsc-science': { questionCount: 15, marks: 30 },
  'jpsc-jharkhand': { questionCount: 10, marks: 20 },
  'jpsc-current-affairs': { questionCount: 15, marks: 30 },
  'jpsc-miscellaneous': { questionCount: 15, marks: 30 },

  // JPSC General Studies II
  'jpsc-p2-tribal-governance': { questionCount: 8, marks: 16 },
  'jpsc-p2-movements-personalities': { questionCount: 7, marks: 14 },
  'jpsc-p2-unique-identity': { questionCount: 5, marks: 10 },
  'jpsc-p2-culture-sports': { questionCount: 5, marks: 10 },
  'jpsc-p2-literature-authors': { questionCount: 5, marks: 10 },
  'jpsc-p2-educational-institutions': { questionCount: 3, marks: 6 },
  'jpsc-p2-sports': { questionCount: 5, marks: 10 },
  'jpsc-p2-land-laws': { questionCount: 12, marks: 24 },
  'jpsc-p2-economic-development': { questionCount: 10, marks: 20 },
  'jpsc-p2-industrial-policies': { questionCount: 6, marks: 12 },
  'jpsc-p2-major-industries': { questionCount: 5, marks: 10 },
  'jpsc-p2-schemes-development': { questionCount: 5, marks: 10 },
  'jpsc-p2-forest-management': { questionCount: 5, marks: 10 },
  'jpsc-p2-environment': { questionCount: 7, marks: 14 },
  'jpsc-p2-disaster-management': { questionCount: 5, marks: 10 },
  'jpsc-p2-current-events': { questionCount: 7, marks: 14 },
};

const TOPIC_MARKS: Record<string, { questionCount: number; marks: number }> = {
  // History of India
  'ancient-india': { questionCount: 5, marks: 10 },
  'medieval-india': { questionCount: 5, marks: 10 },
  'modern-india': { questionCount: 5, marks: 10 },
  
  // Geography of India
  'general-geography': { questionCount: 3, marks: 6 },
  'physical-geography': { questionCount: 3, marks: 6 },
  'economic-geography': { questionCount: 2, marks: 4 },
  'social-demographic-geography': { questionCount: 2, marks: 4 },
  
  // Indian Polity & Governance
  'constitution-of-india': { questionCount: 4, marks: 8 },
  'public-administration-good-governance': { questionCount: 4, marks: 8 },
  'decentralization-panchayats-municipalities': { questionCount: 2, marks: 4 },
  
  // Economy
  'indian-economy-basics': { questionCount: 4, marks: 8 },
  'sustainable-development-economic-issues': { questionCount: 4, marks: 8 },
  'economic-reforms-globalization': { questionCount: 2, marks: 4 },
  
  // Science & Tech
  'general-science': { questionCount: 6, marks: 12 },
  'agriculture-technology-development': { questionCount: 6, marks: 12 },
  'information-communication-technology': { questionCount: 3, marks: 6 },
};

async function run() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) { console.error('No MONGODB_URI'); return; }
  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB.');

  // Update subjects
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

  // Update topics
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
