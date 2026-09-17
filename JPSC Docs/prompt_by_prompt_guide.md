# JPSC Implementation — Prompt-by-Prompt Execution Guide

This document contains **ready-to-use, copy-paste execution prompts** for implementing the entire JPSC feature step-by-step.

You can paste these prompts sequentially into your AI assistant or follow them as an engineering checklist.

---

## 📋 Execution Roadmap Summary

| Step | Phase | Focus Area | Status |
| :--- | :--- | :--- | :--- |
| **Foundation** | Phase 1 | Multi-Exam Database Foundation | ✅ COMPLETED |
| **Prompt 1** | Phase 2 | SSC Data Migration & Backfill | ✅ COMPLETED |
| **Prompt 2** | Phase 3 | Multi-Exam Backend APIs | ✅ COMPLETED |
| **Prompt 3** | Phase 4 | Frontend Exam Context & Switcher | ✅ COMPLETED |
| **Prompt 4** | Phase 5 | JPSC Syllabus Ingestion | ✅ COMPLETED |
| **Prompt 5** | Phase 6 | JPSC Seed Question Bank (Paper I) | ✅ COMPLETED |
| **Prompt 6** | Phase 7 | JPSC Paper II Question Bank & Mock Engine | ✅ COMPLETED |
| **Prompt 7** | Phase 8 | End-to-End Validation & APK | ⏳ UP NEXT |

---

## 🚀 PROMPT 1: Phase 2 — SSC Data Migration & Backfill (COMPLETED)

```markdown
### Task: SSC Data Migration & Backfill (Phase 2)

We have created the Exam, ExamStage, and ExamPaper foundation models and seeded the root SSC CGL hierarchy (`ssc-cgl`, `tier-1`, `tier-1`).

Now, execute the migration to link all existing SSC documents in MongoDB to this hierarchy safely and idempotently.

#### Requirements:
1. Create a safe, idempotent migration script: `backend/src/scripts/migrateSSCData.ts`.
2. Find the root SSC CGL Exam (`slug: 'ssc-cgl'`), Tier 1 Stage (`slug: 'tier-1'`), and Tier 1 Paper (`slug: 'tier-1'`).
3. Update all existing canonical `Subject` documents that currently have no `examId` (or whose `slug` matches quant, reasoning, english, general-awareness):
   - Set `examId: sscExam._id`
   - Set `stageId: sscStage._id`
   - Set `paperId: sscPaper._id`
4. Update all existing `Topic` documents belonging to these subjects:
   - Set `examId: sscExam._id`, `stageId: sscStage._id`, `paperId: sscPaper._id`.
5. Update all existing `Question` documents belonging to these topics:
   - Set `examId: sscExam._id`, `stageId: sscStage._id`, `paperId: sscPaper._id`.
6. Print a comprehensive migration summary:
   - Total subjects migrated
   - Total topics migrated
   - Total questions migrated
7. The script must be idempotent (safe to run multiple times without duplicating or corrupting data).
8. Run `npx tsx src/scripts/migrateSSCData.ts` and verify with `npm test`.
```

---

## 🚀 PROMPT 2: Phase 3 — Multi-Exam Backend APIs & Query Filters (COMPLETED)

```markdown
### Task: Multi-Exam Backend API Query Filters (Phase 3)

Update the backend REST API to allow filtering content by exam and paper, while maintaining 100% backward compatibility for existing clients.

#### Requirements:
1. Update `backend/src/controllers/subjectController.ts`:
   - Support query parameters: `GET /api/subjects?exam=ssc-cgl&paper=tier-1`.
   - If `exam` query is provided, resolve `Exam` by slug and filter `{ examId: exam._id, isActive: true }`.
   - If `paper` query is provided, resolve `ExamPaper` by slug and filter `{ paperId: paper._id }`.
   - If no query is provided, default safely to returning active subjects (preserving legacy client behavior).
2. Create Exam discovery endpoints in `backend/src/routes/examRoutes.ts` and `backend/src/controllers/examController.ts`:
   - `GET /api/exams`: Returns list of all active exams with name, slug, description, and icon.
   - `GET /api/exams/:examSlug/papers`: Returns all papers belonging to the exam's active stage.
3. Register `examRoutes` in `backend/src/app.ts` under `/api/exams`.
4. Update `questionSelectionService.ts`:
   - Ensure practice question selection accepts optional `examId` / `paperId` filter.
5. Verify with `npm run build` and run `npm test`.
```

