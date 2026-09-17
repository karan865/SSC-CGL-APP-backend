import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import OpenAI from 'openai';
import { Question } from '../models/Question';
import { Subject } from '../models/Subject';
import { Topic } from '../models/Topic';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!OPENAI_API_KEY) {
  console.error('ERROR: OPENAI_API_KEY is not defined in your .env file!');
  console.error('Please get an API key from https://platform.openai.com/api-keys and add it to backend/.env');
  process.exit(1);
}

const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
});

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function generateQuestionsForTopic(subjectName: string, topicName: string, count: number): Promise<any[]> {
  const prompt = `
You are an expert exam content creator for Indian competitive exams like SSC CGL and JPSC.
Create ${count} unique, high-quality, and highly accurate multiple-choice questions for the subject "${subjectName}" and the specific topic "${topicName}".

Requirements:
1. Provide the exact JSON format specified below.
2. The questions MUST be strictly related to "${topicName}".
3. Provide realistic, non-obvious options.
4. Each question must have both English and Hindi translations for ALL fields (Question, Options A/B/C/D, Explanation).
5. The explanation should be detailed and educational.
6. Difficulty should be a mix of 'Easy', 'Medium', and 'Hard'.
7. Provide the correct answer exactly as 'A', 'B', 'C', or 'D'.

JSON Schema (Return an object with a "questions" array containing these objects):
{
  "questions": [
    {
      "questionText": "English question text here",
      "questionText_hi": "Hindi question text here",
      "optionA": "English option A",
      "optionB": "English option B",
      "optionC": "English option C",
      "optionD": "English option D",
      "optionA_hi": "Hindi option A",
      "optionB_hi": "Hindi option B",
      "optionC_hi": "Hindi option C",
      "optionD_hi": "Hindi option D",
      "correctAnswer": "A",
      "explanation": "English explanation here",
      "explanation_hi": "Hindi explanation here",
      "difficulty": "Medium"
    }
  ]
}
`;

  let retries = 3;
  while (retries > 0) {
    try {
      console.log(`  -> Attempting generation with gpt-4o-mini...`);
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are a helpful assistant designed to output strict JSON.' },
          { role: 'user', content: prompt }
        ],
        response_format: { type: 'json_object' },
      });

      const responseText = response.choices[0].message.content;
      if (!responseText) {
        console.error('  -> Received empty response from OpenAI.');
        return [];
      }

      const json = JSON.parse(responseText);
      if (json && Array.isArray(json.questions)) {
        return json.questions;
      } else {
        console.error('  -> Expected a "questions" array from AI, got something else.');
        return [];
      }
    } catch (err: any) {
      if (err.message.includes('429') || err.message.includes('rate limit')) {
        console.warn(`  -> ⚠️ Rate limited (429). Retrying in 15 seconds... (${retries - 1} retries left)`);
        await sleep(15000);
        retries--;
      } else {
        console.error(`  -> AI Generation Failed for ${topicName}:`, err.message);
        break; // Fatal error (e.g. invalid auth or bad request)
      }
    }
  }
  
  console.error(`❌ Failed to generate questions for ${topicName} after exhausting retries.`);
  return [];
}

export async function runAIGenerator(subjectSlug: string, countPerTopic = 10) {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error('No MONGODB_URI found in .env');
    return;
  }
  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB.');

  const subject = await Subject.findOne({ slug: subjectSlug, isActive: true });
  if (!subject) {
    console.error(`Subject not found with slug: ${subjectSlug}`);
    process.exit(1);
  }

  console.log(`Starting OpenAI Question Generation for Subject: ${subject.name}`);

  const topics = await Topic.find({ subjectId: subject._id, isActive: true }).sort({ order: 1 });
  console.log(`Found ${topics.length} topics. Generating ${countPerTopic} questions per topic...`);

  let totalInserted = 0;

  for (let i = 0; i < topics.length; i++) {
    const topic = topics[i];
    console.log(`\n[${i + 1}/${topics.length}] Generating for Topic: ${topic.name}...`);
    
    const generatedData = await generateQuestionsForTopic(subject.name, topic.name, countPerTopic);
    
    if (generatedData && generatedData.length > 0) {
      const documentsToInsert = generatedData.map((q: any) => ({
        ...q,
        subjectId: subject._id,
        topicId: topic._id,
        examId: subject.examId,
        stageId: subject.stageId,
        paperId: subject.paperId,
        questionType: 'PRACTICE',
        sourceType: 'AI_GENERATED',
        qaStatus: 'VERIFIED',
        isActive: true
      }));

      try {
        await Question.insertMany(documentsToInsert, { ordered: false });
        console.log(`✅ Successfully inserted ${documentsToInsert.length} questions for ${topic.name}`);
        totalInserted += documentsToInsert.length;
      } catch (err: any) {
        console.error(`Error inserting questions for ${topic.name}:`, err.message);
      }
    } else {
      console.log(`⚠️ No questions generated for ${topic.name}`);
    }

    // Small sleep between topics just to be nice to the API
    await sleep(2000);
  }

  console.log(`\n🎉 AI Generation Complete! Total questions added to ${subject.name}: ${totalInserted}`);
  await mongoose.disconnect();
}

if (require.main === module) {
  const subjectArg = process.argv[2];
  const countArg = process.argv[3] ? parseInt(process.argv[3], 10) : 10;
  
  if (!subjectArg) {
    console.error('Usage: npm run generate:ai <subject-slug> [count-per-topic]');
    console.error('Example: npm run generate:ai jpsc-history 10');
    process.exit(1);
  }

  runAIGenerator(subjectArg, countArg).catch(console.error);
}
