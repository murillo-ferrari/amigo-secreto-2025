# 🎁 Amigo Secreto 2025

A modern, serverless Secret Santa (Amigo Secreto) web application built with React and Firebase. Create events, invite participants, register gift suggestions, and perform secure draws — all from your browser.

![React](https://img.shields.io/badge/React-19.2-61DAFB?logo=react&logoColor=white)
![Firebase](https://img.shields.io/badge/Firebase-12.6-FFCA28?logo=firebase&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-7.2-646CFF?logo=vite&logoColor=white)
![TailwindCSS](https://img.shields.io/badge/Tailwind-3.4-06B6D4?logo=tailwindcss&logoColor=white)

## ✨ Features

- **Create Events** — Set up a Secret Santa event with a name and optional suggested gift value
- **Unique Access Codes** — Each event generates a participant code and a separate admin code
- **Participant Registration** — Participants join using the event code and can add:
  - Their name and mobile number (Brazilian format)
  - Children (dependents without their own phone)
  - Gift suggestions for themselves and their children
- **Smart Draw Algorithm** — Randomized assignment that:
  - Prevents self-assignment
  - Minimizes same-family pairings (when possible)
  - Supports optional inclusion/exclusion of children
- **Secure Admin Access** — Admin codes are hashed (SHA-256) before storage; plain codes are never persisted
- **QR Code Sharing** — Generate and download QR codes to easily share event links
- **Results View** — After the draw, participants see who they drew along with gift suggestions
- **Responsive UI** — Mobile-first design with Tailwind CSS
- **Offline-Resilient** — Graceful error handling when Firebase is unreachable

## 🚀 Tech Stack

| Layer      | Technology                 |
|------------|----------------------------|
| Framework  | React 19                   |
| Build Tool | Vite 7                     |
| Styling    | Tailwind CSS 3             |
| Icons      | Lucide React               |
| Database   | Firebase Realtime Database |
| Hosting    | Firebase Hosting           |

## 📁 Project Structure

```
src/
├── App.jsx                         # Main app component & navigation logic
├── firebase.js                     # Firebase initialization & storage adapter
├── components/
│   ├── common/                     # Reusable UI components
│   │   ├── CopyButton.jsx          # Copy-to-clipboard button
│   │   ├── ErrorScreen.jsx         # Database/init error display
│   │   └── Spinner.jsx             # Loading indicator
│   ├── event/                      # Event-specific views
│   │   ├── EventAdmin.jsx          # Admin panel (manage participants, run draw)
│   │   ├── EventCreate.jsx         # Create new event form
│   │   ├── EventHome.jsx           # Landing page (create/join event)
│   │   ├── EventParticipant.jsx    # Participant registration form
│   │   ├── EventRecoverCode.jsx    # Code recovery helper
│   │   ├── EventResults.jsx        # Draw results display
│   │   └── QRCode.jsx              # QR code generation & download
│   └── layout/                     # Layout components (Header, Footer)
└── utils/
    ├── drawEvent.js                # Secret Santa draw algorithm
    └── helpers.js                  # Utility functions (codes, validation, hashing)
```

## 🛠️ Getting Started

### Prerequisites

- Node.js 18+ and npm
- A Firebase project with Realtime Database enabled

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/murillo-ferrari/amigo-secreto-2025.git
   cd amigo-secreto-2025
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure Firebase**

   Create a `.env.local` file in the project root with your Firebase config:
   ```env
   VITE_FIREBASE_API_KEY=your_api_key
   VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
   VITE_FIREBASE_DATABASE_URL=https://your_project.firebasedatabase.app
   VITE_FIREBASE_PROJECT_ID=your_project_id
   VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
   VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
   VITE_FIREBASE_APP_ID=your_app_id
   ```

4. **Run locally**
   ```bash
   npm run dev
   ```
   Open [http://localhost:5173](http://localhost:5173) in your browser.

### Build for Production

```bash
npm run build
```

Output is written to the `dist/` folder, ready for deployment.

## 🚢 Deployment

This project is configured for Firebase Hosting:

```bash
# Login to Firebase (first time only)
firebase login

# Deploy hosting and database rules
firebase deploy
```

The `firebase.json` configuration serves the SPA from `dist/` with client-side routing enabled.

## 🔒 Security Notes

- **Admin codes are hashed** using SHA-256 before being stored in the database. The plain admin code is only shown once at event creation and kept in-memory for the current session.
- **Admin ownership** — The first participant created in an event is designated as the event admin and stored as `adminParticipantId` on the event. There is no separate admin code.
- **Database rules** (`database.rules.json`) are currently open for development. For production, restrict access appropriately; for example you can require authenticated writes or limit which fields can be changed by clients. Example (development-friendly) rules:
  ```json
  {
    "rules": {
      "evento:$eventId": {
        ".read": true,
        ".write": "auth != null"
      }
    }
  }
  ```
- Never commit `.env.local` or service account keys to version control.

## 📱 Phone Auth (SMS) Setup

This project supports Firebase Phone Authentication (SMS) to verify users' phone numbers during recovery and admin-sensitive actions.

- **Enable Phone provider**: In Firebase Console → Authentication → Sign-in method → enable **Phone**.
- **reCAPTCHA**: For web apps Firebase requires reCAPTCHA. Add your development domains (e.g. `localhost`) and production domain to the Authorized domains list in the Firebase Console. The app uses invisible reCAPTCHA by default.
- **Test numbers**: For local development add test phone numbers in the Auth → Sign-in method → Phone → Phone numbers for testing. This avoids sending real SMS.
- **Local dev note**: When using real phone numbers, Firebase may enforce quotas and reCAPTCHA flows. Prefer test numbers while developing.

How the app uses Phone Auth:
- The home/recovery UI will send an SMS verification code to the provided number and prompt the user to enter it.
- After successful verification the browser session will be signed in with Firebase Auth and the UID will be used to authorize admin actions.
- The app still keeps admin ownership tied to the participant (via `createdByUid` and `adminParticipantId`) so only the verified creator can perform admin writes.

## 📜 Available Scripts

| Command           | Description                            |
|-------------------|----------------------------------------|
| `npm run dev`     | Start local dev server with hot reload |
| `npm run build`   | Build optimized production bundle      |
| `npm run preview` | Preview production build locally       |
| `npm run lint`    | Run ESLint checks                      |

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is private. All rights reserved.

---

Made with ❤️ and AI for family & friends Secret Santa events.
