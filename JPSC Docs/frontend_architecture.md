# JPSC & Multi-Exam Frontend Architecture Guide

**Platform:** React Native (Android & iOS) + TypeScript  
**Core Principles:** Zero-Friction Exam Switching, Complete Data Isolation, Premium UI/UX  

---

## 1. Frontend Architectural Overview

The frontend application uses a **Single App, Multi-Exam Viewport** model. Users download one single `.apk`, and through a unified Header Switcher or onboarding selector, seamlessly switch between **SSC CGL** and **JPSC** (with zero code changes needed when adding future exams like BPSC, UPSC, or JSSC):

```text
                     APP LAUNCH / SPLASH
                               │
               Has Selected Exam in Storage?
                     ├── Yes ──► Direct to Subjects Dashboard
                     └── No  ──► Open Exam Onboarding Selector
                               │
                     MAIN NAVIGATION ROOT
                               │
        ┌─────────────────────┴─────────────────────┐
        │                                           │
  [🏆 SSC CGL VIEWPORT]                       [🏛️ JPSC VIEWPORT]
  ├── Tier 1 Preparation                      ├── Prelims Preparation
  ├── 4 Fixed Sections (Quant, Eng, etc.)    ├── Paper I (GS-I) & Paper II (Jharkhand)
  ├── 60-min Sectional Mocks                  ├── 120-min Single-Paper Mocks
  ├── -0.50 Negative Marking                  └── 0 Negative Marking
  └── Isolated Analytics/Revision/Study Plan └── Isolated Analytics/Revision/Study Plan
```

---

## 2. State Management & Persistence (`ExamContext`)

A top-level React Context (`ExamContext`) maintains the active examination state across the entire component tree.

### 2.1 State Structure
```typescript
export interface ActiveExamState {
  examSlug: 'ssc-cgl' | 'jpsc';
  examName: string;
  stageSlug: 'tier-1' | 'prelims';
  paperSlug: 'tier-1' | 'paper-1' | 'paper-2';
}

export interface ExamContextType {
  activeExam: ActiveExamState;
  switchExam: (examSlug: 'ssc-cgl' | 'jpsc', paperSlug?: string) => Promise<void>;
  switchPaper: (paperSlug: 'tier-1' | 'paper-1' | 'paper-2') => void;
  isLoadingExam: boolean;
}
```

### 2.2 Storage Keys & Lifecycle
- `AsyncStorage.getItem('@app_active_exam')` -> Restored during app startup.
- `AsyncStorage.getItem('@app_active_paper')` -> Restored during app startup.
- If no active exam is found in storage, `SplashScreen` gracefully routes the user to `OnboardingScreen` so they can explicitly choose their preparation goal.
- When user switches exam:
  1. Persists new slug in `AsyncStorage`.
  2. Updates `activeExam` state in React context.
  3. Every active screen (`SubjectsScreen`, `TopicsScreen`, `PerformanceScreen`, `RevisionScreen`, `DailyStudyPlanScreen`, `MockInstructionsScreen`) immediately detects the change and fetches data scoped to `?examSlug=${activeExam.examSlug}`.
  4. Guarantees 100% data separation with zero memory or UI cross-contamination.

---

## 3. Screen Breakdown & UI Changes

### 3.1 Header Exam Switcher & Navigation
The top navigation bar of `HomeScreen` features an interactive Exam Switcher Pill:

```text
┌────────────────────────────────────────────────────────┐
│  SSC CGL & JPSC Prep                       🔔   🔥 5   │
│  ┌─────────────────────────┐                           │
│  │ 🏛️ JPSC Prelims ▾       │                           │
│  └─────────────────────────┘                           │
└────────────────────────────────────────────────────────┘
```

Tapping the pill presents the **`ExamSwitchModal`**:
- 🏆 **SSC CGL**: "Tier 1 & Tier 2 Preparation (Quant, Reasoning, English, GA)"
- 🏛️ **JPSC**: "Combined Civil Services Prelims (General Studies I & Jharkhand Special)"

---

### 3.2 JPSC Home Screen & Paper Selector Bar
When JPSC is active, the home screen renders a modern tab selector to switch between Paper 1 and Paper 2:

```text
┌────────────────────────────────────────────────────────┐
│  ┌───────────────────────┐  ┌───────────────────────┐  │
│  │  Paper I: General GS  │  │  Paper II: Jharkhand  │  │
│  └───────────────────────┘  └───────────────────────┘  │
└────────────────────────────────────────────────────────┘
```
- **Paper I Active**: Renders History of India, Geography, Indian Polity, Economy, Science & Tech, Current Affairs.
- **Paper II Active**: Renders Tribal Governance, Jharkhand Movements, CNT & SPT Acts, State Geography, Mines, Schemes, Forest & Wildlife.

