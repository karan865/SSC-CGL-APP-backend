# Multi-Exam Competitive Preparation Platform (SSC CGL & JPSC)

A comprehensive, high-performance examination preparation platform for students preparing for **SSC CGL** (Tier 1 & Tier 2) and **JPSC** (Prelims Paper I & II, Mains Written). Built with modular multi-exam architecture for future expansion to BPSC, UPSC, and JSSC.

## Overview
The application consists of:
- **Mobile Client**: React Native + TypeScript + React Navigation (`/mobile`)
- **Backend API**: Node.js + Express.js + TypeScript + MongoDB Atlas (`/backend`)
- **Supported Exams**:
  - 🏆 **SSC CGL**: Tier 1 (4 subjects, 100 Qs / 60 min, +2 / -0.50 scoring) & Tier 2 (5 subjects)
  - 🏛️ **JPSC**: Prelims Paper I (8 General Studies subjects, 100 Qs / 120 min, +2 / 0 scoring), Paper II (8 Jharkhand Special subjects), and Mains Written (6 papers)

---

## Documentation Hub
- 🏛️ **[JPSC & Multi-Exam Documentation Hub](./JPSC%20Docs/prompt_by_prompt_guide.md)**
  - [Backend Architecture & Data Model](./JPSC%20Docs/backend_architecture.md)
  - [Frontend Architecture & Flow](./JPSC%20Docs/frontend_architecture.md)
  - [Implementation Master Plan & Session Log](./JPSC%20Docs/implementation_plan.md)
  - [Prompt-by-Prompt Development Guide](./JPSC%20Docs/prompt_by_prompt_guide.md)
- 📖 **[SSC CGL Core Documentation](./docs/README.md)**

### 📱 Frontend Documentation (`/docs/frontend`)
- **[Frontend Overview & Quick Start](./docs/frontend/README.md)**
  - [Frontend Master Summary](./docs/frontend/FRONTEND_SUMMARY.md)
  - [Frontend Architecture](./docs/frontend/ARCHITECTURE.md)
  - [Screens & Components Breakdown](./docs/frontend/SCREENS_AND_COMPONENTS.md)
  - [Networking & Services Layer](./docs/frontend/SERVICES_AND_NETWORKING.md)
  - [User Navigation Flow](./docs/frontend/USER_FLOW.md)
  - [Feature List](./docs/frontend/FEATURE_LIST.md)
  - [How to Add New Features Guide](./docs/frontend/ADDING_NEW_FEATURES_GUIDE.md)

### ⚙️ Backend Documentation (`/docs/backend`)
- **[Backend Overview & Quick Start](./docs/backend/README.md)**
  - [Backend Master Summary](./docs/backend/BACKEND_SUMMARY.md)
  - [Backend Architecture](./docs/backend/ARCHITECTURE.md)
  - [REST API Specifications](./docs/backend/API_SPECIFICATION.md)
  - [Database Models & Schemas](./docs/backend/DATABASE_MODELS.md)
  - [Question Bank & Seed Engine](./docs/backend/SEED_AND_QUESTION_BANK.md)
  - [System Architecture & Security](./docs/backend/SYSTEM_ARCHITECTURE.md)
  - [Project Specifications & Business Rules](./docs/backend/PROJECT_SPEC.md)
  - [How to Add Backend Features Guide](./docs/backend/ADDING_NEW_BACKEND_FEATURES_GUIDE.md)

### 🤖 Master ChatGPT Documentation
- [Comprehensive Project & Tech Spec (ChatGPT Ready)](./docs/frontend/APP_COMPREHENSIVE_DOCUMENT.md)


---

## Getting Started

### 1. Running the Backend

1. Navigate to the backend folder:
   ```bash
   cd backend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Ensure `.env` is configured with `PORT` and `MONGODB_URI`:
   ```env
   PORT=5000
   MONGODB_URI=<your_mongodb_connection_string>
   NODE_ENV=development
   ```
4. Seed development data (subjects, topics, and 75 development questions):
   ```bash
   npm run seed
   ```
5. Start the backend development server:
   ```bash
   npm run dev
   ```
   Backend will run at `http://localhost:5000`. Test health at `http://localhost:5000/api/health`.

---

### 2. Running the Mobile Application

1. Navigate to the mobile directory:
   ```bash
   cd mobile
   ```
2. Install dependencies (if not already installed):
   ```bash
   npm install
   ```
3. Configure the API Base URL (see Networking section below) in `mobile/src/constants/config.ts`.
4. Start Metro bundler:
   ```bash
   npm start
   ```
5. Run on your platform of choice:
   - **Android**:
     ```bash
     npm run android
     ```
   - **iOS** (macOS only):
     ```bash
     npm run ios
     ```
6. Run tests:
   ```bash
   npm test
   ```

---

## Mobile Networking & `API_BASE_URL` Configuration

Mobile apps cannot always connect to `http://localhost:5000` because "localhost" on a mobile device or emulator refers to the device itself.

Centralized configuration is defined in [`mobile/src/constants/config.ts`](./mobile/src/constants/config.ts):

### 1. Android Emulator
- **URL**: `http://10.0.2.2:5000/api`
- **Why**: The standard Android emulator runs in an internal virtual network where `10.0.2.2` bridges directly to the host machine's `127.0.0.1`.
- This is the automatic default for Android in `config.ts`.

### 2. iOS Simulator (macOS only)
- **URL**: `http://localhost:5000/api`
- **Why**: The iOS simulator shares the network interface with macOS, so `localhost` resolves directly to your development machine.

### 3. Physical Device (Android / iOS)
- **URL**: `http://<YOUR_COMPUTER_LOCAL_IP>:5000/api` (e.g. `http://192.168.1.100:5000/api`)
- **Setup**:
  1. Ensure both your computer and mobile phone are connected to the same Wi-Fi network.
  2. Find your computer's local IP address:
     - Windows: Run `ipconfig` (look for IPv4 address under Wi-Fi adapter).
     - Mac/Linux: Run `ifconfig` or `ip a`.
  3. In `mobile/src/constants/config.ts`:
     - Set `PHYSICAL_DEVICE_IP` to `http://<YOUR_IP>:5000/api`.
     - Set `USE_PHYSICAL_DEVICE = true`.
  4. Ensure Windows Firewall permits incoming connections on port 5000.
