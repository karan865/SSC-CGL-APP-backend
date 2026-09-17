import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { Question } from '../models/Question';
import { Subject } from '../models/Subject';
import { Topic } from '../models/Topic';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function importMarkdown(filePath: string) {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error('No MONGODB_URI found in .env');
    return;
  }
  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB.');

  const fileContent = fs.readFileSync(filePath, 'utf-8');

  let subjectSlug = '';
  let topicSlug = '';
  if (filePath.includes('history_movements')) {
    subjectSlug = 'jpsc-jharkhand'; 
    topicSlug = 'jpsc-p1-history-movements';
  } else if (filePath.includes('art_culture_heritage')) {
    subjectSlug = 'jpsc-jharkhand';
    topicSlug = 'jpsc-p1-art-culture';
  } else if (filePath.includes('tribes_tribal_society')) {
    subjectSlug = 'jpsc-jharkhand';
    topicSlug = 'jpsc-p1-tribes';
  } else if (filePath.includes('jharkhand_specific_awareness')) {
    subjectSlug = 'prelims-gs1-jharkhand';
    topicSlug = 'prelims-gs1-jh-gk';
  } else {
    console.error('Could not determine topic from filename.');
    process.exit(1);
  }

  const subject = await Subject.findOne({ slug: subjectSlug, isActive: true });
  
  if (!subject) {
    console.error(`Subject not found with slug: ${subjectSlug}`);
    process.exit(1);
  }

  // Pick the correct topic
  const targetTopic = await Topic.findOne({ slug: topicSlug, subjectId: subject._id, isActive: true });
  if (!targetTopic) {
    console.error(`Topic not found for subject: ${subject.name} and slug: ${topicSlug}`);
    process.exit(1);
  }

  console.log(`Will import into Subject: ${subject.name} -> Topic: ${targetTopic.name}`);

  // Regex patterns to parse the blocks. Set 1 uses "## Question \d+", Set 3 uses "## Q\d+."
  const questionBlocks = fileContent.split(/## (?:Question |Q)\d+/i).slice(1);
  console.log(`Found ${questionBlocks.length} question blocks.`);

  const documentsToInsert = [];

  for (let i = 0; i < questionBlocks.length; i++) {
    const block = questionBlocks[i];
    
    // Format 1 Variables
    let qEng = '', qHi = '';
    let oAe = '', oBe = '', oCe = '', oDe = '';
    let oAh = '', oBh = '', oCh = '', oDh = '';
    
    // Format 4 Variables
    const isFormat4 = block.includes('**English:**') && block.includes('**Options / विकल्प:**');

    // Check which format it is
    if (isFormat4) {
      const qEngMatch = block.match(/\*\*English:\*\* (.*)/);
      const qHiMatch = block.match(/\*\*Hindi:\*\* (.*)/);

      if (qEngMatch) qEng = qEngMatch[1].trim();
      if (qHiMatch) qHi = qHiMatch[1].trim();

      const optA = block.match(/- \*\*A\.\*\* (.*)/);
      const optB = block.match(/- \*\*B\.\*\* (.*)/);
      const optC = block.match(/- \*\*C\.\*\* (.*)/);
      const optD = block.match(/- \*\*D\.\*\* (.*)/);

      if (optA) { oAe = optA[1].trim(); oAh = oAe; }
      if (optB) { oBe = optB[1].trim(); oBh = oBe; }
      if (optC) { oCe = optC[1].trim(); oCh = oCe; }
      if (optD) { oDe = optD[1].trim(); oDh = oDe; }
    } else if (block.includes('**Question (English):**')) {
      // Format 1 (Set 1 & 2)
      const qEngMatch = block.match(/\*\*Question \(English\):\*\* (.*)/);
      const qHiMatch = block.match(/\*\*प्रश्न \(हिंदी\):\*\* (.*)/);
      
      const optA_Eng = block.match(/- A\. (.*)/);
      const optB_Eng = block.match(/- B\. (.*)/);
      const optC_Eng = block.match(/- C\. (.*)/);
      const optD_Eng = block.match(/- D\. (.*)/);
      
      const optSectionHi = block.split(/\*\*विकल्प \(हिंदी\):\*\*/)[1];
      const optA_Hi = optSectionHi ? optSectionHi.match(/- A\. (.*)/) : null;
      const optB_Hi = optSectionHi ? optSectionHi.match(/- B\. (.*)/) : null;
      const optC_Hi = optSectionHi ? optSectionHi.match(/- C\. (.*)/) : null;
      const optD_Hi = optSectionHi ? optSectionHi.match(/- D\. (.*)/) : null;

      if (qEngMatch && qHiMatch && optA_Eng && optB_Eng && optC_Eng && optD_Eng && optA_Hi && optB_Hi && optC_Hi && optD_Hi) {
        qEng = qEngMatch[1].trim(); qHi = qHiMatch[1].trim();
        oAe = optA_Eng[1].trim(); oBe = optB_Eng[1].trim(); oCe = optC_Eng[1].trim(); oDe = optD_Eng[1].trim();
        oAh = optA_Hi[1].trim(); oBh = optB_Hi[1].trim(); oCh = optC_Hi[1].trim(); oDh = optD_Hi[1].trim();
      }
    } else {
      // Format 2 or 3 (Set 3 and Set 4)
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
      } else {
        console.warn('Failed to parse options for block:', block.substring(0, 50));
      }
    }

    const answerMatch = block.match(/\*\*Correct Answer(?: \/ सही उत्तर)?:\*\* (?:\*\*)?([A-D])/i);
    const expEngMatch = block.match(/\*\*Explanation \(English\):\*\* (.*)/);
    const expHiMatch = block.match(/\*\*व्याख्या \(Hindi\):\*\* (.*)/) || block.match(/\*\*व्याख्या \(हिंदी\):\*\* (.*)/);
    const diffMatch = block.match(/\*\*Difficulty:\*\* (Easy|Medium|Hard)/);

    if (qEng && qHi && answerMatch) {
      
      documentsToInsert.push({
        subjectId: subject._id,
        topicId: targetTopic._id,
        examId: subject.examId,
        stageId: subject.stageId,
        paperId: subject.paperId,
        questionType: 'PRACTICE',
        sourceType: 'USER_SUBMITTED',
        qaStatus: 'VERIFIED',
        isActive: true,
        
        questionText: qEng,
        questionText_hi: qHi,
        
        optionA: oAe,
        optionB: oBe,
        optionC: oCe,
        optionD: oDe,
        
        optionA_hi: oAh,
        optionB_hi: oBh,
        optionC_hi: oCh,
        optionD_hi: oDh,
        
        correctAnswer: answerMatch[1].trim(),
        
        explanation: expEngMatch ? expEngMatch[1].trim() : 'No explanation provided.',
        explanation_hi: expHiMatch ? expHiMatch[1].trim() : 'कोई व्याख्या नहीं दी गई है।',
        
        difficulty: diffMatch ? diffMatch[1].trim() : 'Medium'
      });
    } else {
      console.warn(`Failed to parse Question ${i + 1}. Some fields are missing.`);
    }
  }

  console.log(`Successfully parsed ${documentsToInsert.length} questions.`);

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

if (require.main === module) {
  const filePathArg = process.argv[2];
  
  if (!filePathArg) {
    console.error('Usage: npm run import:md <file-path>');
    console.error('Example: npm run import:md ../questions-sets/jpsc_traditional_tribal_governance_set_1_100.md');
    process.exit(1);
  }

  const absolutePath = path.resolve(process.cwd(), filePathArg);
  
  if (!fs.existsSync(absolutePath)) {
    console.error(`File not found: ${absolutePath}`);
    process.exit(1);
  }

  importMarkdown(absolutePath).catch(console.error);
}