---

## 🚀 PROMPT 3: Phase 4 — Frontend Exam Context & Header Switcher UI

```markdown
### Task: Frontend Exam Context & Switcher UI (Phase 4)

Implement exam switching in the mobile app with complete client-side data isolation between SSC CGL and JPSC.

#### Requirements:
1. Create `mobile/src/context/ExamContext.tsx`:
   - Maintain `currentExam`: `'ssc-cgl' | 'jpsc'`.
   - Maintain `currentPaper`: `'tier-1' | 'paper-1' | 'paper-2'`.
   - Persist selection in `AsyncStorage` under `@app_active_exam` and `@app_active_paper`.
   - Provide `switchExam(examSlug)` and `switchPaper(paperSlug)` methods.
2. Create `mobile/src/components/ExamSwitchModal.tsx`:
   - A bottom sheet / modal with rich cards for:
     - 🏆 **SSC CGL**: "Tier 1 & Tier 2 Preparation (Quant, Reasoning, English, GA)"
     - 🏛️ **JPSC**: "Combined Civil Services (Prelims Paper 1 & Paper 2)"
3. Update `mobile/src/screens/HomeScreen.tsx`:
   - Add Exam Pill button in the header (`[ 🏛️ JPSC ▾ ]` / `[ 🏆 SSC CGL ▾ ]`).
   - If `currentExam === 'jpsc'`, display a dual-tab Paper Selector: `[ Paper I: GS-I ]` and `[ Paper II: Jharkhand Special ]`.
   - Filter `api.getSubjects(...)` by passing `?exam=${currentExam}&paper=${currentPaper}`.
4. Verify TypeScript compilation with `cd mobile && npx tsc --noEmit`.
```

---

## 🚀 PROMPT 4: Phase 5 — JPSC Syllabus, Subjects & Topics Ingestion (COMPLETED)

```markdown
### Task: JPSC Official Syllabus Ingestion (Phase 5)

Ingest the complete canonical JPSC Prelims Paper 1 & Paper 2 syllabus into the database.

#### Requirements:
1. Create `backend/src/scripts/seedJPSCHierarchy.ts`:
   - Seed Exam: `name: 'JPSC'`, `slug: 'jpsc'`, `icon: 'bank-outline'`.
   - Seed Stage: `name: 'Prelims'`, `slug: 'prelims'`.
   - Seed Paper 1: `name: 'Paper I - General Studies'`, `slug: 'paper-1'`, `100 Qs`, `200 Marks`, `120 Mins`, scoring: `+2 / 0`.
   - Seed Paper 2: `name: 'Paper II - Jharkhand Special'`, `slug: 'paper-2'`, `100 Qs`, `200 Marks`, `120 Mins`, scoring: `+2 / 0`.
2. Seed Paper 1 Subjects & Topics:
   - History of India (Ancient, Medieval, Modern)
   - Geography of India (General, Physical, Economic, Demographic)
   - Indian Polity & Governance (Constitution, Public Admin, Panchayati Raj)
   - Economic & Sustainable Development (Basic Economy, Reforms)
   - Science & Technology (General Science, Agri Tech, ICT)
   - Jharkhand Specific GK (Paper 1 quota)
   - National & International Current Affairs
   - General Miscellaneous
3. Seed Paper 2 Subjects & Topics:
   - Traditional Tribal Governance Systems (Munda, Nagvanshi, Padha, Manjhi, Munda-Manki, Dhoklo Sohor)
   - Jharkhand Movements & Personalities (Birsa Munda, Tilka Manjhi, Sidho-Kanho, Statehood)
   - Land Laws (CNT Act 1908, SPT Act 1949, Other Land Laws)
   - Jharkhand Geography, Relief, Rivers & Minerals
   - Industrial Policies & Major Industries (TISCO, Bokaro, HEC)
   - State Government Welfare Schemes
   - Forest Management, Wildlife Sanctuaries & Environment
4. Ensure all upserts are idempotent.
5. Run script and print full topic count report.
```

---

