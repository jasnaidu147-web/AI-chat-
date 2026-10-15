const geminiService = require('../services/geminiService');
const supabaseService = require('../services/supabaseService');

/**
 * Health check endpoint
 */
async function getHealth(req, res) {
  const envKey = process.env.GEMINI_API_KEY;
  const isGeminiConfigured = Boolean(envKey && envKey !== 'your_gemini_api_key_here' && envKey.trim().length > 10);
  const isSupabaseConfigured = supabaseService.isConfigured();

  return res.json({
    status: 'ok',
    service: 'Gemini Chatbot API',
    apiKeyConfiguredInEnv: isGeminiConfigured,
    supabaseConfigured: isSupabaseConfigured,
    defaultModel: process.env.DEFAULT_MODEL || 'gemini-2.5-flash',
    uptime: process.uptime()
  });
}

/**
 * Get client-safe public configuration (Supabase & backend info)
 */
function getConfig(req, res) {
  const isSupabaseConfigured = supabaseService.isConfigured();
  return res.json({
    supabaseUrl: process.env.SUPABASE_URL || '',
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY || '',
    supabaseConfigured: isSupabaseConfigured,
    backendUrl: `http://localhost:${process.env.PORT || 5000}`,
    defaultModel: process.env.DEFAULT_MODEL || 'gemini-2.5-flash'
  });
}

/**
 * Check Supabase connection status
 */
async function getSupabaseStatus(req, res) {
  const status = await supabaseService.checkConnection();
  return res.json(status);
}

/**
 * Get available Gemini models
 */
function getModels(req, res) {
  return res.json({
    models: geminiService.AVAILABLE_MODELS,
    defaultModel: process.env.DEFAULT_MODEL || 'gemini-2.5-flash'
  });
}

/**
 * Standard chat endpoint (JSON response)
 */
async function handleChat(req, res) {
  try {
    const { messages, model, systemInstruction, temperature, conversationId } = req.body;
    const apiKey = req.headers['x-gemini-api-key'] || undefined;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'A non-empty "messages" array is required.'
      });
    }

    const result = await geminiService.generateChatResponse({
      messages,
      model,
      systemInstruction,
      temperature,
      apiKey
    });

    // Optionally persist in Supabase in background if configured and conversationId provided
    if (conversationId && supabaseService.isConfigured()) {
      const lastUserMsg = messages[messages.length - 1];
      if (lastUserMsg) {
        supabaseService.saveMessage(conversationId, 'user', lastUserMsg.content).catch(() => {});
      }
      supabaseService.saveMessage(conversationId, 'model', result.reply).catch(() => {});
    }

    return res.json(result);
  } catch (error) {
    console.error('Chat error:', error);
    const statusCode = error.statusCode || error.status || 500;
    return res.status(statusCode).json({
      error: error.name || 'ChatError',
      message: error.message || 'Failed to generate response from Gemini.'
    });
  }
}

/**
 * Streaming chat endpoint (Server-Sent Events)
 */
async function handleChatStream(req, res) {
  try {
    const { messages, model, systemInstruction, temperature, conversationId } = req.body;
    const apiKey = req.headers['x-gemini-api-key'] || undefined;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'A non-empty "messages" array is required.'
      });
    }

    const { stream, model: selectedModel } = await geminiService.streamChatResponse({
      messages,
      model,
      systemInstruction,
      temperature,
      apiKey
    });

    // Set headers for Server-Sent Events (SSE)
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    res.write(`data: ${JSON.stringify({ type: 'start', model: selectedModel })}\n\n`);

    let completeReply = '';
    for await (const chunk of stream) {
      const text = chunk.text;
      if (text) {
        completeReply += text;
        res.write(`data: ${JSON.stringify({ type: 'chunk', text })}\n\n`);
      }
    }

    res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
    res.end();

    // Persist complete message in Supabase
    if (conversationId && supabaseService.isConfigured() && completeReply) {
      const lastUserMsg = messages[messages.length - 1];
      if (lastUserMsg) {
        supabaseService.saveMessage(conversationId, 'user', lastUserMsg.content).catch(() => {});
      }
      supabaseService.saveMessage(conversationId, 'model', completeReply).catch(() => {});
    }
  } catch (error) {
    console.error('Streaming error:', error);
    if (!res.headersSent) {
      const statusCode = error.statusCode || error.status || 500;
      return res.status(statusCode).json({
        error: error.name || 'StreamError',
        message: error.message || 'Error occurred while streaming response.'
      });
    } else {
      res.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`);
      res.end();
    }
  }
}

/**
 * Supabase conversation sync handlers
 */
async function getSupabaseConversations(req, res) {
  const data = await supabaseService.getConversations();
  return res.json({ conversations: data || [] });
}

async function saveSupabaseConversation(req, res) {
  const { id, title } = req.body;
  if (!id) return res.status(400).json({ error: 'id is required' });
  const result = await supabaseService.saveConversation(id, title || 'New Conversation');
  return res.json({ success: Boolean(result), data: result });
}

async function deleteSupabaseConversation(req, res) {
  const { id } = req.params;
  const result = await supabaseService.deleteConversation(id);
  return res.json({ success: result });
}

module.exports = {
  getHealth,
  getConfig,
  getSupabaseStatus,
  getModels,
  handleChat,
  handleChatStream,
  getSupabaseConversations,
  saveSupabaseConversation,
  deleteSupabaseConversation
};
