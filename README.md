# 🎁 Amigo Secreto 2025

A modern, serverless Secret Santa (Amigo Secreto) web application built with React and Firebase. Create events, invite participants via QR code, register gift suggestions, and perform secure draws — all from your browser.

![React](https://img.shields.io/badge/React-19.2-61DAFB?logo=react&logoColor=white)
![Firebase](https://img.shields.io/badge/Firebase-12.6-FFCA28?logo=firebase&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-7.2-646CFF?logo=vite&logoColor=white)
![TailwindCSS](https://img.shields.io/badge/Tailwind-3.4-06B6D4?logo=tailwindcss&logoColor=white)

## ✨ Features

- **Create Events** — Set up a Secret Santa event with a name, optional suggested gift value, and configurable children inclusion
- **Easy Access** — Event codes always start with a letter; phone numbers are auto-formatted for seamless input
- **Participant Registration** — Participants join using the event code or their phone number and can add:
  - Their name and mobile number (Brazilian format with auto-formatting)
  - Children (dependents without their own phone)
  - Gift suggestions for themselves and their children
- **Smart Draw Algorithm** — Randomized assignment that:
  - Prevents self-assignment
  - Minimizes same-family pairings (when possible)
  - Supports optional inclusion/exclusion of children
  - Prompts for confirmation when perfect pairing isn't possible
- **Phone-Based Access** — Participants access their results using their registered phone number (no separate access codes needed)
- **SMS Verification** — Phone authentication via Firebase for secure identity verification
- **QR Code Sharing** — Generate and download QR codes to easily share event invitation links
- **Admin Panel** — Event creators can:
  - Edit event details (name, suggested value)
  - View all participants and their draw results
  - Perform, redo, or delete draws
  - Remove participants (except the admin)
  - Delete the entire event
- **Privacy-First Design** — Phone numbers are obfuscated for storage and hashed for lookups
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
| Auth       | Firebase Phone Auth (SMS)  |
| Hosting    | Firebase Hosting           |
| Notifications | Sonner                  |

## 📁 Project Structure

```
src/
├── App.css
├── App.jsx
├── main.jsx
├── version.json                    # App version tracking
├── firebase.js                     # Firebase initialization
├── components/
│   ├── AppRouter.jsx               # Main routing configuration
│   ├── common/
│   │   ├── CopyButton.jsx          # Copy-to-clipboard button
│   │   ├── ErrorScreen.jsx         # Database/init error display
│   │   └── Spinner.jsx             # Loading indicator
│   ├── event/
│   │   ├── admin/
│   │   │   ├── EventAdmin.jsx          # Main admin container
│   │   │   ├── EventDetailsAdmin.jsx   # Admin: Edit event details
│   │   │   └── ParticipantListAdmin.jsx # Admin: Manage participants
│   │   ├── participant/
│   │   │   └── ChildrenForm.jsx        # Child registration form
│   │   ├── EventAccessCode.jsx     # SMS verification flow
│   │   ├── EventCreate.jsx         # Create new event form
│   │   ├── EventHome.jsx           # Landing page
│   │   ├── EventParticipant.jsx    # Participant registration
│   │   ├── EventResults.jsx        # Draw results display
│   │   └── eventQRCode.jsx         # QR code generation
│   ├── layout/
│   │   ├── Footer.jsx
│   │   └── Header.jsx
│   └── message/
│       ├── ConfirmModal.jsx        # Confirmation dialog
│       ├── MessageContext.js       # Message context definition
│       └── MessageProvider.jsx     # Notification system provider (Sonner)
├── context/
│   ├── EventContext.jsx            # Global event state management
│   └── FirebaseContext.jsx         # Firebase auth context
├── services/
│   └── eventService.js             # Event data operations
└── utils/
    ├── crypto.js                   # Phone obfuscation/hashing utilities
    ├── drawEvent.js                # Secret Santa draw algorithm
    └── helpers.js                  # Utility functions
```

## 🛠️ Getting Started

### Prerequisites

- Node.js 18+ and npm
- A Firebase project with Realtime Database and Phone Authentication enabled

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
   VITE_FIREBASE_DATABASE_URL=https://your_project.firebaseio.com
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

**Live URL**: https://amigo-secreto-app-bc39d.web.app

## 🔒 Security & Privacy

- **Phone Number Privacy** — Phone numbers are obfuscated using a reversible encoding (for display to admin) and hashed using SHA-256 for secure lookups
- **Admin Authorization** — Admin access is verified via:
  - `currentParticipant.isAdmin` flag (when accessed via verified phone)
  - `createdByUid` matching the authenticated Firebase user
  - `adminParticipantId` ownership check
- **Transient State** — UI-only fields like `currentParticipant` are never persisted to the database
- **Database Rules** — Configure `database.rules.json` to restrict access appropriately for production
- Never commit `.env.local` or service account keys to version control

## 📱 Phone Auth (SMS) Setup

This project uses Firebase Phone Authentication (SMS) to verify users' phone numbers.

### Configuration Steps:

1. **Enable Phone provider**: In Firebase Console → Authentication → Sign-in method → enable **Phone**
2. **Authorized domains**: Add your domains (e.g., `localhost`, `your-app.web.app`) to the Authorized domains list
3. **reCAPTCHA**: The app uses invisible reCAPTCHA automatically for web verification
4. **Test numbers**: For development, add test phone numbers in Auth → Sign-in method → Phone → Phone numbers for testing

### How Phone Auth Works:

1. User enters their phone number on the home screen
2. If the phone is registered in an event, SMS verification is triggered
3. After entering the 6-digit code, the user is authenticated
4. The session persists, allowing access to results and admin functions
5. Admin actions validate the authenticated UID against the event's creator

## 🔄 User Flows

### Creating an Event
1. Click "Criar Novo Evento"
2. Enter event name and optional suggested value
3. Configure whether to include children in the draw
4. Click "Criar Evento" → receive event code
5. Register yourself as the first participant (you become the admin)

### Joining an Event
1. Enter the event code OR your phone number
2. For phone input, numbers are auto-formatted as (XX) XXXXX-XXXX
3. Complete SMS verification if required
4. Fill in your details and gift suggestions
5. Wait for the admin to perform the draw

### Viewing Results
1. Enter your phone number after the draw is complete
2. Verify via SMS
3. See who you drew and their gift suggestions
4. Admins can access the admin panel from the results screen

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