---

### 3.3 Practice Screen (`mobile/src/screens/PracticeScreen.tsx`)
- **Adaptive Question Count**: Adapts smoothly to available topic questions (whether 10, 25, or 50) without errors.
- **Difficulty Badges**: Easy (Green `#10b981`), Medium (Amber `#f59e0b`), Hard (Rose `#f43f5e`).
- **Interactive Feedback**:
  - Green border and checkmark on correct answer.
  - Rose border and shake animation on incorrect answer.
  - Step-by-step solution card with Markdown/Math formatting.
- **Question Bookmarking**: Tap the ribbon icon to save directly to the JPSC Marked Notebook.

---

### 3.4 Mock Test Simulator (`mobile/src/screens/MockTestScreen.tsx`)
The simulator automatically adjusts according to the active exam:

| Feature | SSC CGL Tier 1 Mock | JPSC Prelims Mock |
| :--- | :--- | :--- |
| **Pre-Test Paper Selection** | Single Tier-1 Paper | Tab switcher: **Paper I (GS-I)** vs **Paper II (Jharkhand Special)** |
| **Duration & Timing** | 60 Minutes (4 sequential 15-min sectional timers) | 120 Minutes (Continuous single timer, `02:00:00` → `00:00:00`) |
| **Timer Reliability** | Timestamp-based (`serverExpiresAt`), immune to re-renders | Timestamp-based (`serverExpiresAt`), immune to re-renders |
| **Question Count** | 100 Questions (4 sections of 25) | 100 Questions (Quota-sampled per syllabus) |
| **Scoring Formula** | `Correct: +2`, `Wrong: -0.50`, `Unanswered: 0` | `Correct: +2`, `Wrong: 0`, `Unanswered: 0` |
| **Banner Notice** | Standard SSC negative marking notice | **🟢 Notice: No Negative Marking in JPSC Prelims (+2 / 0)** |
| **Navigation Mode** | Forward-only section locking | Open 100-question navigation across all subjects |
| **Palette Grid** | Section-scoped 25-question grid | Full 100-question interactive numbered palette |
| **Auto-Submission** | Triggers automatically on final section expiry | Triggers automatically upon 120-minute countdown reaching zero |

#### Palette State Distinctions:
1. **Unanswered**: Neutral border (`#475569`), clear background.
2. **Answered**: Vibrant solid fill (`#10b981` Emerald).
3. **Marked for Review**: Solid amber fill (`#f59e0b`).
4. **Answered + Marked**: Rich purple badge (`#8b5cf6`).
5. **Current**: Accent highlighted border (`#6366f1` Indigo).

---

### 3.5 Scorecard & Post-Exam Review
- **Result Screen (`mobile/src/screens/MockResultScreen.tsx`)**:
  - **Paper-Aware Identity**: Explicit title (e.g. `JPSC Prelims — Paper I` or `JPSC Prelims — Paper II`).
  - **Score Display**:
    - SSC CGL: `Score / 200` (incorporates penalties).
    - JPSC Prelims: `Score / 200` (pure `Correct * 2`, zero penalty applied).
  - **Accuracy & Time**: Percentage accuracy and formatted duration used (`HH:MM:SS`).
  - **Subject / Section Breakdown**: Lists correct, wrong, and accuracy across all syllabus domains.
- **Review Screen (`mobile/src/screens/MockReviewScreen.tsx`)**:
  - **Dynamic Section Tabs**: Seamless navigation between syllabus subjects.
  - **Full Question Review**: Displays user's selected choice vs. verified `correctAnswer`.
  - **Explanations & Marks**: In-depth official explanations and dynamic marks awarded (`+2` for correct, `0` for wrong in JPSC).

### 3.6 Universal Screen Scoping & Complete Isolation
Every main screen in the mobile app subscribes to `useExam()` and passes `examSlug` to backend APIs, ensuring zero cross-contamination:

| Screen | Hook / State Dependency | API Endpoint Called | Data Scope Enforced |
| :--- | :--- | :--- | :--- |
| **`SubjectsScreen`** | `useExam() -> activeExam.examSlug` | `/api/subjects?examSlug=...` | Only subjects belonging to selected exam |
| **`TopicsScreen`** | `useExam() -> activeExam.examSlug` | `/api/topics?examSlug=...` | Only topics under selected exam |
| **`PerformanceScreen`** | `useExam() -> activeExam.examSlug` | `/api/performance?examId=...` | Analytics, accuracy, difficulty, weak topics, and subject breakdown scoped strictly to active exam |
| **`RevisionScreen`** | `useExam() -> activeExam.examSlug` | `/api/revision/due?examSlug=...` | Mistake notebook and bookmarks for active exam only |
| **`DailyStudyPlanScreen`** | `useExam() -> activeExam.examSlug` | `/api/study-plan/daily?examSlug=...` | Streaks, daily quotas, and targets for active exam only |
| **`MockInstructionsScreen`** | `useExam() -> activeExam.examSlug` | `/api/mock/instructions` | Dynamic default paper tab and time limit for active exam |

