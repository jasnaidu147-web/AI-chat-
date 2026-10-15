# 🤖 Gemini AI Chatbot — Fullstack Application with Supabase Cloud Sync

A state-of-the-art conversational chatbot powered by Google Gemini LLM and Supabase Database, featuring a high-contrast dark theme, glassmorphic UI, real-time token streaming (Server-Sent Events), multi-turn chat history, code syntax highlighting, custom AI personas, and speech capabilities.

The project is structured with a **clean, strict architectural separation** between the `frontend` and `backend` directories, each with its own dedicated `.env` configuration file.

---

## 📁 Project Architecture & Folder Differentiation

```text
JACK/
├── backend/                        # 🖥️ Node.js + Express Backend Server
│   ├── controllers/
│   │   └── chatController.js       # Request handlers (Health, Config, Models, Chat, Streaming SSE, Supabase Sync)
│   ├── services/
│   │   ├── geminiService.js        # Official @google/genai SDK wrapper & conversation formatter
│   │   └── supabaseService.js      # Supabase Client SDK for database operations
│   ├── .env.example                # Template for backend environment variables
│   ├── .env                        # Local backend environment file (API keys & Supabase credentials)
│   ├── package.json                # Dependencies (@google/genai, @supabase/supabase-js, express, cors, dotenv)
│   └── server.js                   # Main Express application entrypoint
│
├── frontend/                       # 🌐 Client-side Single Page Application (HTML / CSS / Vanilla JS)
│   ├── assets/                     # 3D Avatar icons & brand visuals
│   │   ├── bot-avatar.jpg          # Gemini holographic AI orb avatar
│   │   └── user-avatar.jpg         # User profile avatar
│   ├── css/
│   │   └── style.css               # Modern glassmorphism, responsive grid & animations
│   ├── js/
│   │   └── app.js                  # Chat engine, streaming SSE client, Supabase client sync, Web Speech API & state
│   ├── .env.example                # Template for frontend environment variables
│   ├── .env                        # Local frontend environment file (Public Supabase URL & Anon Key)
│   └── index.html                  # Accessible semantic UI with sidebar, personas, Supabase status & modal
│
├── supabase_schema.sql             # SQL script to create conversations and messages tables in Supabase
└── README.md                       # Comprehensive project documentation
```

---

## 🔐 Environment Variables (`.env`)

### 1. Backend: `backend/.env`
Located at `backend/.env`. Contains server settings, your Gemini API Key, and Supabase credentials:

```env
# Server Port
PORT=5000

# Google Gemini API Key (Get free at https://aistudio.google.com/app/apikey)
GEMINI_API_KEY=your_gemini_api_key_here

# Default Gemini Model
DEFAULT_MODEL=gemini-2.5-flash

# Supabase Project Credentials (From Supabase Dashboard -> Project Settings -> API)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_supabase_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key_here
```

### 2. Frontend: `frontend/.env`
Located at `frontend/.env`. Contains client-safe public variables:

```env
# Supabase Project URL (Public)
SUPABASE_URL=https://your-project.supabase.co

# Supabase Anon / Public API Key (Client-Safe)
SUPABASE_ANON_KEY=your_supabase_anon_key_here

# Backend API Service URL
BACKEND_URL=http://localhost:5000
```

> **How Frontend loads `.env`**: The Express server dynamically serves the client-safe variables via `/env.js` into `window.__ENV__`. You can also configure or override your keys directly in the web UI Settings modal at any time!

---

## ⚡ Supabase Setup (Database Cloud Sync)

1. Go to [Supabase](https://supabase.com) and create a free project.
2. Go to **SQL Editor** in your Supabase Dashboard and click **New Query**.
3. Copy and run the contents of [`supabase_schema.sql`](file:///c:/Users/HP/Desktop/JACK/supabase_schema.sql).
4. Go to **Project Settings** -> **API**:
   - Copy **Project URL** and paste into `SUPABASE_URL` in both `backend/.env` and `frontend/.env`.
   - Copy **anon / public key** and paste into `SUPABASE_ANON_KEY` in both `backend/.env` and `frontend/.env`.
   - Copy **service_role key** (secret) and paste into `SUPABASE_SERVICE_ROLE_KEY` in `backend/.env`.

---

## 🚀 Quick Start Guide

### 1. Install Dependencies & Start the Backend
```powershell
cd backend
npm install
npm start
```

### 2. Open in Browser
Navigate to:
```
http://localhost:5000
```

### 3. Configure via Web UI
Click **⚙️ Settings** in the bottom-left sidebar of the app:
- Set or test your **Gemini API Key**.
- Set or test your **Supabase Project URL & Anon Key**.
- Click **Test Supabase Connection** to verify database connectivity in real-time.
- If Supabase is not configured, the app will automatically and safely fall back to local browser storage so chatting always works seamlessly!

---

## 🌟 Key Features

1. **Official Google Gen AI SDK (`@google/genai`)**:
   - Support for `gemini-2.5-flash`, `gemini-2.5-pro`, `gemini-2.0-flash`, `gemini-1.5-flash`.
2. **Supabase Cloud Sync**:
   - Dual-persistence: conversations and messages are mirrored to Supabase cloud database.
   - Offline fallback: continues functioning seamlessly via browser `localStorage` when offline.
3. **Real-time SSE Streaming**:
   - High-performance typewriter token streaming via Server-Sent Events.
4. **Interactive Personas**:
   - 🤖 **General Assistant**
   - 💻 **Code Architect**
   - 🎨 **Creative Writer**
   - 🧠 **Deep Analyst**
5. **Speech Capabilities**:
   - 🎙️ Voice dictation using browser Web Speech API.
   - 🔊 Audio read-aloud text-to-speech for AI answers.
6. **Markdown & Syntax Highlighting**:
   - Pre-formatted code blocks with language indicators and 1-click **"Copy Code"** buttons.
