import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { Exam } from '../models/Exam';
import { ExamStage } from '../models/ExamStage';
import { ExamPaper } from '../models/ExamPaper';
import { Subject } from '../models/Subject';
import { Topic } from '../models/Topic';
import { Question } from '../models/Question';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const PRELIMS_DEF = {
  name: 'Preliminary Examination',
  slug: 'prelims',
  order: 1,
  papers: [
    {
      name: 'General Studies (GS-I)',
      slug: 'gs-1',
      order: 1,
      subjects: [
        {
          name: 'History of India',
          slug: 'prelims-history',
          order: 1,
          topics: ['Ancient India', 'Medieval India', 'Modern India']
        },
        {
          name: 'Geography of India',
          slug: 'prelims-geography',
          order: 2,
          topics: ['General Geography', 'Physical Geography', 'Economic Geography', 'Social & Demographic Geography']
        },
        {
          name: 'Indian Polity & Governance',
          slug: 'prelims-polity',
          order: 3,
          topics: ['Constitution of India', 'Public Administration & Good Governance', 'Decentralization: Panchayats & Municipalities']
        },
        {
          name: 'Economy & Sustainable Development',
          slug: 'prelims-economy',
          order: 4,
          topics: ['Indian Economy Basics', 'Sustainable Development & Economic Issues', 'Economic Reforms & Globalization']
        },
        {
          name: 'Science & Technology',
          slug: 'prelims-science',
          order: 5,
          topics: ['General Science', 'Agriculture & Technology Development', 'Information & Communication Technology']
        },
        {
          name: 'Jharkhand-Specific Awareness',
          slug: 'prelims-jharkhand',
          order: 6,
          topics: ['General knowledge of Jharkhand\'s history, society, culture and heritage']
        },
        {
          name: 'National & International Current Events',
          slug: 'prelims-current-events',
          order: 7,
          topics: ['Latest developments on national and global fronts']
        },
        {
          name: 'General Awareness (Miscellaneous)',
          slug: 'prelims-misc',
          order: 8,
          topics: ['Human Rights', 'Environment & Climate Change', 'Urbanization', 'Sports', 'Disaster Management', 'Poverty & Unemployment', 'Awards', 'UN & International Agencies']
        }
      ]
    }
  ]
};

