import fs from 'fs';
import path from 'path';

export interface QuestionValidationInput {
  questionText: string;
  options: string[];
  correctAnswerIndex: number;
  explanation: string;
  difficulty?: string;
  questionType?: string;
  sourceType?: string;
  qaStatus?: string;
  year?: number;
  exam?: string;
  tier?: number;
  shift?: string;
  source?: string;
  sourceUrl?: string;
  subjectSlug?: string;
  topicSlug?: string;
}

export interface ValidationIssue {
  type: 'ERROR' | 'WARNING';
  code: string;
  message: string;
  field?: string;
}

export interface QuestionValidationResult {
  isValid: boolean;
  issues: ValidationIssue[];
  errors: string[];
  warnings: string[];
  isDuplicate: boolean;
  questionText: string;
  subjectSlug?: string;
  topicSlug?: string;
}

export interface ContentValidationContext {
  validSubjectSlugs: Set<string>;
  validTopicsBySubject: Map<string, Set<string>>;
  seenQuestionTexts: Set<string>;
  seenTopicQuestions: Set<string>;
}

/**
 * Loads valid subjects and topics from the canonical JSON definition files.
 */
export function loadValidationContext(contentDir: string): ContentValidationContext {
  const subjectsPath = path.join(contentDir, 'subjects.json');
  const topicsPath = path.join(contentDir, 'topics.json');

  const validSubjectSlugs = new Set<string>();
  const validTopicsBySubject = new Map<string, Set<string>>();

  if (fs.existsSync(subjectsPath)) {
    const subjects = JSON.parse(fs.readFileSync(subjectsPath, 'utf8'));
    for (const s of subjects) {
      if (s.slug) {
        validSubjectSlugs.add(s.slug);
        const topicSet = new Set<string>();
        validTopicsBySubject.set(s.slug, topicSet);
        if (Array.isArray(s.aliases)) {
          for (const alias of s.aliases) {
            validSubjectSlugs.add(alias);
            validTopicsBySubject.set(alias, topicSet);
          }
        }
      }
    }
  }

  if (fs.existsSync(topicsPath)) {
    const topics = JSON.parse(fs.readFileSync(topicsPath, 'utf8'));
    for (const t of topics) {
      if (t.subjectSlug && t.slug) {
        const topicSet = validTopicsBySubject.get(t.subjectSlug);
        if (topicSet) {
          topicSet.add(t.slug);
          if (Array.isArray(t.aliases)) {
            t.aliases.forEach((a: string) => topicSet.add(a));
          }
        }
      }
    }
  }

  return {
    validSubjectSlugs,
    validTopicsBySubject,
    seenQuestionTexts: new Set<string>(),
    seenTopicQuestions: new Set<string>(),
  };
}

/**
 * Validates a single question object against structural, relational, and subject-specific rules.
 */
