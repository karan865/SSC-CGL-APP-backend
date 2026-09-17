import { runTranslation } from './batchTranslateQuestions';

const JPSC_SUBJECTS = [
  'jpsc-geography',
  'jpsc-polity',
  'jpsc-economy',
  'jpsc-science',
  'jpsc-jharkhand',
  'jpsc-current-affairs',
  'jpsc-miscellaneous',
  'jpsc-p2-tribal-governance',
  'jpsc-p2-movements-personalities',
  'jpsc-p2-land-laws',
  'jpsc-p2-geography-rivers',
  'jpsc-p2-minerals-industries',
  'jpsc-p2-schemes-development',
  'jpsc-p2-forest-environment',
  'jpsc-p2-culture-sports',
];

async function main() {
  console.log('🚀 Starting full bilingual translation for all remaining JPSC subjects...');
  for (const slug of JPSC_SUBJECTS) {
    console.log(`\n========================================`);
    console.log(`Translating Subject: ${slug}`);
    console.log(`========================================`);
    await runTranslation(slug, 200);
  }
  console.log('\n🎉 All JPSC subjects successfully translated to bilingual!');
}

main().catch(console.error);