const MAINS_DEF = {
  name: 'Main Examination',
  slug: 'mains',
  order: 2,
  papers: [
    {
      name: 'Paper-I: General Hindi & General English',
      slug: 'mains-paper-1',
      order: 1,
      subjects: [
        {
          name: 'General Hindi',
          slug: 'mains-hindi',
          order: 1,
          topics: ['Essay', 'Grammar', 'Sentence Structure', 'Precis']
        },
        {
          name: 'General English',
          slug: 'mains-english',
          order: 2,
          topics: ['Essay', 'Grammar', 'Comprehension', 'Precis']
        }
      ]
    },
    {
      name: 'Paper-II: Language & Literature',
      slug: 'mains-paper-2',
      order: 2,
      subjects: [
        'Oriya Language & Literature',
        'Bangali Language & Literature',
        'Urdu Language & Literature',
        'Sanskrit Language & Literature',
        'English Language & Literature',
        'Hindi Language & Literature',
        'Santhali Language & Literature',
        'Panchpargania Language & Literature',
        'Nagpuri Language & Literature',
        'Mundari Language & Literature',
        'Kurux Language & Literature',
        'Kurmali Language & Literature',
        'Khortha Language & Literature',
        'Khadia Language & Literature',
        'Ho Language & Literature'
      ].map((lang, idx) => ({
        name: lang,
        slug: `mains-lang-${idx+1}`,
        order: idx + 1,
        topics: [lang] // Create a single topic with the same name for now
      }))
    },
    {
      name: 'Paper-III: Social Sciences',
      slug: 'mains-paper-3',
      order: 3,
      subjects: [
        {
          name: 'Section A — History',
          slug: 'mains-p3-history',
          order: 1,
          topics: ['Ancient Period', 'Medieval Period', 'Modern Period', 'History of Jharkhand']
        },
        {
          name: 'Section B — Geography',
          slug: 'mains-p3-geography',
          order: 2,
          topics: ['Physical Geography — General Principles', 'Physical & Human Geography of India', 'Natural Resources of India', 'Geography of Jharkhand & Utilization of Resources']
        }
      ]
    },
    {
      name: 'Paper-IV: Indian Constitution, Polity, Public Administration & Good Governance',
      slug: 'mains-paper-4',
      order: 4,
      subjects: [
        {
          name: 'Section A — Indian Constitution & Polity',
          slug: 'mains-p4-polity',
          order: 1,
          topics: ['Preamble', 'Salient features of Indian Constitution', 'Public Interest Litigation', 'Basic Structure of Indian Constitution', 'Fundamental Rights', 'Fundamental Duties', 'Directive Principles of State Policy', 'Union Executive', 'Union Legislature', 'Union Judiciary', 'State Government', 'Panchayats & Municipalities', 'Centre-State Relations', 'Scheduled Areas', 'Reservation', 'Emergency Provisions', 'Constitutional Authorities', 'Political System']
        },
        {
          name: 'Section B — Public Administration & Good Governance',
          slug: 'mains-p4-pubad',
          order: 2,
          topics: ['Public Administration', 'Public & Private Administration', 'Union Administration', 'State Administration', 'District Administration', 'Personnel Administration', 'Delegation & Decentralization', 'Bureaucracy', 'Development Administration', 'Disaster Management', 'Good Governance', 'Human Rights']
        }
      ]
    },
    {
      name: 'Paper-V: Indian Economy, Globalization & Sustainable Development',
      slug: 'mains-paper-5',
      order: 5,
      subjects: [
        {
          name: 'Group A — Basic Features of Indian Economy',
          slug: 'mains-p5-group-a',
          order: 1,
          topics: ['National Income', 'Inflation', 'Demographic features', 'Agriculture and Rural Economy', 'Industrial Economy', 'Public Finance', 'Public Expenditure', 'Budget', 'Fiscal Policy', 'Centre-State fiscal relationship', 'Finance Commission', 'Financial aspects of 73rd and 74th Amendment', 'Indian monetary system', 'Indian banking system']
        },
        {
          name: 'Group B — Sustainable Development, Economic Issues & Indian Development Strategy',
          slug: 'mains-p5-group-b',
          order: 2,
          topics: ['Economic development', 'Measurement', 'Characteristics of underdevelopment', 'HDI, GDI, GEM', 'Foreign capital and technology', 'Sustainable development', 'Inclusive growth', 'Poverty', 'Unemployment', 'Food and nutritional security', 'Five Year Plans']
        },
        {
          name: 'Group C — Economic Reforms, Nature & Impact on Indian Economy',
          slug: 'mains-p5-group-c',
          order: 3,
          topics: ['Liberalization, Privatization, Globalization', 'IMF, World Bank, WTO', 'Banking sector reforms', 'Financial inclusion', 'Globalization of Indian economy', 'Agricultural sector reforms', 'Industrial policy changes']
        },
        {
          name: 'Group D — Economy of Jharkhand: Features, Issues & Strategies',
          slug: 'mains-p5-group-d',
          order: 4,
          topics: ['Economic growth of Jharkhand', 'Structure of Jharkhand economy', 'Agriculture and Industrial growth', 'Demographics of Jharkhand', 'Poverty, Unemployment, Malnutrition', 'Agricultural and Rural development', 'Land reforms and Tribal land alienation', 'Development-induced displacement', 'Forest issues and Rights', 'Five Year Plans and Public finance in Jharkhand']
        }
      ]
    },
    {
      name: 'Paper-VI: General Science, Environment & Technology Development',
      slug: 'mains-paper-6',
      order: 6,
      subjects: [
        {
          name: 'Group A — Physical Science',
          slug: 'mains-p6-group-a',
          order: 1,
          topics: ['System of units', 'Basic physics principles', 'Solar system', 'Sound']
        },
        {
          name: 'Group B — Life Science',
          slug: 'mains-p6-group-b',
          order: 2,
          topics: ['Cell structure and functions', 'Biomolecules', 'Vitamins and enzymes', 'Hormones', 'Cell division', 'Genetics', 'Evolution']
        },
        {
          name: 'Group C — Agriculture Science',
          slug: 'mains-p6-group-c',
          order: 3,
          topics: ['Agro-climatic zones of Jharkhand', 'Crops and security', 'Soil fertility and organic farming', 'Biotechnology in agriculture']
        },
        {
          name: 'Group D — Environmental Science',
          slug: 'mains-p6-group-d',
          order: 4,
          topics: ['Ecosystem', 'Resources and conservation', 'Pollution and waste management', 'Biodiversity', 'Global warming and climate change', 'Environmental Acts']
        },
        {
          name: 'Group E — Science & Technology Development',
          slug: 'mains-p6-group-e',
          order: 5,
          topics: ['National Policy on Science and Technology', 'Energy', 'Space technology', 'Information Technology', 'Cybercrime and laws', 'National Health Programmes']
        }
      ]
    },
    {
      name: 'Jharkhand Specific — GS-II',
      slug: 'mains-jharkhand-gs2',
      order: 7,
      subjects: [
        {
          name: 'A. History of Jharkhand',
          slug: 'mains-jh-history',
          order: 1,
          topics: ['Munda Governance System', 'Nagvanshi Governance System', 'Parha Panchayat Governance System', 'Manjhi Pargana Administration System', 'Munda Manki Governance System', 'Dhoklo Sohor Governance System', 'Jatiya Panchayat Governance System']
        },
        {
          name: 'B. Jharkhand Movement',
          slug: 'mains-jh-movement',
          order: 2,
          topics: ['Sadan of Jharkhand', 'Tribes of Jharkhand', 'Freedom Fighters of Jharkhand', 'Vibhuti of Jharkhand', 'Jharkhand Movement and State Formation']
        },
        {
          name: 'C. Unique Identity of Jharkhand',
          slug: 'mains-jh-identity',
          order: 3,
          topics: ['Social Scenario of Jharkhand', 'Cultural Scenario of Jharkhand', 'Political Scenario of Jharkhand', 'Economic Scenario of Jharkhand', 'Religious Peculiarities and Identity of Jharkhand']
        },
        {
          name: 'D. Folk Literature, Dance, Music, Musical Instruments, Tourist Places & Tribal Culture',
          slug: 'mains-jh-culture',
          order: 4,
          topics: ['Folk Literature', 'Traditional Arts & Folk Dances', 'Folk Music & Instruments', 'Tourist Places', 'Tribes — Sub-Castes and Characteristics']
        },
        {
          name: 'E. Literature & Authors of Jharkhand',
          slug: 'mains-jh-literature',
          order: 5,
          topics: ['Literature & Authors of Jharkhand']
        },
        {
          name: 'F. Important Educational Institutions',
          slug: 'mains-jh-education',
          order: 6,
          topics: ['Important Educational Institutions']
        },
        {
          name: 'G. Sports of Jharkhand',
          slug: 'mains-jh-sports',
          order: 7,
          topics: ['Sports of Jharkhand']
        },
        {
          name: 'H. Land Related Laws of Jharkhand',
          slug: 'mains-jh-laws',
          order: 8,
          topics: ['Chotanagpur Tenancy Act (CNT)', 'Santhal Pargana Tenancy Act (SPT)', 'Other State-Related Acts']
        },
        {
          name: 'I. History of Economic Development in Jharkhand Since 1947',
          slug: 'mains-jh-eco-history',
          order: 9,
          topics: ['Economic development since 1947', 'Geography of Jharkhand', 'Forests', 'Rivers', 'Hills and mountains', 'Mines', 'Minerals', 'Economic utilization of resources']
        },
        {
          name: 'J. Industrial Policies, Displacement & Rehabilitation',
          slug: 'mains-jh-policies',
          order: 10,
          topics: ['Industrial Policies, Displacement & Rehabilitation']
        },
        {
          name: 'K. Major Industries of Jharkhand',
          slug: 'mains-jh-industries',
          order: 11,
          topics: ['Names of major industries', 'Locations', 'Industrial development']
        },
        {
          name: 'L. Important Schemes & Sub-schemes of Jharkhand',
          slug: 'mains-jh-schemes',
          order: 12,
          topics: ['Important Schemes & Sub-schemes of Jharkhand']
        },
        {
          name: 'M. Forest Management & Wildlife Conservation',
          slug: 'mains-jh-forest',
          order: 13,
          topics: ['Forest Management & Wildlife Conservation']
        },
        {
          name: 'N. Environment & Climate Change',
          slug: 'mains-jh-environment',
          order: 14,
          topics: ['Environmental facts of Jharkhand', 'Ongoing climate change', 'Mitigation', 'Adaptation', 'Issues related to mitigation', 'Issues related to adaptation']
        },
        {
          name: 'O. Disaster Management in Jharkhand',
          slug: 'mains-jh-disaster',
          order: 15,
          topics: ['Disaster Management in Jharkhand']
        },
        {
          name: 'P. Various Facts & Current Affairs Related to Jharkhand',
          slug: 'mains-jh-current-affairs',
          order: 16,
          topics: ['Various Facts & Current Affairs Related to Jharkhand']
        }
      ]
    }
  ]
};