export function validateQuestion(
  q: QuestionValidationInput,
  context?: ContentValidationContext,
  index?: number
): QuestionValidationResult {
  const issues: ValidationIssue[] = [];
  let isDuplicate = false;

  const prefix = typeof index === 'number' ? `[Item ${index + 1}] ` : '';

  // 1. Structural Checks
  if (!q.questionText || typeof q.questionText !== 'string' || q.questionText.trim().length < 5) {
    issues.push({
      type: 'ERROR',
      code: 'INVALID_QUESTION_TEXT',
      field: 'questionText',
      message: `${prefix}Question text is missing or too short (must be >= 5 chars).`,
    });
  }

  // Options validation
  if (!Array.isArray(q.options) || q.options.length !== 4) {
    issues.push({
      type: 'ERROR',
      code: 'INVALID_OPTIONS_COUNT',
      field: 'options',
      message: `${prefix}Must provide exactly 4 options. Found ${q.options ? q.options.length : 0}.`,
    });
  } else {
    // Check for empty or non-string options
    q.options.forEach((opt, idx) => {
      if (typeof opt !== 'string' || opt.trim().length === 0) {
        issues.push({
          type: 'ERROR',
          code: 'EMPTY_OPTION',
          field: `options[${idx}]`,
          message: `${prefix}Option ${idx + 1} is empty or whitespace.`,
        });
      }
    });

    // Check for duplicate options within the same question
    const uniqueOptions = new Set(q.options.map((o) => (typeof o === 'string' ? o.trim().toLowerCase() : o)));
    if (uniqueOptions.size < q.options.length) {
      issues.push({
        type: 'ERROR',
        code: 'DUPLICATE_OPTIONS',
        field: 'options',
        message: `${prefix}Question contains duplicate options: [${q.options.join(', ')}].`,
      });
    }
  }

  // Correct answer index
  if (
    typeof q.correctAnswerIndex !== 'number' ||
    !Number.isInteger(q.correctAnswerIndex) ||
    q.correctAnswerIndex < 0 ||
    q.correctAnswerIndex > 3
  ) {
    issues.push({
      type: 'ERROR',
      code: 'INVALID_CORRECT_ANSWER_INDEX',
      field: 'correctAnswerIndex',
      message: `${prefix}correctAnswerIndex must be an integer between 0 and 3. Found: ${q.correctAnswerIndex}.`,
    });
  }

  // Explanation check
  if (!q.explanation || typeof q.explanation !== 'string' || q.explanation.trim().length < 5) {
    issues.push({
      type: 'ERROR',
      code: 'INVALID_EXPLANATION',
      field: 'explanation',
      message: `${prefix}Explanation is missing or too short (must be >= 5 chars).`,
    });
  }

  // Difficulty check
  const validDifficulties = ['Easy', 'Medium', 'Hard'];
  if (q.difficulty && !validDifficulties.includes(q.difficulty)) {
    issues.push({
      type: 'ERROR',
      code: 'INVALID_DIFFICULTY',
      field: 'difficulty',
      message: `${prefix}Difficulty must be 'Easy', 'Medium', or 'Hard'. Found: "${q.difficulty}".`,
    });
  }

  // Question type check
  const validTypes = ['PYQ', 'PYQ_INSPIRED', 'SAMPLE_PAPER', 'RELATED_PRACTICE'];
  if (q.questionType && !validTypes.includes(q.questionType)) {
    issues.push({
      type: 'WARNING',
      code: 'UNKNOWN_QUESTION_TYPE',
      field: 'questionType',
      message: `${prefix}Question type "${q.questionType}" is non-standard. Expected one of: ${validTypes.join(', ')}.`,
    });
  }

  // QA status check
  const validStatuses = ['DRAFT', 'REVIEW', 'VERIFIED', 'REJECTED'];
  if (q.qaStatus && !validStatuses.includes(q.qaStatus)) {
    issues.push({
      type: 'WARNING',
      code: 'UNKNOWN_QA_STATUS',
      field: 'qaStatus',
      message: `${prefix}QA status "${q.qaStatus}" is non-standard. Expected: ${validStatuses.join(', ')}.`,
    });
  }

  // 2. Relational & Subject/Topic Validity
  if (context) {
    if (q.subjectSlug && !context.validSubjectSlugs.has(q.subjectSlug)) {
      issues.push({
        type: 'ERROR',
        code: 'INVALID_SUBJECT_SLUG',
        field: 'subjectSlug',
        message: `${prefix}Subject slug "${q.subjectSlug}" not found in subjects.json.`,
      });
    }

    if (q.subjectSlug && q.topicSlug) {
      const topicSet = context.validTopicsBySubject.get(q.subjectSlug);
      if (!topicSet || !topicSet.has(q.topicSlug)) {
        issues.push({
          type: 'ERROR',
          code: 'INVALID_TOPIC_FOR_SUBJECT',
          field: 'topicSlug',
          message: `${prefix}Topic slug "${q.topicSlug}" does not belong to subject "${q.subjectSlug}".`,
        });
      }
    }

    // 3. Duplicate Detection
    if (q.questionText) {
      const normalizedQ = q.questionText.trim().toLowerCase().replace(/\s+/g, ' ');
      const sortedOptions = Array.isArray(q.options)
        ? [...q.options].map((o) => (typeof o === 'string' ? o.trim().toLowerCase() : o)).sort().join('|')
        : '';
      const fullSignature = `${q.topicSlug || ''}:${normalizedQ}:${sortedOptions}`;

      if (context.seenTopicQuestions.has(fullSignature)) {
        isDuplicate = true;
        issues.push({
          type: 'WARNING',
          code: 'EXACT_TOPIC_DUPLICATE',
          message: `${prefix}Exact duplicate question and options in topic "${q.topicSlug}".`,
        });
      } else {
        context.seenTopicQuestions.add(fullSignature);
      }

      // Check if question text is repeated across different topics/options
      if (context.seenQuestionTexts.has(normalizedQ)) {
        const genericStems = [
          'find the odd one out.',
          'find the odd one out',
          'select the related word from the given alternatives:',
          'select the related number from the given alternatives:',
          'choose the correct alternative.',
          'select the related pair:',
        ];
        if (!genericStems.includes(normalizedQ) && normalizedQ.length > 25) {
          isDuplicate = true;
          issues.push({
            type: 'WARNING',
            code: 'REPEATED_QUESTION_STEM',
            field: 'questionText',
            message: `${prefix}Repeated question stem detected: "${q.questionText.slice(0, 60)}..."`,
          });
        }
      } else {
        context.seenQuestionTexts.add(normalizedQ);
      }
    }
  }

  // 4. Subject-Specific Quality Heuristics
  const qText = (q.questionText || '').toLowerCase();
  const expl = (q.explanation || '').toLowerCase();
  const sub = (q.subjectSlug || '').toLowerCase();

  // Quant heuristics: If arithmetic symbols/percentages exist, verify explanation mentions relevant calculation
  if (sub === 'quant') {
    if (qText.includes('%') && !expl.includes('%') && !expl.includes('/100') && !expl.includes('*')) {
      issues.push({
        type: 'WARNING',
        code: 'QUANT_EXPLANATION_LACKS_MATH',
        field: 'explanation',
        message: `${prefix}Percentage question explanation lacks numerical formula or calculation step.`,
      });
    }
    if (qText.includes(':') && qText.includes('ratio') && !expl.includes(':') && !expl.includes('ratio') && !expl.includes('unit')) {
      issues.push({
        type: 'WARNING',
        code: 'QUANT_EXPLANATION_LACKS_RATIO',
        field: 'explanation',
        message: `${prefix}Ratio question explanation lacks ratio or unit derivation.`,
      });
    }
  }

  // Reasoning heuristics
  if (sub === 'reasoning') {
    if (qText.includes('::') && !expl.includes('pattern') && !expl.includes('relation') && !expl.includes('because') && !expl.includes('is')) {
      issues.push({
        type: 'WARNING',
        code: 'REASONING_ANALOGY_UNSUPPORTED',
        field: 'explanation',
        message: `${prefix}Analogy question explanation does not clearly articulate the connecting relationship.`,
      });
    }
  }

  // English heuristics
  if (sub === 'english') {
    if (qText.includes('error') && !expl.includes('error') && !expl.includes('correct') && !expl.includes('should be') && !expl.includes('verb') && !expl.includes('noun')) {
      issues.push({
        type: 'WARNING',
        code: 'ENGLISH_ERROR_UNEXPLAINED',
        field: 'explanation',
        message: `${prefix}Spotting error explanation does not explain the underlying grammatical rule.`,
      });
    }
  }

  // General Awareness heuristics: Flag if year is claiming to be future or unrealistic
  if (q.year && (q.year < 2000 || q.year > 2026)) {
    issues.push({
      type: 'WARNING',
      code: 'UNUSUAL_EXAM_YEAR',
      field: 'year',
      message: `${prefix}Question year (${q.year}) is outside expected range (2000-2026).`,
    });
  }

  const errors = issues.filter((i) => i.type === 'ERROR').map((i) => i.message);
  const warnings = issues.filter((i) => i.type === 'WARNING').map((i) => i.message);

  return {
    isValid: errors.length === 0,
    issues,
    errors,
    warnings,
    isDuplicate,
    questionText: q.questionText || '',
    subjectSlug: q.subjectSlug,
    topicSlug: q.topicSlug,
  };
}
