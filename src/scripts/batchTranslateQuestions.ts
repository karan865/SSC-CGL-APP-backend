import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
import { Question } from '../models/Question';
import { Subject } from '../models/Subject';

interface TranslationResult {
  text: string;
}

// Sleep helper
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function translateText(text: string, retries = 3): Promise<string> {
  if (!text || text.trim() === '') return '';
  const clean = text.trim();

  // Try Google clients5 API first (fast, reliable, no rate-limit blocks for dictionary client)
  try {
    const gUrl = `https://clients5.google.com/translate_a/t?client=dict-chrome-ex&sl=en&tl=hi&q=${encodeURIComponent(clean)}`;
    const res = await fetch(gUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });
    if (res.ok) {
      const data: any = await res.json();
      if (Array.isArray(data) && data.length > 0 && typeof data[0] === 'string') {
        return data[0];
      }
    }
  } catch {
    // Fall back to MyMemory if Google fails
  }

  // Fallback to MyMemory
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(clean)}&langpair=en|hi`;
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data: any = await res.json();
      if (data?.responseData?.translatedText) {
        let result = data.responseData.translatedText;
        result = result
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>');
        return result;
      }
    } catch (err: any) {
      if (attempt === retries) {
        return '';
      }
      await sleep(500 * attempt);
    }
  }
  return '';
}

async function translateBatchOptions(options: [string, string, string, string]): Promise<[string, string, string, string]> {
  // Join with delimiter to translate all 4 options in 1 single API call
  const combined = options.join(' ||| ');
  const translated = await translateText(combined);
  if (translated && translated.includes('|||')) {
    const parts = translated.split('|||').map((s) => s.replace(/^[|#\s]+/, '').trim());
    if (parts.length === 4) {
      return [parts[0], parts[1], parts[2], parts[3]];
    }
  }
  // Fallback: individual translation
  const results: [string, string, string, string] = ['', '', '', ''];
  for (let i = 0; i < 4; i++) {
    const tr = await translateText(options[i]);
    results[i] = tr ? tr.replace(/^[|#\s]+/, '').trim() : '';
    await sleep(150);
  }
  return results;
}

export async function runTranslation(targetSubjectSlug?: string, limitCount = 200) {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error('No MONGODB_URI found');
    return;
  }
  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB.');

  let query: any = {
    $or: [
      { questionText_hi: { $exists: false } },
      { questionText_hi: '' },
      { questionText_hi: null },
      { explanation_hi: { $exists: false } },
      { explanation_hi: '' },
      { $expr: { $eq: ['$explanation_hi', '$explanation'] } },
    ],
  };

  if (targetSubjectSlug) {
    const sub = await Subject.findOne({ slug: targetSubjectSlug });
    if (sub) {
      query.subjectId = sub._id;
      console.log(`Filtering by subject: ${sub.name} (${sub.slug})`);
    } else {
      console.warn(`Subject not found with slug: ${targetSubjectSlug}`);
    }
  }

  const questionsToTranslate = await Question.find(query).limit(limitCount);
  console.log(`Found ${questionsToTranslate.length} questions to translate.`);

  let successCount = 0;
  for (let i = 0; i < questionsToTranslate.length; i++) {
    const q = questionsToTranslate[i];
    console.log(`[${i + 1}/${questionsToTranslate.length}] Translating Q: "${q.questionText.substring(0, 50)}..."`);

    try {
      // 1. Question text
      let qHi = q.questionText_hi;
      if (!qHi || qHi.trim() === '' || qHi === q.questionText) {
        qHi = await translateText(q.questionText);
        await sleep(150);
      }

      // 2. Options
      let optAHi = q.optionA_hi;
      let optBHi = q.optionB_hi;
      let optCHi = q.optionC_hi;
      let optDHi = q.optionD_hi;
      if (!optAHi || !optBHi || !optCHi || !optDHi || optAHi.startsWith('|') || optBHi.startsWith('|')) {
        const [a, b, c, d] = await translateBatchOptions([q.optionA, q.optionB, q.optionC, q.optionD]);
        optAHi = a || optAHi;
        optBHi = b || optBHi;
        optCHi = c || optCHi;
        optDHi = d || optDHi;
        await sleep(150);
      }

      // 3. Explanation
      let explHi = q.explanation_hi;
      if (!explHi || explHi.trim() === '' || explHi === q.explanation) {
        explHi = await translateText(q.explanation);
        await sleep(150);
      }

      // Update question in MongoDB
      q.questionText_hi = qHi || q.questionText;
      q.optionA_hi = optAHi ? optAHi.replace(/^[|#\s]+/, '').trim() : q.optionA;
      q.optionB_hi = optBHi ? optBHi.replace(/^[|#\s]+/, '').trim() : q.optionB;
      q.optionC_hi = optCHi ? optCHi.replace(/^[|#\s]+/, '').trim() : q.optionC;
      q.optionD_hi = optDHi ? optDHi.replace(/^[|#\s]+/, '').trim() : q.optionD;
      q.explanation_hi = explHi || q.explanation;

      await q.save();
      successCount++;
    } catch (err: any) {
      console.error(`Error translating question ${q._id}:`, err.message);
    }
  }

  console.log(`✅ Successfully enriched ${successCount} questions with bilingual fields!`);
  await mongoose.disconnect();
}

// If run from command line
if (require.main === module) {
  const subjectSlug = process.argv[2];
  const count = process.argv[3] ? parseInt(process.argv[3], 10) : 100;
  runTranslation(subjectSlug, count).catch(console.error);
}