function slugify(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
}

async function run() {
  await mongoose.connect(process.env.MONGODB_URI as string);
  console.log('Connected to MongoDB.');

  const exam = await Exam.findOne({ slug: 'jpsc-cce' }) || await Exam.findOne({ slug: 'jpsc' });
  if (!exam) {
    console.error('JPSC exam not found.');
    process.exit(1);
  }

  console.log('Deactivating old subjects and topics for JPSC...');
  await Subject.updateMany({ examId: exam!._id }, { $set: { isActive: false } });
  await Topic.updateMany({ examId: exam!._id }, { $set: { isActive: false } });

  console.log('Creating new hierarchy...');

  async function createStageHierarchy(stageDef: any) {
    let stage = await ExamStage.findOne({ examId: exam!._id, slug: stageDef.slug });
    if (!stage) {
      stage = new ExamStage({
        examId: exam!._id,
        name: stageDef.name,
        slug: stageDef.slug,
        order: stageDef.order,
        isActive: true
      });
      await stage.save();
    } else {
      stage.isActive = true;
      stage.name = stageDef.name;
      stage.order = stageDef.order;
      await stage.save();
    }

    for (const paperDef of stageDef.papers) {
      let paper = await ExamPaper.findOne({ examId: exam!._id, stageId: stage._id, slug: paperDef.slug });
      if (!paper) {
        paper = new ExamPaper({
          examId: exam!._id,
          stageId: stage._id,
          name: paperDef.name,
          slug: paperDef.slug,
          order: paperDef.order,
          isActive: true
        });
        await paper.save();
      } else {
        paper.isActive = true;
        paper.name = paperDef.name;
        paper.order = paperDef.order;
        await paper.save();
      }

      for (const subjectDef of paperDef.subjects) {
        let subject = await Subject.findOne({ examId: exam!._id, slug: subjectDef.slug });
        if (!subject) {
          subject = new Subject({
            examId: exam!._id,
            stageId: stage._id,
            paperId: paper._id,
            name: subjectDef.name,
            slug: subjectDef.slug,
            order: subjectDef.order,
            isActive: true
          });
          await subject.save();
        } else {
          subject.isActive = true;
          subject.name = subjectDef.name;
          subject.order = subjectDef.order;
          subject.stageId = stage._id;
          subject.paperId = paper._id;
          await subject.save();
        }

        let topicOrder = 1;
        for (const topicName of subjectDef.topics) {
          const tSlug = slugify(`${subjectDef.slug}-${topicName}`);
          let topic = await Topic.findOne({ subjectId: subject._id, slug: tSlug });
          if (!topic) {
            topic = new Topic({
              examId: exam!._id,
              stageId: stage._id,
              paperId: paper._id,
              subjectId: subject._id,
              name: topicName,
              slug: tSlug,
              order: topicOrder++,
              isActive: true
            });
            await topic.save();
          } else {
            topic.isActive = true;
            topic.name = topicName;
            topic.order = topicOrder++;
            topic.stageId = stage._id;
            topic.paperId = paper._id;
            await topic.save();
          }
        }
      }
    }
  }

  await createStageHierarchy(PRELIMS_DEF);
  await createStageHierarchy(MAINS_DEF);

  console.log('Hierarchy created.');

  // MAPPING STRATEGY
  // The user just deleted all questions from Paper I (jpsc-jharkhand subject), so there are 0 questions left in Paper I topics.
  // There might be some questions in Paper II (Traditional Tribal Governance, etc) if they were not moved correctly or if they still exist.
  // Let's find any orphaned active questions that used to belong to old active subjects.

  console.log('Remapping existing questions to new topics where applicable...');
  
  const getTopic = async (s: string, tName: string) => {
    const tSlug = slugify(`${s}-${tName}`);
    return Topic.findOne({ slug: tSlug });
  };

  // We map previous Paper II subjects to the Mains Jharkhand Specific GS-II syllabus.
  const mapping = [
    { oldSlug: 'munda-nagvanshi-governance', newSub: 'mains-jh-history', newTopName: 'Munda Governance System' },
    { oldSlug: 'padha-panchayat-manjhi', newSub: 'mains-jh-history', newTopName: 'Parha Panchayat Governance System' },
    { oldSlug: 'munda-manki-dhoklo', newSub: 'mains-jh-history', newTopName: 'Munda Manki Governance System' }
  ];

  for (const m of mapping) {
    const oldTop = await Topic.findOne({ slug: m.oldSlug });
    const newTop = await getTopic(m.newSub, m.newTopName);
    
    if (oldTop && newTop) {
      const res = await Question.updateMany(
        { topicId: oldTop._id },
        { $set: { 
          topicId: newTop._id, 
          subjectId: newTop.subjectId, 
          paperId: newTop.paperId,
          stageId: newTop.stageId 
        } }
      );
      if (res.modifiedCount > 0) {
        console.log(`Mapped ${res.modifiedCount} questions from ${m.oldSlug} to ${newTop.slug}`);
      }
    }
  }

  // Update target counts for new topics manually if needed, but for now we just let them be empty/0.

  console.log('Migration Complete.');
  process.exit(0);
}

run().catch(console.error);
