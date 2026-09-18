import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { Exam } from '../models/Exam';
import { Subject } from '../models/Subject';
import { Topic } from '../models/Topic';
import { Question } from '../models/Question';

dotenv.config();

const parseMarkdownBatch = (content: string) => {
  const questions: any[] = [];
  const blocks = content.split(/## Question \d+/i).filter(b => b.trim().length > 0);
  
  for (const block of blocks) {
    if (!block.includes('**English:**')) continue;
    
    try {
      const qTextMatch = block.match(/\*\*English:\*\*\s*(.+?)(?=\*\*Hindi:\*\*|$)/s);
      const qTextHiMatch = block.match(/\*\*Hindi:\*\*\s*(.+?)(?=\n- A\.|- A |$)/s);
      
      const optAMatch = block.match(/-\s*A\.\s*(.+)/);
      const optBMatch = block.match(/-\s*B\.\s*(.+)/);
      const optCMatch = block.match(/-\s*C\.\s*(.+)/);
      const optDMatch = block.match(/-\s*D\.\s*(.+)/);
      
      const correctMatch = block.match(/\*\*Correct Answer:\*\*\s*([A-D])/);
      
      const diffMatch = block.match(/\*\*Difficulty:\*\*\s*(Easy|Medium|Hard)/i);
      const typeMatch = block.match(/\*\*Question Type:\*\*\s*([A-Z_]+)/);

      if (qTextMatch && correctMatch && optAMatch && optBMatch && optCMatch && optDMatch) {
        questions.push({
          questionText: qTextMatch[1].trim(),
          questionText_hi: qTextHiMatch ? qTextHiMatch[1].trim() : '',
          optionA: optAMatch[1].trim(),
          optionB: optBMatch[1].trim(),
          optionC: optCMatch[1].trim(),
          optionD: optDMatch[1].trim(),
          correctAnswer: correctMatch[1].trim(),
          explanation: `Correct Answer: ${correctMatch[1].trim()}`,
          difficulty: diffMatch ? diffMatch[1].trim() : 'Medium',
          questionType: typeMatch ? typeMatch[1].trim() : 'PRACTICE'
        });
      }
    } catch (e) {
      console.warn("Failed to parse a block in markdown file.");
    }
  }
  return questions;
};

const runImport = async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is required');
  
  await mongoose.connect(uri);
  console.log('MongoDB Connected');

  const exam = await Exam.findOne({ slug: 'jpsc' });
  if (!exam) throw new Error('JPSC Exam not found');

  const subject = await Subject.findOne({ slug: 'jpsc-history' });
  if (!subject) throw new Error('History subject not found');

  const topicMappings = [
    { folder: '1. ancient india', slug: 'ancient-india' },
    { folder: '2. medival india', slug: 'medieval-india' },
    { folder: '3. modern india', slug: 'modern-india' }
  ];

  let grandTotal = 0;

  for (const mapping of topicMappings) {
    const topic = await Topic.findOne({ slug: mapping.slug, subjectId: subject._id });
    if (!topic) {
      console.warn(`Topic ${mapping.slug} not found, skipping folder ${mapping.folder}`);
      continue;
    }

    const dirPath = path.resolve(__dirname, `../../jpsc questions/history of india/${mapping.folder}`);
    if (!fs.existsSync(dirPath)) {
      console.warn(`Folder not found: ${dirPath}`);
      continue;
    }

    const files = fs.readdirSync(dirPath);
    let totalImportedForTopic = 0;

    for (const file of files) {
      if (!file.endsWith('.md')) continue;
      
      console.log(`Processing file: ${file}`);
      const filePath = path.join(dirPath, file);
      const content = fs.readFileSync(filePath, 'utf-8');
      
      let parsedQuestions: any[] = [];
      
      try {
        parsedQuestions = JSON.parse(content);
        console.log(`Parsed ${parsedQuestions.length} questions as JSON.`);
      } catch (err) {
        console.log(`File is not valid JSON, falling back to Markdown parsing...`);
        parsedQuestions = parseMarkdownBatch(content);
        console.log(`Parsed ${parsedQuestions.length} questions using Regex.`);
      }

      const docs = parsedQuestions.map(q => ({
        examId: exam._id,
        subjectId: subject._id,
        topicId: topic._id,
        questionText: q.questionText,
        questionText_hi: q.questionText_hi || undefined,
        optionA: q.optionA,
        optionB: q.optionB,
        optionC: q.optionC,
        optionD: q.optionD,
        optionA_hi: q.optionA_hi || undefined,
        optionB_hi: q.optionB_hi || undefined,
        optionC_hi: q.optionC_hi || undefined,
        optionD_hi: q.optionD_hi || undefined,
        correctAnswer: q.correctAnswer,
        explanation: q.explanation || 'See answer',
        explanation_hi: q.explanation_hi || undefined,
        difficulty: q.difficulty || 'Medium',
        questionType: q.questionType || 'PRACTICE',
        qaStatus: 'VERIFIED',
        isActive: true,
        sourceType: 'INTERNAL'
      }));

      if (docs.length > 0) {
        await Question.insertMany(docs);
        totalImportedForTopic += docs.length;
        console.log(`Imported ${docs.length} questions from ${file}`);
      } else {
        console.log(`No questions found in ${file}`);
      }
    }
    console.log(`=> Completed ${mapping.folder}: ${totalImportedForTopic} questions imported.`);
    grandTotal += totalImportedForTopic;
  }

  console.log(`\nSuccess! Imported a total of ${grandTotal} History questions.`);
  process.exit(0);
};

runImport().catch(console.error);
