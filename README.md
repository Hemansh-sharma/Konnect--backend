# 🚀 Konnect Backend

A scalable backend powering **Konnect**, a modern social networking platform that enables users to connect, chat in real-time, share media, and make peer-to-peer video calls.

Built with **Node.js**, **Express.js**, **MongoDB**, **Socket.io**, and **WebRTC**, the backend provides secure authentication, real-time communication, and RESTful APIs for the frontend.

---

## ✨ Features

- 🔐 JWT Authentication & Authorization
- 👤 User Profile Management
- 🤝 Connection Requests & User Matching
- 💬 Real-time Messaging using Socket.io
- 📷 Image Sharing
- 📞 Peer-to-Peer Video Calling (WebRTC Signaling)
- 👥 Group Chats
- 🟢 Online Presence Tracking
- 📧 Automated Email Notifications
- ⏰ Scheduled Background Jobs (Cron)
- 🛡️ Password Hashing using bcrypt
- 🌐 RESTful API Architecture
- 📦 MongoDB Database Integration

---

# 🛠 Tech Stack

| Category | Technologies |
|----------|--------------|
| Backend | Node.js, Express.js |
| Database | MongoDB, Mongoose |
| Authentication | JWT, bcrypt |
| Real-Time | Socket.io |
| Video Calling | WebRTC |
| Scheduling | Node-Cron |
| Email | Nodemailer |
| API Testing | Postman |

---

# 📂 Project Structure

```
Konnect-backend
│
├── src
│   ├── config
│   ├── controllers
│   ├── middleware
│   ├── models
│   ├── routes
│   ├── sockets
│   ├── utils
│   └── app.js
│
├── .env
├── package.json
└── README.md
```

---

# ⚙️ Installation

Clone the repository

```bash
git clone https://github.com/Hemansh-sharma/Konnect--backend.git
```

Move into the project

```bash
cd Konnect--backend
```

Install dependencies

```bash
npm install
```

Create a **.env** file

```env
PORT=5000

MONGODB_URI=your_mongodb_connection_string

JWT_SECRET=your_secret_key

EMAIL_USER=your_email

EMAIL_PASS=your_password
```

Start the development server

```bash
npm run dev
```

or

```bash
npm start
```

---

# 📡 API Features

### Authentication

- Register User
- Login User
- JWT Verification

### User

- Update Profile
- Upload Avatar
- View Profile
- Search Users

### Connections

- Send Request
- Accept Request
- Reject Request
- Remove Connection

### Chat

- One-to-One Messaging
- Group Messaging
- Image Sharing
- Read Receipts

### Video Calls

- WebRTC Signaling
- Call Initiation
- Call Acceptance
- ICE Candidate Exchange

---

# 🔒 Security

- JWT Authentication
- Password Hashing with bcrypt
- Protected Routes
- Input Validation
- Secure Environment Variables

---

# 🚀 Future Improvements

- Push Notifications
- Voice Messages
- Message Encryption
- AI Friend Recommendations
- Story Feature
- File Sharing
- Multi-device Synchronization

---

# 👨‍💻 Author

**Hemansh Sharma**

GitHub: https://github.com/Hemansh-sharma

LinkedIn: https://www.linkedin.com/in/hemansh-sharma-995811350/

---

# 📄 License

This project is licensed under the MIT License.

---

## ⭐ If you like this project, consider giving it a star!
