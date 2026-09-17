import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { Question } from '../models/Question';
import { Subject } from '../models/Subject';
import { Topic } from '../models/Topic';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function run() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error('No MONGODB_URI found in .env');
    return;
  }
  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB.');

  const subjectSlug = 'prelims-gs1-jharkhand';
  const topicSlug = 'prelims-gs1-jh-gk';

  const subject = await Subject.findOne({ slug: subjectSlug, isActive: true });
  if (!subject) {
    console.error(`Subject not found: ${subjectSlug}`);
    process.exit(1);
  }

  const topic = await Topic.findOne({ slug: topicSlug, subjectId: subject._id, isActive: true });
  if (!topic) {
    console.error(`Topic not found: ${topicSlug}`);
    process.exit(1);
  }

  // 1. Delete all existing questions for this topic
  const deleteResult = await Question.deleteMany({ topicId: topic._id });
  console.log(`Deleted ${deleteResult.deletedCount} existing questions for Topic: ${topic.name}`);

  // 2. Import from 1.md to 10.md
  // Checking both Questions-Sets and Questions-Sets/new just in case
  let baseDir = path.resolve(__dirname, '../../../../Questions-Sets');
  if (!fs.existsSync(baseDir)) {
      baseDir = path.resolve(__dirname, '../../../Questions-Sets'); // Adjust based on path
  }
  
  if (fs.existsSync(path.join(baseDir, 'new', '1.md'))) {
      baseDir = path.join(baseDir, 'new');
  }

  console.log(`Looking for markdown files in: ${baseDir}`);

  const documentsToInsert: any[] = [];

  for (let fileNum = 1; fileNum <= 10; fileNum++) {
    const filePath = path.join(baseDir, `${fileNum}.md`);
    if (!fs.existsSync(filePath)) {
      console.warn(`File not found: ${filePath}, skipping...`);
      continue;
    }

    console.log(`Processing file: ${filePath}`);
    const fileContent = fs.readFileSync(filePath, 'utf-8');

    // Regex patterns to parse the blocks.
    const questionBlocks = fileContent.split(/## (?:Question |Q)\d+/i).slice(1);
    console.log(`Found ${questionBlocks.length} questions in ${fileNum}.md`);

    for (let i = 0; i < questionBlocks.length; i++) {
      const block = questionBlocks[i];
      
      let qEng = '', qHi = '';
      let oAe = '', oBe = '', oCe = '', oDe = '';
      let oAh = '', oBh = '', oCh = '', oDh = '';

      // Format from the 1000 MCQs doc:
      const qLines = block.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      let firstLine = qLines[0] || '';
      if (firstLine.startsWith('. ')) {
          firstLine = firstLine.substring(2);
      }
      qEng = firstLine;
      
      const hiMatch = block.match(/\*\*(?:हिंदी|Hindi):\*\*\s*([\s\S]*?)(?=(?:\*\*A\.\*\*|A\.))/);
      if (hiMatch) {
          qHi = hiMatch[1].replace(/\n/g, ' ').trim();
      } else {
          qHi = qEng;
      }
      
      const flexOptA = block.match(/(?:- )?\*\*A\.\*\* (.*)/);
      const flexOptB = block.match(/(?:- )?\*\*B\.\*\* (.*)/);
      const flexOptC = block.match(/(?:- )?\*\*C\.\*\* (.*)/);
      const flexOptD = block.match(/(?:- )?\*\*D\.\*\* (.*)/);
      
      if (flexOptA && flexOptB && flexOptC && flexOptD) {
          const aSplit = flexOptA[1].split(' / '); oAe = aSplit[0].trim(); oAh = (aSplit[1] || aSplit[0]).trim();
          const bSplit = flexOptB[1].split(' / '); oBe = bSplit[0].trim(); oBh = (bSplit[1] || bSplit[0]).trim();
          const cSplit = flexOptC[1].split(' / '); oCe = cSplit[0].trim(); oCh = (cSplit[1] || cSplit[0]).trim();
          const dSplit = flexOptD[1].split(' / '); oDe = dSplit[0].trim(); oDh = (dSplit[1] || dSplit[0]).trim();
      }
      
      const answerMatch = block.match(/\*\*Correct Answer(?: \/ सही उत्तर)?:\*\* (?:\*\*)?([A-D])/i);
      const expEngMatch = block.match(/\*\*Explanation \(English\):\*\* (.*)/);
      const expHiMatch = block.match(/\*\*व्याख्या \(Hindi\):\*\* (.*)/) || block.match(/\*\*व्याख्या \(हिंदी\):\*\* (.*)/);
      const diffMatch = block.match(/\*\*Difficulty:\*\* (Easy|Medium|Hard)/);

      if (qEng && qHi && answerMatch) {
        documentsToInsert.push({
          subjectId: subject._id,
          topicId: topic._id,
          examId: subject.examId,
          stageId: subject.stageId,
          paperId: subject.paperId,
          questionType: 'PRACTICE',
          sourceType: 'USER_SUBMITTED',
          qaStatus: 'VERIFIED',
          isActive: true,
          questionText: qEng,
          questionText_hi: qHi,
          optionA: oAe, optionB: oBe, optionC: oCe, optionD: oDe,
          optionA_hi: oAh, optionB_hi: oBh, optionC_hi: oCh, optionD_hi: oDh,
          correctAnswer: answerMatch[1].trim(),
          explanation: expEngMatch ? expEngMatch[1].trim() : 'No explanation provided.',
          explanation_hi: expHiMatch ? expHiMatch[1].trim() : 'कोई व्याख्या नहीं दी गई है।',
          difficulty: diffMatch ? diffMatch[1].trim() : 'Medium'
        });
      }
    }
  }

  console.log(`Successfully parsed ${documentsToInsert.length} questions in total.`);

  if (documentsToInsert.length > 0) {
    try {
      await Question.insertMany(documentsToInsert, { ordered: false });
      console.log(`✅ Successfully inserted ${documentsToInsert.length} questions into the database.`);
    } catch (err: any) {
      console.error(`Error inserting questions:`, err);
    }
  }

  await mongoose.disconnect();
}

run().catch(console.error);
