import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { Subject } from '../models/Subject';
import { Topic } from '../models/Topic';
import { Question } from '../models/Question';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const NEW_TOPICS = [
  { name: 'Jharkhand History & Movements', slug: 'jpsc-p1-history-movements', targetQuestions: 1000 },
  { name: 'Art, Culture & Heritage', slug: 'jpsc-p1-art-culture', targetQuestions: 1000 },
  { name: 'Tribes & Tribal Society', slug: 'jpsc-p1-tribes', targetQuestions: 1000 },
  { name: 'Geography & Natural Resources', slug: 'jpsc-p1-geography', targetQuestions: 1000 },
  { name: 'Environment & Biodiversity', slug: 'jpsc-p1-environment', targetQuestions: 1000 },
  { name: 'Jharkhand Polity & Administration', slug: 'jpsc-p1-polity', targetQuestions: 1000 },
  { name: 'Economy, Agriculture & Industries', slug: 'jpsc-p1-economy', targetQuestions: 1000 },
  { name: 'District-wise Jharkhand GK', slug: 'jpsc-p1-district-gk', targetQuestions: 1000 },
  { name: 'Tourism, Places & Personalities', slug: 'jpsc-p1-tourism', targetQuestions: 1000 },
  { name: 'Jharkhand Miscellaneous GK', slug: 'jpsc-p1-misc-gk', targetQuestions: 1000 },
];

async function run() {
  await mongoose.connect(process.env.MONGODB_URI as string);
  console.log('Connected to MongoDB.');

  const p1Sub = await Subject.findOne({ slug: 'jpsc-jharkhand' });
  const p2Sub = await Subject.findOne({ slug: 'jpsc-p2-tribal-governance' });

  if (!p1Sub || !p2Sub) {
    console.error('Missing subjects.');
    process.exit(1);
  }

  // Create the 10 new topics
  console.log('Creating new 10 categories...');
  const newTopicDocs = [];
  for (let i = 0; i < NEW_TOPICS.length; i++) {
    const tDef = NEW_TOPICS[i];
    let topic = await Topic.findOne({ slug: tDef.slug, subjectId: p1Sub._id });
    if (!topic) {
      topic = new Topic({
        name: tDef.name,
        slug: tDef.slug,
        subjectId: p1Sub._id,
        examId: p1Sub.examId,
        stageId: p1Sub.stageId,
        paperId: p1Sub.paperId,
        order: i + 1,
        isActive: true,
        targetQuestions: tDef.targetQuestions,
      });
      await topic.save();
    } else {
        topic.targetQuestions = tDef.targetQuestions;
        topic.isActive = true;
        topic.order = i + 1;
        await topic.save();
    }
    newTopicDocs.push(topic);
  }
  
  const getTopicId = (slug: string) => newTopicDocs.find(t => t.slug === slug)!._id;

  // Fetch Old Topics
  const oldHistory = await Topic.findOne({ slug: 'jharkhand-history-culture', subjectId: p1Sub._id });
  const oldGeo = await Topic.findOne({ slug: 'jharkhand-geography-resources', subjectId: p1Sub._id });
  const oldGov = await Topic.findOne({ slug: 'jharkhand-polity-economy', subjectId: p1Sub._id });

  const oldTribalGov1 = await Topic.findOne({ slug: 'munda-nagvanshi-governance', subjectId: p2Sub._id });
  const oldTribalGov2 = await Topic.findOne({ slug: 'padha-panchayat-manjhi', subjectId: p2Sub._id });
  const oldTribalGov3 = await Topic.findOne({ slug: 'munda-manki-dhoklo', subjectId: p2Sub._id });

  console.log('Remapping questions...');
  
  if (oldHistory) {
    await Question.updateMany(
      { topicId: oldHistory._id },
      { $set: { topicId: getTopicId('jpsc-p1-history-movements') } }
    );
    oldHistory.isActive = false;
    await oldHistory.save();
  }

  if (oldGeo) {
    await Question.updateMany(
      { topicId: oldGeo._id },
      { $set: { topicId: getTopicId('jpsc-p1-geography') } }
    );
    oldGeo.isActive = false;
    await oldGeo.save();
  }

  if (oldGov) {
    await Question.updateMany(
      { topicId: oldGov._id },
      { $set: { topicId: getTopicId('jpsc-p1-polity') } }
    );
    oldGov.isActive = false;
    await oldGov.save();
  }

  // Remap Paper 2 questions to Paper 1 -> Tribes & Tribal Society
  const tribesTopicId = getTopicId('jpsc-p1-tribes');
  
  if (oldTribalGov1) {
    await Question.updateMany(
      { topicId: oldTribalGov1._id },
      { $set: { topicId: tribesTopicId, subjectId: p1Sub._id, paperId: p1Sub.paperId } }
    );
    oldTribalGov1.isActive = false;
    await oldTribalGov1.save();
  }
  
  if (oldTribalGov2) {
    await Question.updateMany(
      { topicId: oldTribalGov2._id },
      { $set: { topicId: tribesTopicId, subjectId: p1Sub._id, paperId: p1Sub.paperId } }
    );
    oldTribalGov2.isActive = false;
    await oldTribalGov2.save();
  }

  if (oldTribalGov3) {
    await Question.updateMany(
      { topicId: oldTribalGov3._id },
      { $set: { topicId: tribesTopicId, subjectId: p1Sub._id, paperId: p1Sub.paperId } }
    );
    oldTribalGov3.isActive = false;
    await oldTribalGov3.save();
  }

  console.log('Restructuring complete!');
  await mongoose.disconnect();
}

run().catch(console.error);
