import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { Subject } from '../models/Subject';
import { Topic } from '../models/Topic';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// SSC CGL Tier 1: 4 subjects x 25 Qs x 2 marks = 200 marks total
// SSC CGL Tier 2: Paper 1 has multiple sections/modules

const SUBJECT_MARKS: Record<string, { questionCount: number; marks: number }> = {
  // Tier 1 subjects
  'quantitative-aptitude':    { questionCount: 25, marks: 50 },
  'reasoning':                { questionCount: 25, marks: 50 },
  'english':                  { questionCount: 25, marks: 50 },
  'general-awareness':        { questionCount: 25, marks: 50 },
  // Tier 2 subjects
  'ssc-t2-maths':             { questionCount: 30, marks: 90 },
  'ssc-t2-reasoning':         { questionCount: 30, marks: 90 },
  'ssc-t2-english':           { questionCount: 45, marks: 135 },
  'ssc-t2-ga':                { questionCount: 25, marks: 75 },
  'ssc-t2-computer':          { questionCount: 20, marks: 60 },
};

const TOPIC_MARKS: Record<string, { questionCount: number; marks: number }> = {
  // ── Quantitative Aptitude (Tier 1) topics ──
  'percentage':               { questionCount: 2, marks: 4 },
  'profit-and-loss':          { questionCount: 2, marks: 4 },
  'profit_loss':              { questionCount: 2, marks: 4 },
  'ratio_proportion':         { questionCount: 2, marks: 4 },
  'average':                  { questionCount: 1, marks: 2 },
  'number_system':            { questionCount: 1, marks: 2 },
  'time_work':                { questionCount: 2, marks: 4 },
  'time_speed_distance':      { questionCount: 2, marks: 4 },
  'simple_interest':          { questionCount: 1, marks: 2 },
  'compound_interest':        { questionCount: 1, marks: 2 },
  'algebra':                  { questionCount: 2, marks: 4 },
  'geometry':                 { questionCount: 2, marks: 4 },
  'mensuration':              { questionCount: 2, marks: 4 },
  'trigonometry':             { questionCount: 2, marks: 4 },
  'data_interpretation':      { questionCount: 1, marks: 2 },

  // ── General Intelligence & Reasoning (Tier 1) topics ──
  'analogy-and-classification': { questionCount: 4, marks: 8 },
  'analogy':                  { questionCount: 2, marks: 4 },
  'classification':           { questionCount: 2, marks: 4 },
  'coding_decoding':          { questionCount: 3, marks: 6 },
  'series':                   { questionCount: 3, marks: 6 },
  'blood_relations':          { questionCount: 2, marks: 4 },
  'direction_sense':          { questionCount: 2, marks: 4 },
  'syllogism':                { questionCount: 2, marks: 4 },
  'venn_diagram':             { questionCount: 2, marks: 4 },
  'ranking':                  { questionCount: 2, marks: 4 },
  'missing_number':           { questionCount: 1, marks: 2 },

  // ── English Comprehension (Tier 1) topics ──
  'grammar-and-vocabulary':   { questionCount: 3, marks: 6 },
  'error_spotting':           { questionCount: 2, marks: 4 },
  'idioms_phrases':           { questionCount: 2, marks: 4 },
  'one_word_substitution':    { questionCount: 2, marks: 4 },
  'synonyms_antonyms':        { questionCount: 2, marks: 4 },
  'sentence_improvement':     { questionCount: 2, marks: 4 },
  'active_passive':           { questionCount: 2, marks: 4 },
  'direct_indirect':          { questionCount: 2, marks: 4 },
  'fill_blanks':              { questionCount: 2, marks: 4 },
  'cloze_test':               { questionCount: 2, marks: 4 },
  'reading_comprehension':    { questionCount: 4, marks: 8 },

  // ── General Awareness (Tier 1) topics ──
  'polity-and-history':       { questionCount: 4, marks: 8 },
  'polity':                   { questionCount: 3, marks: 6 },
  'history':                  { questionCount: 3, marks: 6 },
  'geography':                { questionCount: 3, marks: 6 },
  'economics':                { questionCount: 3, marks: 6 },
  'general_science':          { questionCount: 5, marks: 10 },
  'static_gk':                { questionCount: 4, marks: 8 },
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
    } else {
      console.log(`⚠️ Subject [${slug}]: no documents matched`);
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
    } else {
      console.log(`⚠️ Topic [${slug}]: no documents matched`);
    }
  }

  console.log(`\n🎯 Total: ${subjectUpdated} subjects updated, ${topicUpdated} topics updated.`);

  await mongoose.disconnect();
}

run().catch(console.error);
