# Project Architecture & Developer Guide

Welcome to the Multi-Exam App (formerly SSC-CGL/JPSC APP) developer guide. This document explains the folder structure, technologies used, and provides a quick guide on how to extend the platform for new exams (e.g., UPSC, BPSC).

## 🚀 Tech Stack
- **Frontend (Mobile)**: React Native (Expo), TypeScript, React Navigation
- **Backend**: Node.js, Express, TypeScript, MongoDB (Mongoose)

---

## 📁 1. Frontend Structure (`/mobile`)

The `mobile/src` folder contains all React Native code:

```text
mobile/src/
├── assets/          # Static files (images, icons, fonts)
├── components/      # Reusable UI elements (Buttons, Cards, Header, LanguageToggle)
├── context/         # React Context for global state (ExamContext, LanguageContext, AuthContext)
├── navigation/      # React Navigation setup (Stack, Tab Navigators, route types)
├── screens/         # Full-page screens (SubjectsScreen, MockTestScreen, PerformanceScreen, etc.)
├── services/        # API clients and external service integrations (api.ts, mockTestApi.ts)
├── types/           # TypeScript interfaces and global types (exam.ts, subject.ts, mockTest.ts)
└── utils/           # Helper functions, formatters, and constants
```

### Key Frontend Concepts
- **`types/exam.ts` (Exam Configuration)**: This is the central source of truth for the multi-exam architecture. It contains the `AVAILABLE_EXAMS` array which drives all UI components dynamically (colors, icons, mock test config).
- **`context/ExamContext.tsx`**: Tracks the user's currently selected `activeExam`.
- **Component Reusability**: Screens like `SubjectsScreen.tsx` do NOT use hardcoded checks (`if (exam === 'jpsc')`). Instead, they read config properties from `activeExam`.

---

## 📁 2. Backend Structure (`/backend`)

The `backend/src` folder contains all Node.js/Express code:

```text
backend/src/
├── controllers/     # Express route handlers (processes request, calls services, sends response)
├── models/          # Mongoose database schemas (User, Exam, Subject, Topic, Question, etc.)
├── routes/          # Express route definitions (maps URLs to controllers)
├── scripts/         # Utility scripts (database seeders, data migration scripts)
├── services/        # Core business logic (MockTestService, Database queries)
├── types/           # Backend TypeScript interfaces
└── app.ts / index.ts # Express app setup and server entry point
```

### Key Backend Concepts
- **Data Models**:
  - `Exam`: Top-level (e.g., JPSC, SSC).
  - `SubjectStage` & `SubjectPaper`: Hierarchical groupings (e.g., Prelims -> Paper 1).
  - `Subject`: Individual subjects (e.g., History, Quant).
  - `Topic`: Topics within a subject.
  - `Question`: Actual questions tied to topics.
- **`scripts/`**: The `scripts` folder is highly utilized for importing new questions and seeding exam schemas (e.g., `seedSSCMarks.ts`, `replaceJharkhandQuestions.ts`).

---

## 🛠️ How to Add a New Exam (e.g., UPSC)

Thanks to the reusable architecture, adding a new exam requires **ZERO changes to the UI codebase**. 

Follow these 4 steps:

### Step 1: Add Frontend Config
Open `mobile/src/types/exam.ts` and add a new entry to the `AVAILABLE_EXAMS` array.
```typescript
{
  slug: 'upsc',
  name: 'UPSC Civil Services',
  shortName: 'UPSC',
  icon: '🇮🇳',
  color: '#eab308',
  // ... fill out mock test and stage config fields ...
}
```

### Step 2: Configure Mock Papers
Open `mobile/src/screens/MockInstructionsScreen.tsx` and add the specific mock papers to the `PAPERS` constant:
```typescript
'upsc-gs-1': {
  key: 'upsc-gs-1',
  examSlug: 'upsc',
  paperSlug: 'gs-1',
  title: 'UPSC CSE Prelims — General Studies',
  // ... fill out instructions and marks ...
}
```

### Step 3: Optional UI Overrides
In `mobile/src/screens/SubjectsScreen.tsx`, you can add specific color/icon styling for individual UPSC subjects to the `SUBJECT_METAS` object. If you skip this, the UI gracefully falls back to the exam's primary color.

### Step 4: Seed the Database
Create a new script in `backend/src/scripts/` to seed the UPSC schema:
1. Create `Exam` document.
2. Create `SubjectStage` (Prelims, Mains) & `SubjectPaper`.
3. Create `Subject` and `Topic` documents.
4. Import `Question` data mapped to those topics.

Once the database is populated, the mobile app will immediately display the new exam, its subjects, and mock tests perfectly styled!