## 🚀 PROMPT 5: Phase 6 — JPSC High-Yield Seed Question Bank Ingestion (COMPLETED)

```markdown
### Task: JPSC High-Yield Seed Question Bank Ingestion (Phase 6)

Ingest the initial high-yield question bank for JPSC Paper 1 and Paper 2 with detailed step-by-step explanations.

#### Requirements:
1. Create content JSON files in `backend/content/jpsc/`:
   - `paper2_land_laws.json`: 30+ questions covering CNT Act 1908 (Sections, Chapters, Restrictions) and SPT Act 1949.
   - `paper2_governance.json`: 25+ questions on Munda, Nagvanshi, Manjhi Pargana, and Dhoklo Sohor systems.
   - `paper2_geography_minerals.json`: 25+ questions on Jharkhand plateaus, Damodar river, and mineral reserves.
   - `paper1_polity_governance.json`: 25+ questions on Constitution and Public Administration.
2. Ingest questions using the validated content ingestion pipeline:
   - Link each question to `jpsc` examId, `prelims` stageId, and respective `paperId`.
   - Ensure 4 options (A, B, C, D), single valid `correctAnswer`, and detailed `explanation`.
   - Set `difficulty`: Easy, Medium, Hard.
   - Set `questionType`: `'PYQ'` or `'PRACTICE'`.
3. Run ingestion and generate report with `npm run content-report`.
```

---

## 🚀 PROMPT 6: Phase 7 — JPSC Mock Test Engine & Scoring (COMPLETED)

```markdown
### Task: JPSC Mock Test Engine & +2 / 0 Scoring (Phase 7)

Implement the full mock test simulator for JPSC Prelims with official marking rules.

#### Requirements:
1. Update `backend/src/services/mockTestService.ts`:
   - Allow mock generation for `examSlug: 'jpsc'`.
   - Load paper configuration: 100 questions, 120 minutes, single section.
   - Use scoring rules: `correctMarks: 2`, `wrongMarks: 0`, `unansweredMarks: 0`.
   - Sample questions according to JPSC syllabus distribution.
2. Update `mobile/src/screens/MockTestScreen.tsx`:
   - If test is JPSC:
     - Display **🟢 "Notice: No Negative Marking in JPSC Prelims"** banner.
     - Single continuous 120-minute countdown timer.
     - Full 100-question interactive question palette.
3. Update `mobile/src/screens/MockResultScreen.tsx`:
   - Compute final score as `(correctCount * 2) / 200` without penalty deductions.
   - Display topic-wise performance breakdown.
4. Verify by running full mock flow automated test:
   - 36/36 tests passing in `testJPSCMockEngine.ts`.
```

---

## 🚀 PROMPT 6.5: Phase 7.5 — Strict Multi-Exam Separation & User Flow (COMPLETED)

```markdown
### Task: Strict Multi-Exam Data Isolation & Onboarding Flow (Phase 7.5)

Ensure 100% strict data separation between SSC CGL, JPSC, and future competitive exams across both backend and frontend.

#### Requirements:
1. **Startup & Exam Selection Flow**:
   - `mobile/src/screens/SplashScreen.tsx`: Check `AsyncStorage` for `@app_active_exam`. If found, transition directly to `Subjects`. If first launch or not selected, route user to `Onboarding`.
   - `mobile/src/screens/OnboardingScreen.tsx`: Interactive multi-exam selector with dedicated cards for **SSC CGL** and **JPSC**. Persists choice and navigates to exam dashboard.
   - `mobile/src/components/Header.tsx` & `ExamSwitchModal.tsx`: Floating header badge displaying current exam. Tapping triggers switch modal to swap exams at any time with instant UI refresh.

2. **Frontend Universal Exam-Scoping**:
   - `SubjectsScreen.tsx`: Queries `/api/subjects?examSlug=${currentExam}` to fetch only active exam's subjects.
   - `TopicsScreen.tsx`: Loads topics filtered strictly to active exam context.
   - `PerformanceScreen.tsx`: Analytics, subject breakdowns, and accuracy trends filtered by `examSlug`.
   - `RevisionScreen.tsx`: Due revisions, bookmarks, and mistake bank filtered by `examSlug`.
   - `DailyStudyPlanScreen.tsx`: Daily targets, study plan generation, and streak tracking filtered by `examSlug`.
   - `MockInstructionsScreen.tsx`: Defaults to active exam's paper tabs with dynamic scoring rules.

3. **Backend Query Isolation**:
   - `subjectController.ts`: Accepts `examSlug` and `examId`, resolves exam ID, filters with `{ examId: exam._id }`.
   - `topicController.ts`, `performanceController.ts`, `revisionController.ts`, `studyPlanController.ts`: Accept `examSlug` and strictly partition data.
   - All legacy SSC operations maintain full backward compatibility.

4. **Future Exam Readiness**:
   - Adding a new exam (e.g., BPSC, UPSC, JSSC) requires only adding the database record via migration/seed. No code restructuring required.
```

