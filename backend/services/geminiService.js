const { GoogleGenAI } = require('@google/genai');

/**
 * Available recommended Gemini models
 */
const AVAILABLE_MODELS = [
  {
    id: 'gemini-3.8-flash',
    name: 'Gemini 3.8 Flash',
    description: 'Latest high-performance multimodal Gemini model',
    badge: 'Recommended'
  },
  {
    id: 'gemini-3.5-flash',
    name: 'Gemini 3.5 Flash',
    description: 'Fast, highly stable, and versatile',
    badge: 'Fast'
  },
  {
    id: 'gemini-3.1-pro-preview',
    name: 'Gemini 3.1 Pro',
    description: 'Deep reasoning, advanced logic, and complex coding',
    badge: 'Advanced'
  },
  {
    id: 'gemini-3.5-flash-lite',
    name: 'Gemini 3.5 Flash Lite',
    description: 'Ultra-low latency model for high-speed chat',
    badge: 'Lite'
  }
];

/**
 * Helper to get a GoogleGenAI client instance
 * @param {string|undefined} userApiKey - Optional key provided per-request
 */
function getClient(userApiKey) {
  const apiKey = userApiKey || process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'your_gemini_api_key_here') {
    const error = new Error('GEMINI_API_KEY is not configured. Please add it to backend/.env or enter it in the UI settings.');
    error.statusCode = 401;
    throw error;
  }
  return new GoogleGenAI({ apiKey });
}

/**
 * Format chat messages into the Gemini contents format
 * @param {Array<{role: string, content: string}>} messages
 */
function formatContents(messages) {
  if (!Array.isArray(messages) || messages.length === 0) {
    throw new Error('Messages array must not be empty.');
  }

  return messages.map((msg) => {
    // Map standard roles: assistant -> model
    let role = msg.role === 'assistant' || msg.role === 'model' ? 'model' : 'user';
    return {
      role,
      parts: [
        { text: typeof msg.content === 'string' ? msg.content : String(msg.content || '') }
      ]
    };
  });
}

/**
 * Generate a complete chat response
 */
async function generateChatResponse({ messages, model, systemInstruction, temperature, apiKey }) {
  const ai = getClient(apiKey);
  const preferredModel = model || process.env.DEFAULT_MODEL || 'gemini-3.5-flash';
  const contents = formatContents(messages);

  const config = {
    temperature: typeof temperature === 'number' ? temperature : 0.7
  };

  if (systemInstruction && systemInstruction.trim().length > 0) {
    config.systemInstruction = systemInstruction.trim();
  }

  // Model fallback chain: try preferred, then 3.5-flash, then 3.8-flash
  const modelsToTry = [preferredModel];
  if (!modelsToTry.includes('gemini-3.5-flash')) modelsToTry.push('gemini-3.5-flash');
  if (!modelsToTry.includes('gemini-3.8-flash')) modelsToTry.push('gemini-3.8-flash');

  let lastError = null;
  for (const modelCandidate of modelsToTry) {
    try {
      const response = await ai.models.generateContent({
        model: modelCandidate,
        contents,
        config
      });

      return {
        reply: response.text || '',
        model: modelCandidate,
        timestamp: new Date().toISOString()
      };
    } catch (err) {
      lastError = err;
      const isRecoverable = err.status === 503 || err.status === 404 || err.message?.includes('503') || err.message?.includes('404');
      if (!isRecoverable) {
        throw err;
      }
      console.warn(`Model ${modelCandidate} returned status ${err.status}, trying fallback...`);
    }
  }

  throw lastError;
}

/**
 * Generate a streaming chat response
 */
async function streamChatResponse({ messages, model, systemInstruction, temperature, apiKey }) {
  const ai = getClient(apiKey);
  const preferredModel = model || process.env.DEFAULT_MODEL || 'gemini-3.5-flash';
  const contents = formatContents(messages);

  const config = {
    temperature: typeof temperature === 'number' ? temperature : 0.7
  };

  if (systemInstruction && systemInstruction.trim().length > 0) {
    config.systemInstruction = systemInstruction.trim();
  }

  const modelsToTry = [preferredModel];
  if (!modelsToTry.includes('gemini-3.5-flash')) modelsToTry.push('gemini-3.5-flash');
  if (!modelsToTry.includes('gemini-3.8-flash')) modelsToTry.push('gemini-3.8-flash');

  let lastError = null;
  for (const modelCandidate of modelsToTry) {
    try {
      const stream = await ai.models.generateContentStream({
        model: modelCandidate,
        contents,
        config
      });

      return { stream, model: modelCandidate };
    } catch (err) {
      lastError = err;
      const isRecoverable = err.status === 503 || err.status === 404 || err.message?.includes('503') || err.message?.includes('404');
      if (!isRecoverable) {
        throw err;
      }
      console.warn(`Streaming model ${modelCandidate} returned status ${err.status}, trying fallback...`);
    }
  }

  throw lastError;
}

module.exports = {
  AVAILABLE_MODELS,
  getClient,
  generateChatResponse,
  streamChatResponse
};
