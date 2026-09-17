import fs from 'fs';
import path from 'path';
import {
  loadValidationContext,
  validateQuestion,
  QuestionValidationInput,
  QuestionValidationResult,
} from '../services/validation/contentValidator';

const CONTENT_DIR = path.resolve(__dirname, '../../content');
const QUESTIONS_DIR = path.join(CONTENT_DIR, 'questions');

function parseCsv(content: string, subjectSlug: string, topicSlug: string): QuestionValidationInput[] {
  const lines = content
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length <= 1) return [];
  const questions: QuestionValidationInput[] = [];

  for (let i = 1; i < lines.length; i++) {
    const regex = /(?:,|\n|^)("(?:(?:"")*[^"]*)*"|[^",\n]*|(?:\n|$))/g;
    const matches: string[] = [];
    let match: RegExpExecArray | null;
    while ((match = regex.exec(lines[i])) !== null) {
      let val = match[1];
      if (val === undefined) continue;
      if (val.startsWith('"') && val.endsWith('"')) {
        val = val.slice(1, -1).replace(/""/g, '"');
      }
      matches.push(val.trim());
      if (regex.lastIndex >= lines[i].length) break;
    }

    if (matches.length >= 7) {
      questions.push({
        questionText: matches[0],
        options: [matches[1], matches[2], matches[3], matches[4]],
        correctAnswerIndex: parseInt(matches[5], 10) || 0,
        explanation: matches[6] || '',
        difficulty: matches[7] || 'Medium',
        year: matches[8] ? parseInt(matches[8], 10) : undefined,
        subjectSlug,
        topicSlug,
      });
    }
  }
  return questions;
}

export function runValidation() {
  console.log('====================================================');
  console.log('🔍 SSC CGL QUESTION BANK CONTENT VALIDATOR');
  console.log('====================================================\n');

  if (!fs.existsSync(CONTENT_DIR)) {
    console.error(`❌ Content directory not found: ${CONTENT_DIR}`);
    process.exit(1);
  }

  const context = loadValidationContext(CONTENT_DIR);
  console.log(`Loaded ${context.validSubjectSlugs.size} valid subjects and topics mapping.\n`);

  const files: { filePath: string; subjectSlug: string; topicSlug: string }[] = [];

  const QUESTION_SOURCE_DIRS = [
    QUESTIONS_DIR,
    path.resolve(__dirname, '../../../Questions bank/questions'),
  ];

  for (const qDir of QUESTION_SOURCE_DIRS) {
    if (fs.existsSync(qDir)) {
      const subDirs = fs.readdirSync(qDir, { withFileTypes: true });
      for (const dir of subDirs) {
        if (dir.isDirectory()) {
          const sSlug = dir.name;
          const subPath = path.join(qDir, sSlug);
          const qFiles = fs.readdirSync(subPath);
          for (const file of qFiles) {
            if (file.endsWith('.json') || file.endsWith('.csv')) {
              const topicSlug = path.basename(file, path.extname(file));
              files.push({
                filePath: path.join(subPath, file),
                subjectSlug: sSlug,
                topicSlug,
              });
            }
          }
        }
      }
    }
  }

  console.log(`Scanning ${files.length} question content files...\n`);

  let totalScanned = 0;
  let totalValid = 0;
  let totalInvalid = 0;
  let totalWarnings = 0;
  let totalDuplicates = 0;

  const fileReports: {
    fileName: string;
    total: number;
    valid: number;
    invalid: number;
    warnings: number;
    errors: string[];
  }[] = [];

  for (const { filePath, subjectSlug, topicSlug } of files) {
    const relPath = path.relative(CONTENT_DIR, filePath);
    let rawItems: any[] = [];

    try {
      if (filePath.endsWith('.json')) {
        rawItems = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      } else if (filePath.endsWith('.csv')) {
        rawItems = parseCsv(fs.readFileSync(filePath, 'utf8'), subjectSlug, topicSlug);
      }
    } catch (err: any) {
      console.error(`❌ Failed to parse ${relPath}:`, err.message);
      continue;
    }

    let fileValid = 0;
    let fileInvalid = 0;
    let fileWarnCount = 0;
    const fileErrors: string[] = [];

    rawItems.forEach((item, idx) => {
      totalScanned++;
      const input: QuestionValidationInput = {
        ...item,
        subjectSlug: item.subjectSlug || subjectSlug,
        topicSlug: item.topicSlug || topicSlug,
      };

      const result: QuestionValidationResult = validateQuestion(input, context, idx);

      if (result.isValid) {
        fileValid++;
        totalValid++;
      } else {
        fileInvalid++;
        totalInvalid++;
        fileErrors.push(...result.errors.map((e) => `   ❌ ${e}`));
      }

      if (result.isDuplicate) {
        totalDuplicates++;
      }

      if (result.warnings.length > 0) {
        fileWarnCount += result.warnings.length;
        totalWarnings += result.warnings.length;
      }
    });

    fileReports.push({
      fileName: relPath,
      total: rawItems.length,
      valid: fileValid,
      invalid: fileInvalid,
      warnings: fileWarnCount,
      errors: fileErrors,
    });
  }

  // Print per-file report table
  console.log('FILE VALIDATION BREAKDOWN:');
  console.log('--------------------------------------------------------------------------------');
  console.log(
    `${'File Path'.padEnd(45)} | ${'Total'.padStart(5)} | ${'Valid'.padStart(5)} | ${'Errors'.padStart(6)} | ${'Warn'.padStart(4)}`
  );
  console.log('--------------------------------------------------------------------------------');

  for (const rep of fileReports) {
    const statusIcon = rep.invalid === 0 ? '✅' : '❌';
    console.log(
      `${(statusIcon + ' ' + rep.fileName).padEnd(45)} | ${rep.total.toString().padStart(5)} | ${rep.valid.toString().padStart(5)} | ${rep.invalid.toString().padStart(6)} | ${rep.warnings.toString().padStart(4)}`
    );
    if (rep.errors.length > 0) {
      rep.errors.forEach((err) => console.log(err));
    }
  }
  console.log('--------------------------------------------------------------------------------\n');

  console.log('====================================================');
  console.log('📋 VALIDATION SUMMARY REPORT');
  console.log('====================================================');
  console.log(`Total Files Scanned      : ${files.length}`);
  console.log(`Total Questions Scanned  : ${totalScanned}`);
  console.log(`Valid Questions          : ${totalValid} (${totalScanned > 0 ? ((totalValid / totalScanned) * 100).toFixed(1) : 0}%)`);
  console.log(`Invalid Questions        : ${totalInvalid}`);
  console.log(`Duplicates Detected      : ${totalDuplicates}`);
  console.log(`Warnings Flagged         : ${totalWarnings}`);
  console.log('====================================================\n');

  if (totalInvalid > 0) {
    console.error('❌ Validation failed! Please resolve errors in the question files before importing.\n');
    process.exit(1);
  } else {
    console.log('✅ All questions passed structural and content validation checks!\n');
  }
}

if (require.main === module) {
  runValidation();
}