#### Transition State Flushing:
To prevent previous exam data from momentarily flashing when switching exams, all analytics and content screens implement a reactive state reset effect:
```typescript
useEffect(() => {
  setData(null);
  setRevisionStats(null);
  setStudyPlan(null);
  setLoading(true);
  setError(null);
}, [examSlug]);
```

---

## 4. Visual Themes & Design Tokens

To give each exam an unmistakable visual identity while maintaining brand unity:

```text
               SSC CGL THEME                      JPSC THEME
Primary:       #4f46e5 (Electric Indigo)          #059669 (Emerald Forest)
Secondary:     #06b6d4 (Cyan)                     #d97706 (Jharkhand Gold)
Background:    #0b0f19 (Dark Navy)                #061a14 (Deep Forest Dark)
Surface:       #1e293b (Slate Card)               #11261f (Jungle Slate Card)
Accent:        #38bdf8 (Sky Blue)                 #34d399 (Mint Green)
```

---

## 5. Offline, Bundling & Network Resilience
1. **Network Auto-Discovery (`config.ts`)**:
   - In `__DEV__` mode, candidate URLs prioritize local development endpoints over the live cloud fallback:
     1. `http://127.0.0.1:5000/api` (Physical device via USB `adb reverse tcp:5000 tcp:5000`)
     2. `http://${DEV_MACHINE_WIFI_IP}:5000/api` (Physical device via Wi-Fi network `192.168.0.105:5000`)
     3. `http://localhost:5000/api` (iOS Simulator / Desktop)
     4. `http://10.0.2.2:5000/api` (Android Emulator)
     5. `LIVE_BACKEND_URL` (Production cloud Render fallback)
2. **Offline Pre-bundled Asset Pipeline**:
   - `mobile/android/app/src/main/assets/index.android.bundle` is compiled with full offline support, complete stage badging, and exam-scoped API calls.
3. **Instant Offline Cache**: Subjects and topics cached in `AsyncStorage` load immediately upon app open with zero spinner.
4. **Cold-Start Wakeup**: Silent ping to `/api/health` keeps the backend alive during intro or home viewing.
5. **Graceful Fallbacks**: If network drops during practice, attempts are queued locally and synchronized upon reconnection.

---

## 6. Architecture Scalability for Future Exams (BPSC, UPSC, JSSC)
The multi-exam architecture was designed from ground up so new exams can be added with **zero frontend refactoring**:
1. Add the new exam slug in `backend` database (`bpsc`, `upsc`, `jssc`).
2. Add the exam item in `ExamSwitchModal.tsx` and `OnboardingScreen.tsx`.
3. The existing `ExamContext`, `Header`, and screen-level scoping automatically handle all routing, API filtering, and state switching for the new exam.

---

## 7. Bilingual UI Engine (English & Hindi)

### 7.1 State Management (`LanguageContext.tsx`)
- **Persistent Storage**: Saved in `AsyncStorage` under `@preferred_language` (`'en'` | `'hi'`).
- **Context Hook (`useLanguage`)**:
  - `language`: Current language code (`'en'` | `'hi'`).
  - `isHindi`: Boolean shortcut (`language === 'hi'`).
  - `setLanguage(lang)`: Updates state and persists to storage.
  - `toggleLanguage()`: Flips between English and Hindi in 1 tap without page reload or resetting timers.

### 7.2 UI Toggle Component (`LanguageToggle.tsx`)
- **Pill Switcher**: Compact `[ EN | हिन्दी ]` pill with smooth active indicator styling.
- **Styling Variants**:
  - `variant="light"`: Optimized for white cards and modals (e.g. Practice top meta, Mock question bar, Review header, Marked questions modal).
  - `variant="dark"`: Optimized for dark headers (e.g. Subjects screen exam header, Mock Test top cockpit).
  - `size="small"` | `size="medium"`: Adaptable to compact header rows.

### 7.3 Instant Graceful Fallback
Any question, option, or explanation without a Hindi translation immediately renders the baseline English text seamlessly, ensuring 0 missing labels or broken layouts:
```tsx
const displayText = isHindi && item.text_hi ? item.text_hi : item.text;
```


