# ChatAppey 💬

<p align="center">
  <img src="https://img.shields.io/badge/React-19.0.0-61DAFB?style=for-the-badge&logo=react&logoColor=white" alt="React">
  <img src="https://img.shields.io/badge/Node.js-Express-339933?style=for-the-badge&logo=node.js&logoColor=white" alt="Node.js">
  <img src="https://img.shields.io/badge/MongoDB-Database-47A248?style=for-the-badge&logo=mongodb&logoColor=white" alt="MongoDB">
  <img src="https://img.shields.io/badge/Socket.io-Real--time-010101?style=for-the-badge&logo=socket.io&logoColor=white" alt="Socket.io">
  <img src="https://img.shields.io/badge/License-Proprietary-red?style=for-the-badge" alt="License">
</p>

<p align="center">
  A modern, feature-rich real-time chat application built with the MERN stack, featuring WhatsApp-style UI, group chats, voice/video calls, and much more!
</p>

---

## 📖 About The Project

**ChatAppey** is a full-stack real-time messaging application that provides a seamless communication experience similar to WhatsApp. Built with modern web technologies, it offers instant messaging, group conversations, voice/video calling capabilities, and a beautiful dark-themed user interface.

### ✨ Key Features

| Feature | Description |
|---------|-------------|
| 💬 **Real-time Messaging** | Instant message delivery with Socket.io |
| 👥 **Group Chats** | Create, manage, and participate in group conversations with roles |
| 📞 **Voice & Video Calls** | Integrated high-quality calling with ZEGOCLOUD SDK |
| 🕒 **Scheduled Messages** | Plan your messages to be sent at a specific future time |
| 🎭 **Message Reactions** | Express yourself with emoji reactions on any message |
| 📌 **Message Pinning** | Pin important messages in individual or group chats for quick access |
| 📊 **Interactive Polls** | Create and vote on polls within your conversations |
| ✏️ **Message Editing** | Correct mistakes or update info in sent messages |
| ↪️ **Message Forwarding** | Seamlessly share messages across different chats |
| ✅ **Message Status** | WhatsApp-style tick indicators (sent, delivered, read) |
| 🔒 **Advanced Privacy** | Block users, manage "Last Seen", profile picture & about visibility with real-time updates |
| 🎨 **Appearance Customization** | Personalize with chat backgrounds, bubble styles (6 styles), and font sizes (small/standard/large) |
| 🔐 **Multi-Session Security** | Global logout from all devices with token versioning & session management |
| 🔑 **Password Management** | In-app password change with current password verification |
| 👀 **Privacy Controls** | Granular control over read receipts, last seen, profile pic & about visibility (everyone/contacts/none) |
| 📱 **Friend Requests** | Robust system to manage connections and contacts |
| 🔐 **Secure Auth** | JWT-based authentication with email/password or Google OAuth login |
| 📧 **OTP Verification** | Email-based OTP for signup verification & account security |
| 🔑 **Password Recovery** | Forgot password flow with secure OTP-based reset |
| ✉️ **Welcome Emails** | Automated welcome emails upon successful signup verification |
| 🌙 **Dark Theme UI** | Premium, theme-aware interface built with DaisyUI |
| 🖼️ **Media Sharing** | Share images, GIFs, and more in real-time |

---

## 🛠️ Tech Stack

### Frontend
- **React 19** - Modern UI Library
- **Vite** - Lightning-fast Build Tool
- **TailwindCSS 4** - Modern Utility-first CSS
- **DaisyUI** - Premium Component Library
- **Zustand** - Light-weight State Management
- **Socket.io Client** - Real-time Communication
- **React Router DOM** - Declarative Routing
- **ZEGOCLOUD SDK** - Real-time Voice & Video
- **Lucide React / MUI Icons** - Rich Icon Sets

### Backend
- **Node.js** - JavaScript Runtime
- **Express 5** - Scalable Web Framework
- **MongoDB & Mongoose** - NoSQL Database & ODM
- **Socket.io** - WebSockets for Real-time Events
- **Node-Cron** - Task Scheduling for Messages
- **JWT & bcryptjs** - Secure Authentication & Hashing
- **Passport.js** - Google OAuth 2.0 Integration
- **Cloudinary** - Cloud-based Media Management
- **Nodemailer / Resend** - Reliable Email Services for OTP & Notifications

---

## 📁 Project Structure

