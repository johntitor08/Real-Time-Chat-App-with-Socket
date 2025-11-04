# 👑 King's Chat - Real-Time Chat Application

A feature-rich, real-time chat application with secure rooms, file sharing, and emoji reactions. Built with Node.js, Express, and Socket.IO.

<https://img.shields.io/badge/Live-Demo-brightgreen> <https://img.shields.io/badge/Node.js-18+-green> <https://img.shields.io/badge/Socket.IO-4.0-blue>

## 🚀 Live Demo

### 🎉 APP IS LIVE AT: <https://real-time-chat-app-with-socket.onrender.com/>

## ✨ Features

### 💬 Core Chat

Real-time messaging - Instant message delivery

Multiple rooms - Join different chat rooms

User presence - See who's online

Typing indicators - Know when others are typing

### 🔐 Security & Privacy

Private rooms - Secure rooms with access keys

User authentication - Simple username-based login

Room permissions - Public and private room options

### 📁 Media & Interactions

File sharing - Upload and share images, documents, and more

Emoji reactions - React to messages with emojis

Message history - Persistent chat history

### 🎯 Advanced Features

Chat commands - Powerful slash commands

Mobile responsive - Works on all devices

Beautiful UI - Modern, centered design

## 🎉 Quick Start

Visit the app: <https://real-time-chat-app-with-socket.onrender.com/>

Enter a username to join the chat

Start chatting in the general room

Create private rooms with /create secret private

Invite friends by sharing the URL!

### 🛠️ Installation (For Development)

Prerequisites:

Node.js 18 or higher

npm or yarn

Local Development:

```bash

# Clone the repository

git clone <https://github.com/yourusername/kings-chat.git>
cd kings-chat

# Install dependencies

npm install

# Start development server

npm run dev

# Or start production server

npm start
Visit <http://localhost:3000> to see the app running locally.

```

### 🚀 Deployment

Fork this repository

Go to Render

Create new Web Service

Connect repository and deploy

### 💻 Usage

Join Chat: Enter your username to join

Start Chatting: Send messages in the general room

Explore Rooms: Create or join different chat rooms

#### Chat Commands

text
/help                 - Show all commands
/users                - List online users
/rooms                - Show available rooms
/create {name} {type} - Create room (public/private)
/join {room} {key}    - Join room (key for private)
/leave                - Leave current room
/info                 - Room information
/pm {user} {message}  - Private message

#### File Sharing

Click the paperclip icon 📎 to upload files

Drag & drop files into the upload area

Supports images, PDFs, documents (up to 10MB)

#### Emoji Reactions

Click the smiley face 😊 on any message

Choose from categorized emojis

See who else reacted

#### 🏗️ Technology Stack

Backend: Node.js, Express.js, Socket.IO

Frontend: HTML5, CSS3, JavaScript (ES6+)

File Upload: Multer

Deployment: Render.com

Real-time: WebSockets via Socket.IO

#### 📁 Project Structure

├── server.js                 # Main server file
├── package.json              # Dependencies and scripts
├── public/
│   └── index.html            # Client-side application
├── message-history.json      # Chat history (auto-generated)
└── README.md                 # This file

#### 🔧 Configuration

Server Configuration

Port: 3000 (or environment variable PORT)

File Size Limit: 10MB

Message History: Last 100 messages per room

#### Room Types

Public Rooms 🔓 - Anyone can join

Private Rooms 🔒 - Require access key

#### 🐛 Troubleshooting

##### Common Issues

File uploads not working in production:

Free hosting platforms don't support persistent file storage

Files are temporarily stored in memory during session

##### Connection issues

Check if WebSockets are supported by your network

Ensure you're using HTTPS for secure connections

##### Deployment failed

Verify all files are committed to GitHub

Check build logs in deployment platform

##### Getting Help

Check the deployment logs for errors

Test features locally first

Open an issue on GitHub with details

##### 🤝 Contributing

We welcome contributions! Here's how:

###### Fork the project

Create a feature branch (git checkout -b feature/AmazingFeature)

Commit your changes (git commit -m 'Add some AmazingFeature')

Push to the branch (git push origin feature/AmazingFeature)

Open a Pull Request

###### Development Setup

```bash
npm install
npm run dev  # Starts with nodemon for auto-reload
```

##### 📝 License

COPYLEFT

##### 🎉 Acknowledgments

Built with Socket.IO for real-time functionality

Deployed on Render for easy hosting

Icons and emojis from Unicode standards

###### 📞 Support

If you need help:

Check this README first

Open an issue on GitHub

Contact the development team

##### 🎊 Your App is Successfully Deployed! 🚀

Your real-time chat app is now live and accessible to anyone in the world at:

<https://real-time-chat-app-with-socket.onrender.com/>

What you've accomplished:

✅ Real-time chat application deployed

✅ Accessible from anywhere in the world 🌍

✅ Auto-deploys on code changes

✅ Free hosting with SSL

✅ All features working: messaging, rooms, file sharing, emoji reactions

###### Share with friends and start chatting! 🚀
