import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

import { Subject } from '../models/Subject';
import { Topic } from '../models/Topic';
import { Question } from '../models/Question';

const OUTPUT_DIR = path.resolve(__dirname, '../../../docs/question_papers');

async function exportQuestions() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error('❌ MONGODB_URI not found in .env');
    process.exit(1);
  }

  console.log('Connecting to MongoDB Atlas...');
  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB successfully.\n');

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const subjects = await Subject.find({ isActive: true }).sort({ order: 1 });
  console.log(`Found ${subjects.length} active subjects.`);

  const summaryData: { name: string; filename: string; count: number }[] = [];

  for (const sub of subjects) {
    const safeSubName = sub.name.replace(/[^a-zA-Z0-9]/g, '_');
    const filename = `${sub.order || 1}_${safeSubName}_Questions.md`;
    const filepath = path.join(OUTPUT_DIR, filename);

    console.log(`Exporting questions for subject: ${sub.name}...`);

    const topics = await Topic.find({ subjectId: sub._id, isActive: true }).sort({ order: 1 });

    let mdContent = `# SSC CGL Practice Questions - ${sub.name}\n\n`;
    mdContent += `> **Practice Paper (Questions Only - No Answers)**  \n`;
    mdContent += `> Target: SSC CGL Tier 1 & Tier 2 Preparation  \n`;
    mdContent += `> Total Questions in this Booklet: `;

    let subQuestionCount = 0;
    let subjectBody = '';

    // Fetch questions by topic
    for (const top of topics) {
      const questions = await Question.find({
        subjectId: sub._id,
        topicId: top._id,
        isActive: true,
      }).sort({ createdAt: 1 });

      if (questions.length === 0) continue;

      subjectBody += `\n---\n\n## 📌 Topic: ${top.name} (${questions.length} Questions)\n\n`;

      for (let i = 0; i < questions.length; i++) {
        subQuestionCount++;
        const q = questions[i];
        subjectBody += `### Q${subQuestionCount}. ${q.questionText.trim()}\n`;
        subjectBody += `- **(A)** ${q.optionA.trim()}\n`;
        subjectBody += `- **(B)** ${q.optionB.trim()}\n`;
        subjectBody += `- **(C)** ${q.optionC.trim()}\n`;
        subjectBody += `- **(D)** ${q.optionD.trim()}\n\n`;
      }
    }

    // Also fetch any questions assigned to this subject whose topic might be orphaned or unassigned
    const topicIds = topics.map((t) => t._id);
    const otherQuestions = await Question.find({
      subjectId: sub._id,
      topicId: { $nin: topicIds },
      isActive: true,
    }).sort({ createdAt: 1 });

    if (otherQuestions.length > 0) {
      subjectBody += `\n---\n\n## 📌 Additional Exam Practice Questions (${otherQuestions.length} Questions)\n\n`;
      for (let i = 0; i < otherQuestions.length; i++) {
        subQuestionCount++;
        const q = otherQuestions[i];
        subjectBody += `### Q${subQuestionCount}. ${q.questionText.trim()}\n`;
        subjectBody += `- **(A)** ${q.optionA.trim()}\n`;
        subjectBody += `- **(B)** ${q.optionB.trim()}\n`;
        subjectBody += `- **(C)** ${q.optionC.trim()}\n`;
        subjectBody += `- **(D)** ${q.optionD.trim()}\n\n`;
      }
    }

    mdContent = mdContent.replace(
      'Total Questions in this Booklet: ',
      `Total Questions in this Booklet: **${subQuestionCount} Questions**  \n`
    );
    mdContent += subjectBody;

    fs.writeFileSync(filepath, mdContent, 'utf8');
    console.log(`Saved ${subQuestionCount} questions to ${filename}`);
    summaryData.push({ name: sub.name, filename, count: subQuestionCount });
  }

  // Create Master Index
  let indexContent = `# 📚 SSC CGL Complete Practice Question Bank (Questions Only)\n\n`;
  indexContent += `> This documentation booklet contains all practice questions without answer keys or explanations, designed specifically for mock tests and exam self-assessment.\n\n`;
  indexContent += `| Subject | Questions Booklet Link | Total Questions |\n`;
  indexContent += `| :--- | :--- | :---: |\n`;

  let grandTotal = 0;
  for (const s of summaryData) {
    indexContent += `| ${s.name} | [View Questions Document](./${s.filename}) | **${s.count}** |\n`;
    grandTotal += s.count;
  }
  indexContent += `| **Grand Total** | | **${grandTotal} Questions** |\n\n`;
  indexContent += `### How to use these documents:\n`;
  indexContent += `1. Pick a subject booklet to test yourself under timed conditions (e.g. 25 questions in 15 minutes).\n`;
  indexContent += `2. Write down your selected options (A/B/C/D) on a notebook.\n`;
  indexContent += `3. Verify your scores by practicing directly inside the mobile app or reviewing your progress in the app performance dashboard!\n`;

  fs.writeFileSync(path.join(OUTPUT_DIR, 'README.md'), indexContent, 'utf8');
  console.log(`Saved Master Index to README.md (Grand Total: ${grandTotal} questions).\n`);

  await mongoose.disconnect();
  console.log('Done!');
}

exportQuestions().catch((err) => {
  console.error('Export failed:', err);
  process.exit(1);
});
