const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const chatController = require('./controllers/chatController');
const supabaseService = require('./services/supabaseService');

const app = express();
const PORT = process.env.PORT || 5000;

// Enable Cross-Origin Resource Sharing (CORS)
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-gemini-api-key']
}));

// Parse JSON request bodies
app.use(express.json({ limit: '10mb' }));

// Serve frontend .env variables dynamically to the client via /env.js
app.get('/env.js', (req, res) => {
  let frontendEnv = {};
  const frontendEnvPath = path.join(__dirname, '..', 'frontend', '.env');

  if (fs.existsSync(frontendEnvPath)) {
    try {
      const content = fs.readFileSync(frontendEnvPath, 'utf8');
      const lines = content.split(/\r?\n/);
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const eqIdx = trimmed.indexOf('=');
          if (eqIdx !== -1) {
            const key = trimmed.slice(0, eqIdx).trim();
            const val = trimmed.slice(eqIdx + 1).trim();
            frontendEnv[key] = val;
          }
        }
      }
    } catch (e) {
      console.warn('Could not read frontend/.env:', e.message);
    }
  }

  // Fallback to backend environment variables if not set in frontend/.env
  const clientConfig = {
    SUPABASE_URL: frontendEnv.SUPABASE_URL || process.env.SUPABASE_URL || '',
    SUPABASE_ANON_KEY: frontendEnv.SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '',
    BACKEND_URL: frontendEnv.BACKEND_URL || `http://localhost:${PORT}`
  };

  res.setHeader('Content-Type', 'application/javascript');
  res.setHeader('Cache-Control', 'no-cache');
  res.send(`window.__ENV__ = ${JSON.stringify(clientConfig)};`);
});

// Serve frontend static assets directly
const frontendPath = path.join(__dirname, '..', 'frontend');
app.use(express.static(frontendPath));

// API Diagnostics & Config
app.get('/api/health', chatController.getHealth);
app.get('/api/config', chatController.getConfig);
app.get('/api/models', chatController.getModels);
app.get('/api/supabase/status', chatController.getSupabaseStatus);

// API Chat Endpoints
app.post('/api/chat', chatController.handleChat);
app.post('/api/chat/stream', chatController.handleChatStream);

// Supabase Conversation Cloud Sync Endpoints
app.get('/api/conversations', chatController.getSupabaseConversations);
app.post('/api/conversations', chatController.saveSupabaseConversation);
app.delete('/api/conversations/:id', chatController.deleteSupabaseConversation);

// Catch-all route to serve frontend index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});

// Centralized error handler
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err);
  res.status(500).json({
    error: 'InternalServerError',
    message: err.message || 'An unexpected error occurred.'
  });
});

app.listen(PORT, () => {
  const hasGemini = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'your_gemini_api_key_here');
  const hasSupabase = supabaseService.isConfigured();

  console.log('='.repeat(60));
  console.log(`🤖 Gemini Chatbot Backend running at: http://localhost:${PORT}`);
  console.log(`🌐 Frontend accessible at:        http://localhost:${PORT}`);
  console.log(`🔑 Gemini API Key configured:     ${hasGemini ? 'YES ✅' : 'NO ⚠️'}`);
  console.log(`⚡ Supabase Database configured:   ${hasSupabase ? 'YES ✅' : 'NO ⚠️'}`);
  console.log('='.repeat(60));
});
