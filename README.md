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
| 👥 **Group Chats** | Create and manage group conversations |
| 📞 **Voice & Video Calls** | Integrated calling with ZEGOCLOUD SDK |
| 🔔 **Push Notifications** | Browser notifications for new messages |
| 🌙 **Dark Theme UI** | Modern, eye-friendly dark interface with DaisyUI themes |
| 🖼️ **Media Sharing** | Share images and GIFs in conversations |
| 😊 **Emoji Support** | Rich emoji picker for expressive messaging |
| ✅ **Message Status** | WhatsApp-style tick indicators (sent, delivered, read) |
| 👤 **User Profiles** | Customizable user profiles with avatars |
| 🔒 **User Privacy** | Block users and control who sees your online status |
| 📱 **Friend Requests** | Send, accept, or decline friend requests |
| 🔐 **Secure Authentication** | JWT-based authentication with OTP verification |

---

## 🛠️ Tech Stack

### Frontend
- **React 19** - UI Library
- **Vite** - Build Tool & Dev Server
- **TailwindCSS 4** - Utility-first CSS Framework
- **DaisyUI** - Component Library for Tailwind
- **Zustand** - State Management
- **Socket.io Client** - Real-time Communication
- **React Router DOM** - Client-side Routing
- **Material UI Icons** - Icon Library
- **Axios** - HTTP Client
- **ZEGOCLOUD SDK** - Voice/Video Calling

### Backend
- **Node.js** - Runtime Environment
- **Express 5** - Web Framework
- **MongoDB** - NoSQL Database
- **Mongoose** - ODM for MongoDB
- **Socket.io** - Real-time Events
- **JWT** - Authentication Tokens
- **bcryptjs** - Password Hashing
- **Cloudinary** - Image Storage
- **Nodemailer/Resend** - Email Services

---

## 📁 Project Structure

```
chatappey/
├── backend/
│   └── src/
│       ├── controllers/       # Route handlers
│       │   ├── auth.controllers.js
│       │   ├── message.controllers.js
│       │   ├── group.controllers.js
│       │   ├── call.controllers.js
│       │   ├── friendRequest.controllers.js
│       │   └── notification.controllers.js
│       ├── models/            # MongoDB schemas
│       │   ├── user.model.js
│       │   ├── message.model.js
│       │   ├── group.model.js
│       │   ├── groupMessage.model.js
│       │   ├── call.model.js
│       │   ├── friendRequest.model.js
│       │   └── notification.model.js
│       ├── routes/            # API routes
│       ├── middleware/        # Auth middleware
│       ├── lib/              # Utilities (db, socket, cloudinary)
│       └── index.js          # Entry point
│
├── frontend/
│   └── src/
│       ├── components/        # Reusable UI components
│       │   ├── ChatContainer.jsx
│       │   ├── ChatHeader.jsx
│       │   ├── Sidebar.jsx
│       │   ├── MessageInput.jsx
│       │   ├── GroupChatContainer.jsx
│       │   ├── CallWindow.jsx
│       │   └── ...more
│       ├── pages/             # Route pages
│       │   ├── HomePage.jsx
│       │   ├── LoginPage.jsx
│       │   ├── SignUpPage.jsx
│       │   ├── ProfilePage.jsx
│       │   ├── SettingsPage.jsx
│       │   └── ...more
│       ├── store/             # Zustand stores
│       │   ├── useAuthStore.js
│       │   ├── useChatStore.js
│       │   ├── useGroupStore.js
│       │   ├── useCallStore.js
│       │   └── ...more
│       ├── lib/              # Utilities
│       └── App.jsx           # Main app component
│
└── README.md
```

---

## 🚀 Getting Started

### Prerequisites

- Node.js (v18 or higher)
- MongoDB Database
- Cloudinary Account
- ZEGOCLOUD Account (for voice/video calls)

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
   
   Create a `.env` file in the `backend` folder with the required environment variables. See [Environment Variables](#-environment-variables) section below.

5. **Run the Application**

   **Backend:**
   ```bash
   cd backend
   npm run dev
   ```

   **Frontend:**
   ```bash
   cd frontend
   npm run dev
   ```

6. **Open in Browser**
   
   Navigate to `http://localhost:5173`

---

## 🔐 Environment Variables

Create a `.env` file in the `backend` directory with the following variables:

```env
# Server Configuration
PORT=your_port_number

# Database
MONGODB_URI=your_mongodb_connection_string

# Authentication
JWT_SECRET=your_jwt_secret_key

# Cloudinary (Image Uploads)
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Email Service (for OTP)
EMAIL_USER=your_email_address
EMAIL_PASS=your_email_password
# OR
RESEND_API_KEY=your_resend_api_key

# ZEGOCLOUD (Voice/Video Calls)
ZEGO_APP_ID=your_zego_app_id
ZEGO_SERVER_SECRET=your_zego_server_secret
```

> ⚠️ **Important:** Never commit your `.env` file to version control. Keep your credentials safe!

---

## 🌐 Deployment

The application is deployed on:

- **Frontend:** [Netlify](https://chatappey.netlify.app)
- **Backend:** [Render](https://chatappey.onrender.com)

---

## 📸 Screenshots

*Coming soon...*

---

## 🤝 Contributing

This is a **proprietary project**. Contributions are **not accepted** at this time.

If you find bugs or have suggestions, please open an issue but do not submit pull requests.

---

## ⚠️ Disclaimer

This project is for educational and personal use only. The developer is not responsible for any misuse of this application.

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

PERMITTED USE:
━━━━━━━━━━━━━━
✓ Viewing the code for personal educational reference only

LEGAL NOTICE:
━━━━━━━━━━━━━
Unauthorized use, reproduction, or distribution of this software, or any 
portion of it, may result in severe civil and criminal penalties, and will 
be prosecuted to the maximum extent possible under the law.

For licensing inquiries or permission requests, contact:
GitHub: https://github.com/sahilkumarsahoo07
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
