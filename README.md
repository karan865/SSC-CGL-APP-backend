# SSC CGL Exam Preparation API

A robust, modular Node.js & TypeScript RESTful API designed to power the SSC CGL Question Practice & Exam Preparation platform.

---

## Features

- **Subject & Topic Catalog**: Hierarchical management of subjects and sub-topics with difficulty categorization.
- **Smart Practice Sessions**: Adaptive question selection engine tailored to student performance history.
- **Full Tier-1 & Tier-2 Mock Tests**: Timed sectional tests, question marking, auto-submission, and post-test analytics.
- **Spaced Repetition & Revision**: Automatically schedules review of incorrectly answered or flagged questions.
- **Daily Study Plans & Streaks**: Personalized daily targets, streak tracking, and milestone rewards.
- **Performance Analytics**: Accuracy tracking, speed metrics, weak topic identification, and actionable recommendations.
- **Content Pipeline**: Built-in CLI validation, report generation, and automated bulk import tools.
- **Production Security**: Hardened with Helmet, rate limiting, and CORS configuration.

---

## Tech Stack

- **Runtime**: [Node.js](https://nodejs.org/) (v18+)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Framework**: [Express 5](https://expressjs.com/)
- **Database & ODM**: [MongoDB](https://www.mongodb.com/) with [Mongoose](https://mongoosejs.com/)
- **Dev Runner**: [tsx](https://github.com/privatenumber/tsx) for zero-config live reloading
- **Security**: [Helmet](https://helmetjs.github.io/), [express-rate-limit](https://github.com/express-rate-limit/express-rate-limit)

---

## Getting Started

### Prerequisites

- Node.js (v18 or higher recommended)
- MongoDB instance (local or MongoDB Atlas connection string)
- npm or yarn

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/<your-username>/<your-repo-name>.git
   cd backend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment Variables:**
   Copy `.env.example` to create `.env`:
   ```bash
   cp .env.example .env
   ```
   Edit `.env` with your actual MongoDB connection string and preferred port:
   ```env
   PORT=5000
   MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.example.mongodb.net/ssc_cgl_practice?retryWrites=true&w=majority
   NODE_ENV=development
   ```

4. **Seed Database / Import Content:**
   ```bash
   # Seed default subjects and topics
   npm run seed

   # Or import full question bank from content directory
   npm run import
   ```

5. **Start Development Server:**
   ```bash
   npm run dev
   ```
   The API will start at `http://localhost:5000`.

---

## Available Scripts

| Command | Description |
| :--- | :--- |
| `npm run dev` | Starts server in watch mode using `tsx` |
| `npm run build` | Compiles TypeScript into JavaScript (`dist/`) |
| `npm start` | Runs the compiled production build from `dist/` |
| `npm run seed` | Populates initial subjects and topics in MongoDB |
| `npm run import` | Imports all question files from `/content` |
| `npm run import:file` | Imports a specific question file (`--file <path>`) |
| `npm run validate-content`| Validates JSON schemas and integrity of content files |
| `npm run content-report` | Generates a breakdown report of current content assets |
| `npm test` | Runs end-to-end flow test suites (practice, mock, revision, etc.) |

---

## API Endpoints Overview

All endpoints are prefixed with `/api`.

### Health Check
- `GET /api/health` - Check API and MongoDB connection status.

### Subjects & Topics
- `GET /api/subjects` - List all active subjects.
- `GET /api/subjects/:subjectId/topics` - Get all topics under a specific subject.

### Practice Module
- `POST /api/practice/start` - Initiate practice session with smart question selection.
- `POST /api/practice/answer` - Submit an answer, receive instant feedback and explanation.
- `POST /api/practice/mark` - Mark / bookmark a question for future review.

### Mock Tests
- `POST /api/mock-tests/start` - Create and launch a full timed mock test session.
- `POST /api/mock-tests/:sessionId/answer` - Record or update a student's answer.
- `POST /api/mock-tests/:sessionId/section-lock` - Lock section and proceed to next.
- `POST /api/mock-tests/:sessionId/submit` - Finalize test and compute full score breakdown.
- `GET /api/mock-tests/:sessionId/review` - Review full test session with detailed solutions.
- `GET /api/mock-tests/marked-questions` - Fetch all flagged questions.

### Performance & Analytics
- `GET /api/performance` - Retrieve aggregated accuracy, speed, and subject-wise metrics.
- `GET /api/performance/recommendations` - Get AI/heuristic practice recommendations.
- `GET /api/performance/topics/:topicId` - Topic-level mastery and history.

### Spaced Repetition & Revision
- `GET /api/revision` - Revision summary and upcoming review counts.
- `GET /api/revision/due` - Fetch questions currently due for review.
- `POST /api/revision/start` - Start an active spaced repetition session.
- `POST /api/revision/answer` - Submit answer and recalculate next review interval.
- `GET /api/revision/stats` - Overall revision retention metrics.

### Study Streaks & Goals
- `GET /api/streak` - Get current and longest user study streaks.
- `POST /api/streak/complete` - Log daily completion to advance streak.

### Daily Study Plan
- `GET /api/study-plan/today` - Fetch today's personalized study plan.
- `POST /api/study-plan/generate` - Generate study plan for specific goals.
- `POST /api/study-plan/start` - Begin today's plan.
- `POST /api/study-plan/item/:itemId/complete` - Mark study task as finished.
- `GET /api/study-plan/progress` - Check overall goal completion progress.
- `PATCH /api/study-plan/goal` - Update target exam date or daily question targets.

---

## License

ISC
