# Vas-y Padel Academy - Academy Management System

A comprehensive management system for Padel Academies, featuring player management, session scheduling, automated reminders, and attendance tracking.

## Features

- **Player Management**: Track athlete profiles, levels, groups, and packages.
- **Dynamic Scheduling**: Weekly and monthly views for session coordination.
- **Automated Reminders**: System-generated email notifications sent 24h before sessions.
- **Attendance Tracking**: Record attendance with bulk update capabilities.
- **Security**: Hardened Firestore rules for data integrity and identity verification.

## Tech Stack

- **Frontend**: React (Vite, TypeScript, Tailwind CSS 4)
- **Backend**: Node.js (Express, TypeScript)
- **Database**: Firebase (Firestore)
- **Auth**: Firebase Authentication (Google Login)
- **Automation**: Node-cron for scheduled tasks.

## Getting Started

### Prerequisites

- Node.js 22 or higher
- A Firebase project
- A Gmail account with an App Password (for automated emails)

### Installation

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd react-example
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Environment Setup**:
   Create a `.env` file in the root directory and populate it based on `.env.example`:
   ```env
   # GMAIL CONFIG
   GMAIL_USER="your-email@gmail.com"
   GMAIL_APP_PASSWORD="your-app-password"

   # FIREBASE FRONTEND CONFIG
   VITE_FIREBASE_API_KEY="..."
   VITE_FIREBASE_PROJECT_ID="..."
   # ... add other VITE_FIREBASE_* vars from your Firebase console
   ```

4. **Service Account Setup** (for backend):
   - Download a Service Account JSON from the Firebase Console (Project Settings > Service accounts).
   - Save it as `service-account.json` in the project root.

5. **Run the application**:
   ```bash
   npm run dev
   ```

## Local Development

- The server runs on `http://localhost:3000`.
- Vite handles the frontend and proxies API requests.

## Deployment

Deploy using standard Node.js deployment workflows (Google Cloud Run, Heroku, etc.). Ensure all environment variables are correctly set in your deployment environment.
