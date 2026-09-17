import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

import { Exam } from '../models/Exam';
import { ExamStage } from '../models/ExamStage';
import { ExamPaper } from '../models/ExamPaper';
import { Subject } from '../models/Subject';
import { Topic } from '../models/Topic';

async function seedJPSCPDF() {
  try {
    await mongoose.connect(process.env.MONGODB_URI as string);
    console.log('Connected to MongoDB');

    // 1. Audit and Soft-Delete existing JPSC syllabus items
    const jpscExam = await Exam.findOne({ slug: 'jpsc' });
    if (!jpscExam) {
      throw new Error('JPSC Exam not found in database. Please seed Exam first.');
    }

    console.log('Deactivating existing JPSC subjects and topics to prevent collisions...');
    await Subject.updateMany({ examId: jpscExam._id }, { $set: { isActive: false } });
    await Topic.updateMany({ examId: jpscExam._id }, { $set: { isActive: false } });
    await ExamStage.updateMany({ examId: jpscExam._id }, { $set: { isActive: false } });
    await ExamPaper.updateMany({ examId: jpscExam._id }, { $set: { isActive: false } });

    console.log('Old syllabus deactivated successfully.');

    // Helper functions for upserting
    async function upsertStage(slug: string, name: string, order: number) {
      return await ExamStage.findOneAndUpdate(
        { examId: jpscExam!._id, slug },
        { name, slug, order, isActive: true },
        { upsert: true, new: true }
      );
    }

    async function upsertPaper(stageId: mongoose.Types.ObjectId, slug: string, name: string, order: number, scoring: any, totalMarks: number) {
      return await ExamPaper.findOneAndUpdate(
        { stageId, slug },
        { examId: jpscExam!._id, stageId, name, slug, order, scoring, totalMarks, isActive: true },
        { upsert: true, new: true }
      );
    }

    async function upsertSubject(
      paperId: mongoose.Types.ObjectId,
      stageId: mongoose.Types.ObjectId,
      slug: string,
      name: string,
      order: number,
      meta?: { questionCount?: number, marks?: number, marksPerQuestion?: number, totalMarks?: number, qSpec?: boolean, mSpec?: boolean }
    ) {
      return await Subject.findOneAndUpdate(
        { paperId, slug },
        {
          examId: jpscExam!._id,
          stageId,
          paperId,
          name,
          slug,
          order,
          isActive: true,
          questionCount: meta?.questionCount || null,
          marks: meta?.marks || null,
          marksPerQuestion: meta?.marksPerQuestion || null,
          totalMarks: meta?.totalMarks || null,
          questionCountSpecifiedByPDF: meta?.qSpec || false,
          marksSpecifiedByPDF: meta?.mSpec || false,
        },
        { upsert: true, new: true }
      );
    }

    async function upsertTopic(
      subjectId: mongoose.Types.ObjectId,
      stageId: mongoose.Types.ObjectId,
      paperId: mongoose.Types.ObjectId,
      slug: string,
      name: string,
      order: number,
      meta?: { questionCount?: number, marks?: number, qSpec?: boolean, mSpec?: boolean }
    ) {
      return await Topic.findOneAndUpdate(
        { subjectId, slug },
        {
          examId: jpscExam!._id,
          stageId,
          paperId,
          subjectId,
          name,
          slug,
          order,
          isActive: true,
          questionCount: meta?.questionCount || null,
          marks: meta?.marks || null,
          questionCountSpecifiedByPDF: meta?.qSpec || false,
          marksSpecifiedByPDF: meta?.mSpec || false,
        },
        { upsert: true, new: true }
      );
    }

    // 2. Seeding Stages
    const prelimsStage = await upsertStage('prelims', 'Preliminary Examination', 1);
    const mainsStage = await upsertStage('mains', 'Main Examination', 2);

    // 3. Seeding Papers
    const gs1Paper = await upsertPaper(prelimsStage._id, 'gs-1', 'General Studies I', 1, { correctMarks: 2, wrongMarks: 0, unansweredMarks: 0 }, 200);
    const gs2Paper = await upsertPaper(prelimsStage._id, 'gs-2', 'General Studies II (Jharkhand Specific)', 2, { correctMarks: 2, wrongMarks: 0, unansweredMarks: 0 }, 200);

    const mainsP1 = await upsertPaper(mainsStage._id, 'mains-paper-1', 'Paper I (General Hindi & General English)', 1, {}, 100);
    const mainsP2 = await upsertPaper(mainsStage._id, 'mains-paper-2', 'Paper II (Language & Literature)', 2, {}, 150);
    const mainsP3 = await upsertPaper(mainsStage._id, 'mains-paper-3', 'Paper III (Social Sciences)', 3, {}, 200);
    const mainsP4 = await upsertPaper(mainsStage._id, 'mains-paper-4', 'Paper IV (Indian Constitution & Polity, Public Admin)', 4, {}, 200);
    const mainsP5 = await upsertPaper(mainsStage._id, 'mains-paper-5', 'Paper V (Indian Economy, Globalization & Sustainable Dev)', 5, {}, 200);
    const mainsP6 = await upsertPaper(mainsStage._id, 'mains-paper-6', 'Paper VI (General Science, Environment & Technology)', 6, {}, 200);

    // 4. Seeding Subjects & Topics

    /* =================================================================================
       PRELIMS GS-I
       ================================================================================= */
    let o = 1;
    let to = 1;
    // A. History of India
    const pGs1Hist = await upsertSubject(gs1Paper._id, prelimsStage._id, 'prelims-gs1-history', 'History of India', o++, { questionCount: 15, marks: 30, qSpec: true, mSpec: true });
    await upsertTopic(pGs1Hist._id, prelimsStage._id, gs1Paper._id, 'prelims-gs1-hist-ancient', 'Ancient India', to++, { questionCount: 5, marks: 10, qSpec: true, mSpec: true });
    await upsertTopic(pGs1Hist._id, prelimsStage._id, gs1Paper._id, 'prelims-gs1-hist-medieval', 'Medieval India', to++, { questionCount: 5, marks: 10, qSpec: true, mSpec: true });
    await upsertTopic(pGs1Hist._id, prelimsStage._id, gs1Paper._id, 'prelims-gs1-hist-modern', 'Modern India', to++, { questionCount: 5, marks: 10, qSpec: true, mSpec: true });

    // B. Geography of India
    to = 1;
    const pGs1Geo = await upsertSubject(gs1Paper._id, prelimsStage._id, 'prelims-gs1-geography', 'Geography of India', o++, { questionCount: 10, marks: 20, qSpec: true, mSpec: true });
    await upsertTopic(pGs1Geo._id, prelimsStage._id, gs1Paper._id, 'prelims-gs1-geo-general', 'General Geography', to++, { questionCount: 3, marks: 6, qSpec: true, mSpec: true });
    await upsertTopic(pGs1Geo._id, prelimsStage._id, gs1Paper._id, 'prelims-gs1-geo-physical', 'Physical Geography', to++, { questionCount: 3, marks: 6, qSpec: true, mSpec: true });
    await upsertTopic(pGs1Geo._id, prelimsStage._id, gs1Paper._id, 'prelims-gs1-geo-economic', 'Economic Geography', to++, { questionCount: 2, marks: 4, qSpec: true, mSpec: true });
    await upsertTopic(pGs1Geo._id, prelimsStage._id, gs1Paper._id, 'prelims-gs1-geo-social', 'Social & Demographic Geography', to++, { questionCount: 2, marks: 4, qSpec: true, mSpec: true });

    // C. Indian Polity & Governance
    to = 1;
    const pGs1Pol = await upsertSubject(gs1Paper._id, prelimsStage._id, 'prelims-gs1-polity', 'Indian Polity & Governance', o++, { questionCount: 10, marks: 20, qSpec: true, mSpec: true });
    await upsertTopic(pGs1Pol._id, prelimsStage._id, gs1Paper._id, 'prelims-gs1-pol-const', 'Constitution of India', to++, { questionCount: 4, marks: 8, qSpec: true, mSpec: true });
    await upsertTopic(pGs1Pol._id, prelimsStage._id, gs1Paper._id, 'prelims-gs1-pol-pubad', 'Public Administration & Good Governance', to++, { questionCount: 4, marks: 8, qSpec: true, mSpec: true });
    await upsertTopic(pGs1Pol._id, prelimsStage._id, gs1Paper._id, 'prelims-gs1-pol-decentralization', 'Decentralization: Panchayats & Municipalities', to++, { questionCount: 2, marks: 4, qSpec: true, mSpec: true });

    // D. Economy & Sustainable Development
    to = 1;
    const pGs1Eco = await upsertSubject(gs1Paper._id, prelimsStage._id, 'prelims-gs1-economy', 'Economy & Sustainable Development', o++, { questionCount: 10, marks: 20, qSpec: true, mSpec: true });
    await upsertTopic(pGs1Eco._id, prelimsStage._id, gs1Paper._id, 'prelims-gs1-eco-basics', 'Indian Economy Basics', to++, { questionCount: 4, marks: 8, qSpec: true, mSpec: true });
    await upsertTopic(pGs1Eco._id, prelimsStage._id, gs1Paper._id, 'prelims-gs1-eco-sustainable', 'Sustainable Development & Economic Issues', to++, { questionCount: 4, marks: 8, qSpec: true, mSpec: true });
    await upsertTopic(pGs1Eco._id, prelimsStage._id, gs1Paper._id, 'prelims-gs1-eco-reforms', 'Economic Reforms & Globalization', to++, { questionCount: 2, marks: 4, qSpec: true, mSpec: true });

    // E. Science & Technology
    to = 1;
    const pGs1Sci = await upsertSubject(gs1Paper._id, prelimsStage._id, 'prelims-gs1-science', 'Science & Technology', o++, { questionCount: 15, marks: 30, qSpec: true, mSpec: true });
    await upsertTopic(pGs1Sci._id, prelimsStage._id, gs1Paper._id, 'prelims-gs1-sci-general', 'General Science', to++, { questionCount: 6, marks: 12, qSpec: true, mSpec: true });
    await upsertTopic(pGs1Sci._id, prelimsStage._id, gs1Paper._id, 'prelims-gs1-sci-agri', 'Agriculture & Technology Development', to++, { questionCount: 6, marks: 12, qSpec: true, mSpec: true });
    await upsertTopic(pGs1Sci._id, prelimsStage._id, gs1Paper._id, 'prelims-gs1-sci-ict', 'Information & Communication Technology', to++, { questionCount: 3, marks: 6, qSpec: true, mSpec: true });

    // F. Jharkhand-Specific Awareness
    to = 1;
    const pGs1Jh = await upsertSubject(gs1Paper._id, prelimsStage._id, 'prelims-gs1-jharkhand', 'Jharkhand-Specific Awareness', o++, { questionCount: 10, marks: 20, qSpec: true, mSpec: true });
    await upsertTopic(pGs1Jh._id, prelimsStage._id, gs1Paper._id, 'prelims-gs1-jh-gk', 'General knowledge of Jharkhand history, society, culture and heritage', to++, { qSpec: false, mSpec: false });

    // G. National & International Current Events
    to = 1;
    const pGs1Cur = await upsertSubject(gs1Paper._id, prelimsStage._id, 'prelims-gs1-current', 'National & International Current Events', o++, { questionCount: 15, marks: 30, qSpec: true, mSpec: true });
    await upsertTopic(pGs1Cur._id, prelimsStage._id, gs1Paper._id, 'prelims-gs1-cur-latest', 'Latest developments on national & global fronts', to++, { qSpec: false, mSpec: false });

    // H. General Awareness (Miscellaneous)
    to = 1;
    const pGs1Misc = await upsertSubject(gs1Paper._id, prelimsStage._id, 'prelims-gs1-misc', 'General Awareness (Miscellaneous)', o++, { questionCount: 15, marks: 30, qSpec: true, mSpec: true });
    await upsertTopic(pGs1Misc._id, prelimsStage._id, gs1Paper._id, 'prelims-gs1-misc-hr', 'Human Rights', to++, { qSpec: false, mSpec: false });
    await upsertTopic(pGs1Misc._id, prelimsStage._id, gs1Paper._id, 'prelims-gs1-misc-env', 'Environment & Climate Change', to++, { qSpec: false, mSpec: false });
    await upsertTopic(pGs1Misc._id, prelimsStage._id, gs1Paper._id, 'prelims-gs1-misc-urban', 'Urbanization', to++, { qSpec: false, mSpec: false });
    await upsertTopic(pGs1Misc._id, prelimsStage._id, gs1Paper._id, 'prelims-gs1-misc-sports', 'Sports', to++, { qSpec: false, mSpec: false });
    await upsertTopic(pGs1Misc._id, prelimsStage._id, gs1Paper._id, 'prelims-gs1-misc-disaster', 'Disaster Management', to++, { qSpec: false, mSpec: false });
    await upsertTopic(pGs1Misc._id, prelimsStage._id, gs1Paper._id, 'prelims-gs1-misc-pov', 'Poverty & Unemployment', to++, { qSpec: false, mSpec: false });
    await upsertTopic(pGs1Misc._id, prelimsStage._id, gs1Paper._id, 'prelims-gs1-misc-awards', 'Awards', to++, { qSpec: false, mSpec: false });
    await upsertTopic(pGs1Misc._id, prelimsStage._id, gs1Paper._id, 'prelims-gs1-misc-un', 'UN & International Agencies', to++, { qSpec: false, mSpec: false });

    /* =================================================================================
       PRELIMS GS-II
       ================================================================================= */
    o = 1;
    
    // A. History of Jharkhand
    to = 1;
    const pGs2Hist = await upsertSubject(gs2Paper._id, prelimsStage._id, 'prelims-gs2-history', 'A. History of Jharkhand', o++, { questionCount: 8, marks: 16, qSpec: true, mSpec: true });
    await upsertTopic(pGs2Hist._id, prelimsStage._id, gs2Paper._id, 'prelims-gs2-hist-munda', 'Munda Governance System', to++, { questionCount: 1, marks: 2, qSpec: true, mSpec: true });
    await upsertTopic(pGs2Hist._id, prelimsStage._id, gs2Paper._id, 'prelims-gs2-hist-nagvanshi', 'Nagvanshi Governance System', to++, { questionCount: 1, marks: 2, qSpec: true, mSpec: true });
    await upsertTopic(pGs2Hist._id, prelimsStage._id, gs2Paper._id, 'prelims-gs2-hist-parha', 'Parha Panchayat Governance System', to++, { questionCount: 1, marks: 2, qSpec: true, mSpec: true });
    await upsertTopic(pGs2Hist._id, prelimsStage._id, gs2Paper._id, 'prelims-gs2-hist-manjhi', 'Manjhi Pargana Administration System', to++, { questionCount: 1, marks: 2, qSpec: true, mSpec: true });
    await upsertTopic(pGs2Hist._id, prelimsStage._id, gs2Paper._id, 'prelims-gs2-hist-manki', 'Munda Manki Governance System', to++, { questionCount: 1, marks: 2, qSpec: true, mSpec: true });
    await upsertTopic(pGs2Hist._id, prelimsStage._id, gs2Paper._id, 'prelims-gs2-hist-dhoklo', 'Dhoklo Sohor Governance System', to++, { questionCount: 1, marks: 2, qSpec: true, mSpec: true });
    await upsertTopic(pGs2Hist._id, prelimsStage._id, gs2Paper._id, 'prelims-gs2-hist-jatiya', 'Jatiya Panchayat Governance System', to++, { questionCount: 2, marks: 4, qSpec: true, mSpec: true });

    // B. Jharkhand Movement
    to = 1;
    const pGs2Mov = await upsertSubject(gs2Paper._id, prelimsStage._id, 'prelims-gs2-movement', 'B. Jharkhand Movement', o++, { questionCount: 7, marks: 14, qSpec: true, mSpec: true });
    await upsertTopic(pGs2Mov._id, prelimsStage._id, gs2Paper._id, 'prelims-gs2-mov-sadan', 'Sadan of Jharkhand', to++, { questionCount: 1, marks: 2, qSpec: true, mSpec: true });
    await upsertTopic(pGs2Mov._id, prelimsStage._id, gs2Paper._id, 'prelims-gs2-mov-tribes', 'Tribes of Jharkhand', to++, { questionCount: 1, marks: 2, qSpec: true, mSpec: true });
    await upsertTopic(pGs2Mov._id, prelimsStage._id, gs2Paper._id, 'prelims-gs2-mov-freedom', 'Freedom Fighters of Jharkhand', to++, { questionCount: 1, marks: 2, qSpec: true, mSpec: true });
    await upsertTopic(pGs2Mov._id, prelimsStage._id, gs2Paper._id, 'prelims-gs2-mov-vibhuti', 'Vibhuti of Jharkhand', to++, { questionCount: 2, marks: 4, qSpec: true, mSpec: true });
    await upsertTopic(pGs2Mov._id, prelimsStage._id, gs2Paper._id, 'prelims-gs2-mov-state', 'Jharkhand Movement and State Formation', to++, { questionCount: 2, marks: 4, qSpec: true, mSpec: true });

    // C. Unique Identity of Jharkhand
    to = 1;
    const pGs2Ident = await upsertSubject(gs2Paper._id, prelimsStage._id, 'prelims-gs2-identity', 'C. Unique Identity of Jharkhand', o++, { questionCount: 5, marks: 10, qSpec: true, mSpec: true });
    await upsertTopic(pGs2Ident._id, prelimsStage._id, gs2Paper._id, 'prelims-gs2-id-social', 'Social Scenario of Jharkhand', to++, { questionCount: 1, marks: 2, qSpec: true, mSpec: true });
    await upsertTopic(pGs2Ident._id, prelimsStage._id, gs2Paper._id, 'prelims-gs2-id-cultural', 'Cultural Scenario of Jharkhand', to++, { questionCount: 1, marks: 2, qSpec: true, mSpec: true });
    await upsertTopic(pGs2Ident._id, prelimsStage._id, gs2Paper._id, 'prelims-gs2-id-political', 'Political Scenario of Jharkhand', to++, { questionCount: 1, marks: 2, qSpec: true, mSpec: true });
    await upsertTopic(pGs2Ident._id, prelimsStage._id, gs2Paper._id, 'prelims-gs2-id-economic', 'Economic Scenario of Jharkhand', to++, { questionCount: 1, marks: 2, qSpec: true, mSpec: true });
    await upsertTopic(pGs2Ident._id, prelimsStage._id, gs2Paper._id, 'prelims-gs2-id-religious', 'Religious Peculiarities and Identity of Jharkhand', to++, { questionCount: 1, marks: 2, qSpec: true, mSpec: true });

    // D. Folk Culture
    to = 1;
    const pGs2Folk = await upsertSubject(gs2Paper._id, prelimsStage._id, 'prelims-gs2-folk', 'D. Folk Literature, Dance, Music, Instruments, Tourist Places and Tribal Culture', o++, { questionCount: 5, marks: 10, qSpec: true, mSpec: true });
    await upsertTopic(pGs2Folk._id, prelimsStage._id, gs2Paper._id, 'prelims-gs2-folk-literature', 'Folk Literature', to++, { questionCount: 1, marks: 2, qSpec: true, mSpec: true });
    await upsertTopic(pGs2Folk._id, prelimsStage._id, gs2Paper._id, 'prelims-gs2-folk-arts', 'Traditional Arts and Folk Dances', to++, { questionCount: 1, marks: 2, qSpec: true, mSpec: true });
    await upsertTopic(pGs2Folk._id, prelimsStage._id, gs2Paper._id, 'prelims-gs2-folk-music', 'Folk Music and Instruments', to++, { questionCount: 1, marks: 2, qSpec: true, mSpec: true });
    await upsertTopic(pGs2Folk._id, prelimsStage._id, gs2Paper._id, 'prelims-gs2-folk-tourist', 'Tourist Places', to++, { questionCount: 1, marks: 2, qSpec: true, mSpec: true });
    await upsertTopic(pGs2Folk._id, prelimsStage._id, gs2Paper._id, 'prelims-gs2-folk-tribes', 'Tribes — Sub-Castes and Characteristics', to++, { questionCount: 1, marks: 2, qSpec: true, mSpec: true });

    // E. Literature and Authors
    to = 1;
    const pGs2Lit = await upsertSubject(gs2Paper._id, prelimsStage._id, 'prelims-gs2-literature', 'E. Literature and Authors of Jharkhand', o++, { questionCount: 5, marks: 10, qSpec: true, mSpec: true });
    await upsertTopic(pGs2Lit._id, prelimsStage._id, gs2Paper._id, 'prelims-gs2-lit-authors', 'Literature and Authors of Jharkhand', to++, { qSpec: false, mSpec: false });

    // F. Educational Institutions
    to = 1;
    const pGs2Edu = await upsertSubject(gs2Paper._id, prelimsStage._id, 'prelims-gs2-educational', 'F. Important Educational Institutions of Jharkhand', o++, { questionCount: 3, marks: 6, qSpec: true, mSpec: true });
    await upsertTopic(pGs2Edu._id, prelimsStage._id, gs2Paper._id, 'prelims-gs2-edu-inst', 'Important Educational Institutions', to++, { qSpec: false, mSpec: false });

    // G. Sports
    to = 1;
    const pGs2Sports = await upsertSubject(gs2Paper._id, prelimsStage._id, 'prelims-gs2-sports', 'G. Sports of Jharkhand', o++, { questionCount: 5, marks: 10, qSpec: true, mSpec: true });
    await upsertTopic(pGs2Sports._id, prelimsStage._id, gs2Paper._id, 'prelims-gs2-sports-jh', 'Sports of Jharkhand', to++, { qSpec: false, mSpec: false });

    // H. Land Related Laws
    to = 1;
    const pGs2Land = await upsertSubject(gs2Paper._id, prelimsStage._id, 'prelims-gs2-land-laws', 'H. Land Related Laws / Acts of Jharkhand', o++, { questionCount: 12, marks: 24, qSpec: true, mSpec: true });
    await upsertTopic(pGs2Land._id, prelimsStage._id, gs2Paper._id, 'prelims-gs2-land-cnt', 'Chotanagpur Tenancy Act (C.N.T.)', to++, { questionCount: 5, marks: 10, qSpec: true, mSpec: true });
    await upsertTopic(pGs2Land._id, prelimsStage._id, gs2Paper._id, 'prelims-gs2-land-spt', 'Santhal Pargana Tenancy Act (S.P.T.)', to++, { questionCount: 5, marks: 10, qSpec: true, mSpec: true });
    await upsertTopic(pGs2Land._id, prelimsStage._id, gs2Paper._id, 'prelims-gs2-land-other', 'Other State-Related Acts', to++, { questionCount: 2, marks: 4, qSpec: true, mSpec: true });

    // I. History of Economic Development
    to = 1;
    const pGs2EconDev = await upsertSubject(gs2Paper._id, prelimsStage._id, 'prelims-gs2-econ-dev', 'I. History of Economic Development in Jharkhand Since 1947', o++, { questionCount: 10, marks: 20, qSpec: true, mSpec: true });
    await upsertTopic(pGs2EconDev._id, prelimsStage._id, gs2Paper._id, 'prelims-gs2-econ-dev-history', 'History of economic development in Jharkhand since 1947', to++, { qSpec: false, mSpec: false });
    await upsertTopic(pGs2EconDev._id, prelimsStage._id, gs2Paper._id, 'prelims-gs2-econ-dev-geo', 'Geography of Jharkhand, Forests, Rivers, Hills, Mines, Minerals, Economic Utilization', to++, { qSpec: false, mSpec: false });

    // J. Industrial Policies, Displacement & Rehabilitation
    to = 1;
    const pGs2IndPol = await upsertSubject(gs2Paper._id, prelimsStage._id, 'prelims-gs2-industrial-policies', 'J. Industrial Policies, Displacement and Rehabilitation', o++, { questionCount: 6, marks: 12, qSpec: true, mSpec: true });
    await upsertTopic(pGs2IndPol._id, prelimsStage._id, gs2Paper._id, 'prelims-gs2-indpol-policies', 'Industrial Policies, Displacement, Rehabilitation and Other Policies', to++, { qSpec: false, mSpec: false });

    // K. Major Industries
    to = 1;
    const pGs2Indus = await upsertSubject(gs2Paper._id, prelimsStage._id, 'prelims-gs2-industries', 'K. Major Industries of Jharkhand', o++, { questionCount: 5, marks: 10, qSpec: true, mSpec: true });
    await upsertTopic(pGs2Indus._id, prelimsStage._id, gs2Paper._id, 'prelims-gs2-indus-major', 'Names of major industries, Location and Industrial development of Jharkhand', to++, { qSpec: false, mSpec: false });

    // L. Important Schemes
    to = 1;
    const pGs2Schemes = await upsertSubject(gs2Paper._id, prelimsStage._id, 'prelims-gs2-schemes', 'L. Important Schemes and Sub-schemes of Jharkhand', o++, { questionCount: 5, marks: 10, qSpec: true, mSpec: true });
    await upsertTopic(pGs2Schemes._id, prelimsStage._id, gs2Paper._id, 'prelims-gs2-schemes-jh', 'Important Schemes and Sub-schemes of Jharkhand', to++, { qSpec: false, mSpec: false });

    // M. Forest Management & Wildlife Conservation
    to = 1;
    const pGs2Forest = await upsertSubject(gs2Paper._id, prelimsStage._id, 'prelims-gs2-forest', 'M. Forest Management and Wildlife Conservation', o++, { questionCount: 5, marks: 10, qSpec: true, mSpec: true });
    await upsertTopic(pGs2Forest._id, prelimsStage._id, gs2Paper._id, 'prelims-gs2-forest-mgmt', 'Forest Management and Wildlife Conservation of Jharkhand', to++, { qSpec: false, mSpec: false });

    // N. Environment & Climate Change
    to = 1;
    const pGs2Env = await upsertSubject(gs2Paper._id, prelimsStage._id, 'prelims-gs2-env', 'N. Environment and Climate Change', o++, { questionCount: 7, marks: 14, qSpec: true, mSpec: true });
    await upsertTopic(pGs2Env._id, prelimsStage._id, gs2Paper._id, 'prelims-gs2-env-facts', 'Environmental facts, Ongoing environmental change, Climate Change, Mitigation, Adaptation', to++, { qSpec: false, mSpec: false });

    // O. Disaster Management
    to = 1;
    const pGs2Disaster = await upsertSubject(gs2Paper._id, prelimsStage._id, 'prelims-gs2-disaster', 'O. Disaster Management in Jharkhand', o++, { questionCount: 5, marks: 10, qSpec: true, mSpec: true });
    await upsertTopic(pGs2Disaster._id, prelimsStage._id, gs2Paper._id, 'prelims-gs2-disaster-jh', 'Disaster Management in Jharkhand', to++, { qSpec: false, mSpec: false });

    // P. Facts and Current Affairs
    to = 1;
    const pGs2Curr = await upsertSubject(gs2Paper._id, prelimsStage._id, 'prelims-gs2-current', 'P. Various Facts and Current Affairs Related to Jharkhand', o++, { questionCount: 7, marks: 14, qSpec: true, mSpec: true });
    await upsertTopic(pGs2Curr._id, prelimsStage._id, gs2Paper._id, 'prelims-gs2-curr-jh', 'Various facts and current affairs related to Jharkhand', to++, { qSpec: false, mSpec: false });


    /* =================================================================================
       MAINS PAPER I
       ================================================================================= */
    o = 1;
    to = 1;
    const mP1Hindi = await upsertSubject(mainsP1._id, mainsStage._id, 'mains-p1-hindi', 'General Hindi', o++, { marks: 50, mSpec: true });
    await upsertTopic(mP1Hindi._id, mainsStage._id, mainsP1._id, 'mains-p1-hindi-essay', 'Essay', to++, { marks: 15, mSpec: true });
    await upsertTopic(mP1Hindi._id, mainsStage._id, mainsP1._id, 'mains-p1-hindi-grammar', 'Grammar', to++, { marks: 15, mSpec: true });
    await upsertTopic(mP1Hindi._id, mainsStage._id, mainsP1._id, 'mains-p1-hindi-sentence', 'Sentence Structure', to++, { marks: 10, mSpec: true });
    await upsertTopic(mP1Hindi._id, mainsStage._id, mainsP1._id, 'mains-p1-hindi-precis', 'Precis', to++, { marks: 10, mSpec: true });

    to = 1;
    const mP1Eng = await upsertSubject(mainsP1._id, mainsStage._id, 'mains-p1-english', 'General English', o++, { marks: 50, mSpec: true });
    await upsertTopic(mP1Eng._id, mainsStage._id, mainsP1._id, 'mains-p1-eng-essay', 'Essay', to++, { marks: 15, mSpec: true });
    await upsertTopic(mP1Eng._id, mainsStage._id, mainsP1._id, 'mains-p1-eng-grammar', 'Grammar', to++, { marks: 15, mSpec: true });
    await upsertTopic(mP1Eng._id, mainsStage._id, mainsP1._id, 'mains-p1-eng-comprehension', 'Comprehension', to++, { marks: 10, mSpec: true });
    await upsertTopic(mP1Eng._id, mainsStage._id, mainsP1._id, 'mains-p1-eng-precis', 'Precis', to++, { marks: 10, mSpec: true });

    /* =================================================================================
       MAINS PAPER II (Language)
       ================================================================================= */
    o = 1;
    const languages = [
      'Oriyya', 'Bangali', 'Urdu', 'Sanskrit', 'English', 'Hindi', 'Santhali', 'Panchpargania',
      'Nagpuri', 'Mundari', 'Kurux', 'Kurmali', 'Khortha', 'Khadia', 'Ho'
    ];
    for (const lang of languages) {
      const sub = await upsertSubject(mainsP2._id, mainsStage._id, `mains-p2-${lang.toLowerCase()}`, `${lang} Language & Literature`, o++, { marks: 150, mSpec: true });
      await upsertTopic(sub._id, mainsStage._id, mainsP2._id, `mains-p2-${lang.toLowerCase()}-lit`, `${lang} Language & Literature`, 1, { qSpec: false, mSpec: false });
    }

    /* =================================================================================
       MAINS PAPER III
       ================================================================================= */
    o = 1;
    to = 1;
    const mP3Hist = await upsertSubject(mainsP3._id, mainsStage._id, 'mains-p3-history', 'SECTION A — HISTORY', o++, { marks: 100, mSpec: true });
    await upsertTopic(mP3Hist._id, mainsStage._id, mainsP3._id, 'mains-p3-hist-ancient', 'Ancient Period', to++, { qSpec: false, mSpec: false });
    await upsertTopic(mP3Hist._id, mainsStage._id, mainsP3._id, 'mains-p3-hist-medieval', 'Medieval Period', to++, { qSpec: false, mSpec: false });
    await upsertTopic(mP3Hist._id, mainsStage._id, mainsP3._id, 'mains-p3-hist-modern', 'Modern Period', to++, { qSpec: false, mSpec: false });
    await upsertTopic(mP3Hist._id, mainsStage._id, mainsP3._id, 'mains-p3-hist-jharkhand', 'History of Jharkhand', to++, { qSpec: false, mSpec: false });

    to = 1;
    const mP3Geo = await upsertSubject(mainsP3._id, mainsStage._id, 'mains-p3-geography', 'SECTION B — GEOGRAPHY', o++, { marks: 100, mSpec: true });
    await upsertTopic(mP3Geo._id, mainsStage._id, mainsP3._id, 'mains-p3-geo-physical', 'Physical Geography - General Principles', to++, { qSpec: false, mSpec: false });
    await upsertTopic(mP3Geo._id, mainsStage._id, mainsP3._id, 'mains-p3-geo-india', 'Physical and Human Geography of India', to++, { qSpec: false, mSpec: false });
    await upsertTopic(mP3Geo._id, mainsStage._id, mainsP3._id, 'mains-p3-geo-resources', 'Natural Resources of India: Development and Utilization', to++, { qSpec: false, mSpec: false });
    await upsertTopic(mP3Geo._id, mainsStage._id, mainsP3._id, 'mains-p3-geo-jharkhand', 'Geography of Jharkhand and Utilization of its Resources', to++, { qSpec: false, mSpec: false });

    /* =================================================================================
       MAINS PAPER IV
       ================================================================================= */
    o = 1;
    to = 1;
    const mP4Polity = await upsertSubject(mainsP4._id, mainsStage._id, 'mains-p4-polity', 'SECTION A — INDIAN CONSTITUTION AND POLITY', o++, { marks: 100, mSpec: true });
    await upsertTopic(mP4Polity._id, mainsStage._id, mainsP4._id, 'mains-p4-polity-preamble', 'Preamble, Salient Features, PIL, Basic Structure', to++, { qSpec: false, mSpec: false });
    await upsertTopic(mP4Polity._id, mainsStage._id, mainsP4._id, 'mains-p4-polity-rights', 'Fundamental Rights, Duties, DPSP', to++, { qSpec: false, mSpec: false });
    await upsertTopic(mP4Polity._id, mainsStage._id, mainsP4._id, 'mains-p4-polity-union', 'Union Government (Executive, Legislature, Judiciary)', to++, { qSpec: false, mSpec: false });
    await upsertTopic(mP4Polity._id, mainsStage._id, mainsP4._id, 'mains-p4-polity-state', 'State Government (Executive, Legislature, Judiciary)', to++, { qSpec: false, mSpec: false });
    await upsertTopic(mP4Polity._id, mainsStage._id, mainsP4._id, 'mains-p4-polity-panchayat', 'Panchayats, Municipalities, Centre-State Relations', to++, { qSpec: false, mSpec: false });
    await upsertTopic(mP4Polity._id, mainsStage._id, mainsP4._id, 'mains-p4-polity-other', 'Scheduled Areas, Election Commission, Political Parties, Pressure Groups', to++, { qSpec: false, mSpec: false });

    to = 1;
    const mP4PubAd = await upsertSubject(mainsP4._id, mainsStage._id, 'mains-p4-pubad', 'SECTION B — PUBLIC ADMINISTRATION & GOOD GOVERNANCE', o++, { marks: 100, mSpec: true });
    await upsertTopic(mP4PubAd._id, mainsStage._id, mainsP4._id, 'mains-p4-pubad-intro', 'Public Administration, Union/State/District Administration', to++, { qSpec: false, mSpec: false });
    await upsertTopic(mP4PubAd._id, mainsStage._id, mainsP4._id, 'mains-p4-pubad-personnel', 'Personnel Administration, Delegation, Centralization, Bureaucracy', to++, { qSpec: false, mSpec: false });
    await upsertTopic(mP4PubAd._id, mainsStage._id, mainsP4._id, 'mains-p4-pubad-disaster', 'Development Administration and Disaster Management', to++, { qSpec: false, mSpec: false });
    await upsertTopic(mP4PubAd._id, mainsStage._id, mainsP4._id, 'mains-p4-pubad-goodgov', 'Good Governance, Acts (RTI, RTE, Consumer), Human Rights', to++, { qSpec: false, mSpec: false });

    /* =================================================================================
       MAINS PAPER V
       ================================================================================= */
    o = 1;
    to = 1;
    const mP5EcoA = await upsertSubject(mainsP5._id, mainsStage._id, 'mains-p5-eco-group-a', 'GROUP A — BASIC FEATURES OF INDIAN ECONOMY', o++, { qSpec: false, mSpec: false });
    await upsertTopic(mP5EcoA._id, mainsStage._id, mainsP5._id, 'mains-p5-eco-a-national-income', 'National Income, Inflation, Demographics', to++, { qSpec: false, mSpec: false });
    await upsertTopic(mP5EcoA._id, mainsStage._id, mainsP5._id, 'mains-p5-eco-a-agri-industry', 'Agriculture, Rural Economy, Industrial Economy', to++, { qSpec: false, mSpec: false });
    await upsertTopic(mP5EcoA._id, mainsStage._id, mainsP5._id, 'mains-p5-eco-a-public-finance', 'Public Finance, Expenditure, Budget, Fiscal Policy', to++, { qSpec: false, mSpec: false });

    to = 1;
    const mP5EcoB = await upsertSubject(mainsP5._id, mainsStage._id, 'mains-p5-eco-group-b', 'GROUP B — SUSTAINABLE DEVELOPMENT, ECONOMIC ISSUES', o++, { qSpec: false, mSpec: false });
    await upsertTopic(mP5EcoB._id, mainsStage._id, mainsP5._id, 'mains-p5-eco-b-dev', 'Economic Development, Indicators, Sustainable Development', to++, { qSpec: false, mSpec: false });
    await upsertTopic(mP5EcoB._id, mainsStage._id, mainsP5._id, 'mains-p5-eco-b-inclusive', 'Inclusive Growth, Poverty, Unemployment, Food Security', to++, { qSpec: false, mSpec: false });
    await upsertTopic(mP5EcoB._id, mainsStage._id, mainsP5._id, 'mains-p5-eco-b-planning', 'Planning Strategy, Decentralized Planning', to++, { qSpec: false, mSpec: false });

    to = 1;
    const mP5EcoC = await upsertSubject(mainsP5._id, mainsStage._id, 'mains-p5-eco-group-c', 'GROUP C — ECONOMIC REFORMS', o++, { qSpec: false, mSpec: false });
    await upsertTopic(mP5EcoC._id, mainsStage._id, mainsP5._id, 'mains-p5-eco-c-reforms', 'New Economic Reforms, International Financial Institutions', to++, { qSpec: false, mSpec: false });
    await upsertTopic(mP5EcoC._id, mainsStage._id, mainsP5._id, 'mains-p5-eco-c-banking', 'Banking sector reforms, Globalization, Agriculture/Industry reforms', to++, { qSpec: false, mSpec: false });

    to = 1;
    const mP5EcoD = await upsertSubject(mainsP5._id, mainsStage._id, 'mains-p5-eco-group-d', 'GROUP D — ECONOMY OF JHARKHAND', o++, { qSpec: false, mSpec: false });
    await upsertTopic(mP5EcoD._id, mainsStage._id, mainsP5._id, 'mains-p5-eco-d-growth', 'Economic growth, structure, Demographic features', to++, { qSpec: false, mSpec: false });
    await upsertTopic(mP5EcoD._id, mainsStage._id, mainsP5._id, 'mains-p5-eco-d-issues', 'Poverty, Unemployment, Food security, Land, forest and environmental issues', to++, { qSpec: false, mSpec: false });
    await upsertTopic(mP5EcoD._id, mainsStage._id, mainsP5._id, 'mains-p5-eco-d-plans', 'Five Year Plans, Public finance, Industrial policy', to++, { qSpec: false, mSpec: false });

    /* =================================================================================
       MAINS PAPER VI
       ================================================================================= */
    o = 1;
    to = 1;
    const mP6SciA = await upsertSubject(mainsP6._id, mainsStage._id, 'mains-p6-sci-group-a', 'GROUP A — PHYSICAL SCIENCE', o++, { qSpec: false, mSpec: false });
    await upsertTopic(mP6SciA._id, mainsStage._id, mainsP6._id, 'mains-p6-sci-a-units', 'System of Units, Definitions, Solar System, Sound', to++, { qSpec: false, mSpec: false });

    to = 1;
    const mP6SciB = await upsertSubject(mainsP6._id, mainsStage._id, 'mains-p6-sci-group-b', 'GROUP B — LIFE SCIENCE', o++, { qSpec: false, mSpec: false });
    await upsertTopic(mP6SciB._id, mainsStage._id, mainsP6._id, 'mains-p6-sci-b-cell', 'Living world, Cell structure, Biomolecules, Enzymes, Hormones', to++, { qSpec: false, mSpec: false });
    await upsertTopic(mP6SciB._id, mainsStage._id, mainsP6._id, 'mains-p6-sci-b-genetics', 'Cell reproduction, Inheritance, DNA, Evolution', to++, { qSpec: false, mSpec: false });

    to = 1;
    const mP6SciC = await upsertSubject(mainsP6._id, mainsStage._id, 'mains-p6-sci-group-c', 'GROUP C — AGRICULTURE SCIENCE', o++, { qSpec: false, mSpec: false });
    await upsertTopic(mP6SciC._id, mainsStage._id, mainsP6._id, 'mains-p6-sci-c-jh', 'Agro-climatic zones of Jharkhand, Rain-fed agriculture, Soil fertility, Agro-forestry, Biotechnology', to++, { qSpec: false, mSpec: false });

    to = 1;
    const mP6SciD = await upsertSubject(mainsP6._id, mainsStage._id, 'mains-p6-sci-group-d', 'GROUP D — ENVIRONMENTAL SCIENCE', o++, { qSpec: false, mSpec: false });
    await upsertTopic(mP6SciD._id, mainsStage._id, mainsP6._id, 'mains-p6-sci-d-env', 'Ecosystem, Natural Resources, Environmental Conservation, Pollution, Biodiversity, Climate change, Environmental Laws', to++, { qSpec: false, mSpec: false });

    to = 1;
    const mP6SciE = await upsertSubject(mainsP6._id, mainsStage._id, 'mains-p6-sci-group-e', 'GROUP E — SCIENCE & TECHNOLOGY DEVELOPMENT', o++, { qSpec: false, mSpec: false });
    await upsertTopic(mP6SciE._id, mainsStage._id, mainsP6._id, 'mains-p6-sci-e-tech', 'National Policy, Energy, Nuclear Energy, Space Technology, IT, National Health Programmes', to++, { qSpec: false, mSpec: false });


    console.log('Successfully seeded exactly to the 10-page JPSC PDF specification.');
    await mongoose.disconnect();
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

seedJPSCPDF();