---

## 🚀 PROMPT 7: Phase 8 — End-to-End Testing & Release APK Build

```markdown
### Task: End-to-End Verification, Cross-Exam Isolation & APK Build (Phase 8)

Validate complete isolation between SSC CGL and JPSC, and build the release Android APK.

#### Requirements:
1. Run automated cross-exam tests:
   - Verify 0 SSC questions appear in JPSC practice.
   - Verify 0 JPSC questions appear in SSC practice.
   - Verify SSC negative marking (-0.50) is intact for SSC mocks.
   - Verify JPSC zero negative marking (0) is applied for JPSC mocks.
2. Verify frontend compilation: `cd mobile && npx tsc --noEmit`.
3. Verify backend compilation: `cd backend && npm run build && npm test`.
4. Build updated standalone Android Release APK:
   - `cd mobile/android && ./gradlew assembleRelease`
   - Copy output APK to root directory: `MultiExam-Prep-v1.1.0-Release.apk`.
5. Deliver summary of all functional checks.
```

---

## 🎯 Prompt 7: Strict Performance Pulse, Focus Area & Full Analytics Isolation

### 📌 User Goal
Ensure that the **Performance Pulse**, **Focus Areas (Weak Topics)**, and **Full Analytics (`PerformanceScreen`)** display strictly exam-isolated data:
- When **JPSC** is selected: Only JPSC attempts, JPSC subject stats, JPSC weak topics, and JPSC recommendations (e.g. History of India -> Ancient India) are displayed.
- When **SSC-CGL** is selected: Only SSC CGL attempts, SSC subject stats, SSC weak topics, and SSC recommendations (e.g. Quantitative Aptitude -> Percentage) are displayed.
- Dynamic subject filters and readiness copy on `PerformanceScreen` reflect the active exam (`🏛️ JPSC` vs `🏆 SSC-CGL`).

### 🛠️ Architecture & Changes Implemented
1. **Legacy Attempt Migration (`backfillAttemptExamIds.ts`)**:
   - 143 legacy attempts with unassigned/null `examId` were mapped to their respective exam (`ssc-cgl`).
2. **Backend Controller & Service Isolation**:
   - Updated `performanceController.ts`: accepts `examSlug`, `examId`, and `exam` query parameters.
   - Updated `performanceService.ts` (`getUserPerformance` & `getRecommendedPractice`):
     - Scoped `topicStatsMap` aggregation strictly to active exam topics in `topicMap`.
     - Scoped `detailedAggregates` subject aggregation strictly to active exam subjects.
     - Starter drill recommendations dynamically pick the first active subject/topic of the selected exam (e.g. `History of India -> Ancient India` for JPSC; `Quantitative Aptitude -> Percentage` for SSC-CGL) instead of hardcoded SSC topics.
3. **Mobile Frontend (`PerformanceScreen.tsx` & `SubjectsScreen.tsx`)**:
   - Replaced hardcoded SSC filter pills (`Quant`, `Reasoning`, `English`, `Gen Awareness`) with dynamic pills derived from `data.subjects`.
   - Dynamic header badge showing the active exam badge (`🏛️ JPSC` / `🏆 SSC-CGL`).
   - Dynamic readiness label (`Prelims Exam Ready` for JPSC vs `Tier-1 Exam Ready` for SSC).
   - Scoped starter drill button in `SubjectsScreen.tsx` to active exam subjects.
4. **Verification**:
   - All 9 backend test suites (`npm test`) pass (100% green, 0 failures).
   - Frontend TypeScript builds cleanly (`npx tsc --noEmit` exit code 0).