```
chatappey/
├── backend/
│   └── src/
│       ├── controllers/       # Route handlers & logic
│       ├── models/            # Database schemas (User, Message, Group, etc.)
│       ├── routes/            # API endpoints (Auth, Messages, Groups, etc.)
│       ├── middleware/        # Security & Auth middleware
│       ├── lib/              # Core utilities (db, socket, cloudinary, cron)
│       └── index.js          # Server entry point
│
├── frontend/
│   └── src/
│       ├── components/        # UI components (Sidebar, Chat, Modals, etc.)
│       ├── pages/             # App views (Home, Profile, LoginHelp, Legal, etc.)
│       ├── store/             # Zustand global state (Auth, Chat, Groups, etc.)
│       ├── lib/              # API clients & helper functions
│       └── App.jsx           # Root component & Routing
│
└── README.md
```

---

## 🚀 Getting Started

### Prerequisites

- Node.js (v18 or higher)
- MongoDB Database (Atlas or Local)
- Cloudinary Account (for media)
- ZEGOCLOUD Account (for calling)
- Email Service API Key (Resend or Gmail SMTP)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/sahilkumarsahoo07/chatappey.git
   cd chatappey
   ```

2. **Backend Setup**
   ```bash
   cd backend
   npm install
   ```

3. **Frontend Setup**
   ```bash
   cd frontend
   npm install
   ```

4. **Environment Variables**
   
   Create a `.env` file in the `backend` folder. See [Environment Variables](#-environment-variables) for details.

5. **Run the Application**

   **Development mode:**
   ```bash
   # From the root directory (using concurrent execution if configured)
   # Or individually:
   cd backend && npm run dev
   cd frontend && npm run dev
   ```

6. **Open in Browser**
   
   Navigate to `http://localhost:5173`

---

## 🔐 Environment Variables

Create a `.env` file in the `backend` directory with the following variables:

```env
# Server Configuration
PORT=5001
NODE_ENV=development

# Database
MONGODB_URI=your_mongodb_connection_string

# Authentication
JWT_SECRET=your_jwt_secret_key

# Google OAuth 2.0 (Optional - for Login/Signup with Google)
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_CALLBACK_URL=http://localhost:5001/api/auth/google/callback

# Cloudinary (Image Uploads)
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Email Service (OTP & Resets)
RESEND_API_KEY=your_resend_api_key
# OR
EMAIL_USER=your_email_address
EMAIL_PASS=your_email_password

# ZEGOCLOUD (Voice/Video Calls)
ZEGO_APP_ID=your_zego_app_id
ZEGO_SERVER_SECRET=your_zego_server_secret
```

> ⚠️ **Important:** Never commit your `.env` file to version control.

---

## 🌐 Deployment

The application is optimized for deployment on modern platforms:

- **Frontend:** [Netlify](https://chatappey.netlify.app)
- **Backend:** [Render](https://chatappey.onrender.com)

---

## 📸 Screenshots

*The UI features a premium, responsive design with full dark mode support.*

---

## 🤝 Contributing

This is a **proprietary project**. Contributions are **not accepted** at this time.

---

## ⚠️ Disclaimer

This project is for educational and personal use only. The developer is not responsible for any misuse.

---

## 📜 License & Copyright

### All Rights Reserved

```
Copyright (c) 2024-2025 Sahil Kumar Sahoo. All Rights Reserved.

This source code and all associated documentation files (the "Software") are 
the exclusive property of Sahil Kumar Sahoo.

STRICTLY PROHIBITED:
━━━━━━━━━━━━━━━━━━━━
✗ Copying, reproducing, or duplicating any part of this code
✗ Modifying, adapting, or creating derivative works
✗ Distributing, publishing, or sharing the code publicly or privately
✗ Using the code for commercial purposes
✗ Sublicensing, selling, or transferring the code
✗ Reverse engineering or decompiling the software
✗ Using the code in any other project without explicit written permission

LEGAL NOTICE:
━━━━━━━━━━━━━
Unauthorized use, reproduction, or distribution of this software, or any 
portion of it, may result in severe civil and criminal penalties, and will 
be prosecuted to the maximum extent possible under the law.
```

---

## 👤 Author

<p align="center">
  <strong>Sahil Kumar Sahoo</strong>
</p>

<p align="center">
  <a href="https://github.com/sahilkumarsahoo07">
    <img src="https://img.shields.io/badge/GitHub-181717?style=for-the-badge&logo=github&logoColor=white" alt="GitHub">
  </a>
</p>

---

<p align="center">
  <strong>© 2025-2026 Sahil Kumar Sahoo. All Rights Reserved.</strong>
</p>

<p align="center">
  Made with ❤️ and ☕
</p>
