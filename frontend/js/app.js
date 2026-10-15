/**
 * Gemini AI Studio — Frontend Chat Client with Supabase Integration
 */

// Personas Configuration
const PERSONAS = {
  general: {
    name: 'General Assistant',
    instruction: 'You are Gemini, a helpful, intelligent, empathetic, and highly capable AI assistant developed by Google. Answer accurately, clearly, and concisely with markdown formatting when helpful.',
    icon: '🤖'
  },
  coder: {
    name: 'Code Architect',
    instruction: 'You are an elite principal software engineer and systems architect. Provide production-ready, clean, secure, and modern code. Always use markdown code blocks with language identifiers, explain key architectural decisions, and highlight best practices and edge cases.',
    icon: '💻'
  },
  writer: {
    name: 'Creative Writer',
    instruction: 'You are a master storyteller, copywriter, and wordsmith. Craft engaging, evocative, vividly descriptive, and stylistically refined prose and poetry with flair and emotional resonance.',
    icon: '🎨'
  },
  analyst: {
    name: 'Deep Analyst',
    instruction: 'You are a rigorous analytical thinker and data strategist. Break down complex problems systematically, evaluate trade-offs with structured bullet points or tables, and provide objective, evidence-based reasoning.',
    icon: '🧠'
  }
};

// Client Environment Resolution (from window.__ENV__ loaded via /env.js, with localStorage fallback)
const clientEnv = window.__ENV__ || {};

// Application State
const state = {
  backendUrl: clientEnv.BACKEND_URL || (window.location.origin.includes('http') ? window.location.origin : 'http://localhost:5000'),
  apiKey: localStorage.getItem('gemini_api_key') || '',
  model: localStorage.getItem('gemini_model') || 'gemini-3.8-flash',
  temperature: parseFloat(localStorage.getItem('gemini_temp') || '0.7'),
  isStreaming: localStorage.getItem('gemini_stream') !== 'false',
  customInstruction: localStorage.getItem('gemini_custom_prompt') || '',
  activePersona: localStorage.getItem('gemini_persona') || 'general',
  voiceEnabled: localStorage.getItem('gemini_voice') === 'true',
  conversations: JSON.parse(localStorage.getItem('gemini_conversations') || '[]'),
  currentChatId: null,
  isGenerating: false,
  backendHasEnvKey: false,

  // Supabase State
  supabaseUrl: localStorage.getItem('supabase_url') || clientEnv.SUPABASE_URL || '',
  supabaseAnonKey: localStorage.getItem('supabase_anon_key') || clientEnv.SUPABASE_ANON_KEY || '',
  supabaseConnected: false,
  supabaseClient: null
};

// DOM Elements
const DOM = {
  // Sidebar
  sidebar: document.getElementById('sidebar'),
  sidebarBackdrop: document.getElementById('sidebarBackdrop'),
  closeSidebarBtn: document.getElementById('closeSidebarBtn'),
  mobileMenuBtn: document.getElementById('mobileMenuBtn'),
  newChatBtn: document.getElementById('newChatBtn'),
  historyList: document.getElementById('historyList'),
  clearAllHistoryBtn: document.getElementById('clearAllHistoryBtn'),
  personaChips: document.getElementById('personaChips'),
  statusGlow: document.getElementById('statusGlow'),
  statusLabel: document.getElementById('statusLabel'),
  openSettingsBtn: document.getElementById('openSettingsBtn'),
  currentModelBadge: document.getElementById('currentModelBadge'),

  // Supabase Status UI
  supabaseGlow: document.getElementById('supabaseGlow'),
  supabaseLabel: document.getElementById('supabaseLabel'),
  topbarSupabaseTag: document.getElementById('topbarSupabaseTag'),

  // Topbar
  sessionTitle: document.getElementById('sessionTitle'),
  topbarModelTag: document.getElementById('topbarModelTag'),
  topbarPersonaTag: document.getElementById('topbarPersonaTag'),
  topbarStreamTag: document.getElementById('topbarStreamTag'),
  ttsToggleBtn: document.getElementById('ttsToggleBtn'),
  ttsIcon: document.getElementById('ttsIcon'),
  exportChatBtn: document.getElementById('exportChatBtn'),
  clearChatBtn: document.getElementById('clearChatBtn'),

  // Viewport & Messages
  chatViewport: document.getElementById('chatViewport'),
  welcomeHero: document.getElementById('welcomeHero'),
  messagesContainer: document.getElementById('messagesContainer'),
  typingIndicator: document.getElementById('typingIndicator'),

  // Input
  chatTextarea: document.getElementById('chatTextarea'),
  sendBtn: document.getElementById('sendBtn'),
  micBtn: document.getElementById('micBtn'),
  charCounter: document.getElementById('charCounter'),

  // Settings Modal
  settingsModal: document.getElementById('settingsModal'),
  closeSettingsBtn: document.getElementById('closeSettingsBtn'),
  saveSettingsBtn: document.getElementById('saveSettingsBtn'),
  testKeyBtn: document.getElementById('testKeyBtn'),
  apiKeyInput: document.getElementById('apiKeyInput'),
  toggleApiKeyVisBtn: document.getElementById('toggleApiKeyVisBtn'),

  // Supabase Settings
  supabaseUrlInput: document.getElementById('supabaseUrlInput'),
  supabaseAnonKeyInput: document.getElementById('supabaseAnonKeyInput'),
  toggleSupabaseKeyVisBtn: document.getElementById('toggleSupabaseKeyVisBtn'),
  testSupabaseBtn: document.getElementById('testSupabaseBtn'),
  supabaseTestFeedback: document.getElementById('supabaseTestFeedback'),

  modelSelect: document.getElementById('modelSelect'),
  streamingToggle: document.getElementById('streamingToggle'),
  tempSlider: document.getElementById('tempSlider'),
  tempValue: document.getElementById('tempValue'),
  customSystemPrompt: document.getElementById('customSystemPrompt'),
  keyTestFeedback: document.getElementById('keyTestFeedback'),

  // Toasts
  toastContainer: document.getElementById('toastContainer')
};

// Configure Marked.js options
if (window.marked) {
  marked.setOptions({
    breaks: true,
    gfm: true,
    highlight: function(code, lang) {
      if (window.hljs) {
        if (lang && hljs.getLanguage(lang)) {
          try {
            return hljs.highlight(code, { language: lang }).value;
          } catch (_) {}
        }
        return hljs.highlightAuto(code).value;
      }
      return code;
    }
  });
}

/**
 * Initialize Application
 */
async function initApp() {
  bindEventListeners();
  updateUiFromState();
  await checkBackendHealth();
  initSupabaseClient();
  await syncSupabaseConversations();
  initializeConversations();
  setupSpeechRecognition();
}

/**
 * Initialize Supabase Client
 */
function initSupabaseClient() {
  const url = state.supabaseUrl?.trim();
  const key = state.supabaseAnonKey?.trim();

  const isConfigured = Boolean(
    url &&
    key &&
    !url.includes('your-project') &&
    key !== 'your_supabase_anon_key_here' &&
    url.startsWith('http')
  );

  if (isConfigured && window.supabase) {
    try {
      state.supabaseClient = window.supabase.createClient(url, key);
      testSupabaseSilentCheck();
    } catch (err) {
      console.warn('Supabase client initialization error:', err);
      updateSupabaseStatus(false, 'Supabase Init Failed');
    }
  } else {
    state.supabaseClient = null;
    updateSupabaseStatus(false, 'Supabase: Offline (Local Storage)');
  }
}

/**
 * Silent connection check for Supabase
 */
async function testSupabaseSilentCheck() {
  if (!state.supabaseClient) return;

  try {
    const { data, error } = await state.supabaseClient.from('conversations').select('id').limit(1);
    if (!error) {
      state.supabaseConnected = true;
      updateSupabaseStatus(true, 'Supabase: Connected (Cloud Sync)');
    } else if (error.code === '42P01') {
      updateSupabaseStatus(false, 'Supabase: Connected (Tables Not Created)');
    } else {
      updateSupabaseStatus(false, `Supabase: Error (${error.message})`);
    }
  } catch (e) {
    updateSupabaseStatus(false, 'Supabase: Connection Failed');
  }
}

/**
 * Update Supabase status indicators
 */
function updateSupabaseStatus(connected, label) {
  if (DOM.supabaseGlow) {
    DOM.supabaseGlow.className = `supabase-dot ${connected ? 'online' : (label.includes('Connected') ? 'warning' : '')}`;
  }
  if (DOM.supabaseLabel) {
    DOM.supabaseLabel.textContent = label;
  }
  if (DOM.topbarSupabaseTag) {
    DOM.topbarSupabaseTag.textContent = connected ? '☁️ Supabase Synced' : '💾 Local Storage';
  }
}

/**
 * Sync conversations from Supabase
 */
async function syncSupabaseConversations() {
  if (!state.supabaseClient) return;

  try {
    const { data, error } = await state.supabaseClient
      .from('conversations')
      .select('id, title, created_at, messages(role, content, timestamp)')
      .order('created_at', { ascending: false });

    if (!error && Array.isArray(data) && data.length > 0) {
      // Merge remote conversations with local conversations
      const remoteChats = data.map(c => ({
        id: c.id,
        title: c.title,
        createdAt: c.created_at,
        messages: (c.messages || []).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
      }));

      // Combine with local chats (unique by ID)
      const mergedMap = new Map();
      remoteChats.forEach(c => mergedMap.set(c.id, c));
      state.conversations.forEach(c => {
        if (!mergedMap.has(c.id)) mergedMap.set(c.id, c);
      });

      state.conversations = Array.from(mergedMap.values());
      saveConversationsLocally();
      renderHistoryList();
    }
  } catch (err) {
    console.warn('Failed to sync conversations from Supabase:', err);
  }
}

/**
 * Save conversation to Supabase
 */
async function persistConversationToSupabase(chat) {
  if (!state.supabaseClient) return;
  try {
    await state.supabaseClient.from('conversations').upsert({
      id: chat.id,
      title: chat.title
    }, { onConflict: 'id' });
  } catch (err) {
    console.warn('Supabase upsert conversation error:', err);
  }
}

/**
 * Save message to Supabase
 */
async function persistMessageToSupabase(chatId, role, content) {
  if (!state.supabaseClient) return;
  try {
    await state.supabaseClient.from('messages').insert({
      conversation_id: chatId,
      role,
      content,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.warn('Supabase insert message error:', err);
  }
}

/**
 * Delete conversation from Supabase
 */
async function deleteConversationFromSupabase(chatId) {
  if (!state.supabaseClient) return;
  try {
    await state.supabaseClient.from('conversations').delete().eq('id', chatId);
  } catch (err) {
    console.warn('Supabase delete conversation error:', err);
  }
}

/**
 * Bind All UI Event Listeners
 */
function bindEventListeners() {
  // Mobile Sidebar Toggle
  DOM.mobileMenuBtn.addEventListener('click', toggleSidebar);
  DOM.closeSidebarBtn.addEventListener('click', toggleSidebar);
  DOM.sidebarBackdrop.addEventListener('click', toggleSidebar);

  // New Chat
  DOM.newChatBtn.addEventListener('click', () => startNewChat());

  // Persona Selection
  DOM.personaChips.addEventListener('click', (e) => {
    const chip = e.target.closest('.persona-chip');
    if (chip && chip.dataset.persona) {
      setPersona(chip.dataset.persona);
    }
  });

  // History Clear
  DOM.clearAllHistoryBtn.addEventListener('click', clearAllConversations);

  // Topbar Actions
  DOM.ttsToggleBtn.addEventListener('click', toggleVoiceReadAloud);
  DOM.exportChatBtn.addEventListener('click', exportConversationMarkdown);
  DOM.clearChatBtn.addEventListener('click', clearCurrentChatMessages);

  // Starter Prompt Cards
  DOM.welcomeHero.addEventListener('click', (e) => {
    const card = e.target.closest('.prompt-card');
    if (card && card.dataset.prompt) {
      DOM.chatTextarea.value = card.dataset.prompt;
      handleInputResize();
      sendMessage();
    }
  });

  // Input Textarea
  DOM.chatTextarea.addEventListener('input', handleInputResize);
  DOM.chatTextarea.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  // Global Key Shortcut: Ctrl+K or Cmd+K for new chat
  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      startNewChat();
    }
  });

  // Send Button
  DOM.sendBtn.addEventListener('click', sendMessage);

  // Settings Modal
  DOM.openSettingsBtn.addEventListener('click', openSettingsModal);
  DOM.closeSettingsBtn.addEventListener('click', closeSettingsModal);
  DOM.settingsModal.addEventListener('click', (e) => {
    if (e.target === DOM.settingsModal) closeSettingsModal();
  });
  DOM.saveSettingsBtn.addEventListener('click', saveSettings);
  DOM.testKeyBtn.addEventListener('click', testApiConnection);
  DOM.testSupabaseBtn.addEventListener('click', testSupabaseConnection);

  DOM.toggleApiKeyVisBtn.addEventListener('click', () => {
    DOM.apiKeyInput.type = DOM.apiKeyInput.type === 'password' ? 'text' : 'password';
  });

  DOM.toggleSupabaseKeyVisBtn.addEventListener('click', () => {
    DOM.supabaseAnonKeyInput.type = DOM.supabaseAnonKeyInput.type === 'password' ? 'text' : 'password';
  });

  DOM.tempSlider.addEventListener('input', (e) => {
    DOM.tempValue.textContent = e.target.value;
  });
}

/**
 * Check Backend Health & API Key Status
 */
async function checkBackendHealth() {
  try {
    const res = await fetch(`${state.backendUrl}/api/health`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    state.backendHasEnvKey = Boolean(data.apiKeyConfiguredInEnv);

    // If frontend hasn't set custom Supabase keys yet, fetch public config from backend
    if (!state.supabaseUrl || state.supabaseUrl.includes('your-project')) {
      const configRes = await fetch(`${state.backendUrl}/api/config`);
      if (configRes.ok) {
        const config = await configRes.json();
        if (config.supabaseUrl && !config.supabaseUrl.includes('your-project')) {
          state.supabaseUrl = config.supabaseUrl;
          state.supabaseAnonKey = config.supabaseAnonKey;
          initSupabaseClient();
        }
      }
    }

    updateStatusIndicator();
  } catch (err) {
    console.warn('Backend health check error:', err);
    DOM.statusGlow.className = 'indicator-glow error';
    DOM.statusLabel.textContent = 'Backend Offline';
    showToast('Backend server connection failed. Ensure backend/server.js is running.', 'error');
  }
}

/**
 * Update the Status Pill Widget
 */
function updateStatusIndicator() {
  const hasKey = state.backendHasEnvKey || Boolean(state.apiKey && state.apiKey.length > 10);
  if (hasKey) {
    DOM.statusGlow.className = 'indicator-glow configured';
    DOM.statusLabel.textContent = state.backendHasEnvKey ? 'Gemini: Configured (.env)' : 'Gemini: Custom Key';
  } else {
    DOM.statusGlow.className = 'indicator-glow';
    DOM.statusLabel.textContent = 'API Key Required';
  }
}

/**
 * Update Topbar and Modal UI from Current State
 */
function updateUiFromState() {
  DOM.currentModelBadge.textContent = state.model;
  DOM.topbarModelTag.textContent = state.model;
  DOM.topbarPersonaTag.textContent = PERSONAS[state.activePersona]?.name || 'Custom';
  DOM.topbarStreamTag.textContent = state.isStreaming ? '⚡ Live Stream' : '📦 JSON Mode';

  // Toggle voice active style
  if (state.voiceEnabled) {
    DOM.ttsToggleBtn.classList.add('active');
  } else {
    DOM.ttsToggleBtn.classList.remove('active');
  }

  // Active persona chip
  document.querySelectorAll('.persona-chip').forEach(chip => {
    chip.classList.toggle('active', chip.dataset.persona === state.activePersona);
  });
}

/**
 * Set Persona
 */
function setPersona(personaKey) {
  if (!PERSONAS[personaKey]) return;
  state.activePersona = personaKey;
  localStorage.setItem('gemini_persona', personaKey);
  updateUiFromState();
  showToast(`Switched persona to ${PERSONAS[personaKey].name}`, 'info');
}

/**
 * Handle Textarea Auto-Resize & Character Count
 */
function handleInputResize() {
  const textarea = DOM.chatTextarea;
  textarea.style.height = 'auto';
  textarea.style.height = Math.min(textarea.scrollHeight, 180) + 'px';

  const len = textarea.value.length;
  DOM.charCounter.textContent = `${len} / 10000`;
  DOM.sendBtn.disabled = len === 0 || state.isGenerating;
}

/**
 * Sidebar Navigation
 */
function toggleSidebar() {
  DOM.sidebar.classList.toggle('open');
  DOM.sidebarBackdrop.classList.toggle('active');
}

/**
 * Speech-to-Text Setup
 */
function setupSpeechRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    DOM.micBtn.title = 'Speech Recognition not supported in this browser';
    return;
  }

  const recognition = new SpeechRecognition();
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.lang = 'en-US';

  let isListening = false;

  DOM.micBtn.addEventListener('click', () => {
    if (isListening) {
      recognition.stop();
    } else {
      try {
        recognition.start();
        isListening = true;
        DOM.micBtn.classList.add('listening');
        showToast('Listening... Speak now', 'info');
      } catch (err) {
        console.error(err);
      }
    }
  });

  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    DOM.chatTextarea.value = (DOM.chatTextarea.value + ' ' + transcript).trim();
    handleInputResize();
  };

  recognition.onerror = () => {
    isListening = false;
    DOM.micBtn.classList.remove('listening');
  };

  recognition.onend = () => {
    isListening = false;
    DOM.micBtn.classList.remove('listening');
  };
}

/**
 * Text-to-Speech Read Aloud
 */
function speakText(text) {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();

  const cleanText = text
    .replace(/```[\s\S]*?```/g, 'Code block omitted.')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[#*_~]/g, '');

  const utterance = new SpeechSynthesisUtterance(cleanText);
  utterance.rate = 1.05;
  utterance.pitch = 1.0;
  window.speechSynthesis.speak(utterance);
}

function toggleVoiceReadAloud() {
  state.voiceEnabled = !state.voiceEnabled;
  localStorage.setItem('gemini_voice', state.voiceEnabled);
  if (!state.voiceEnabled) {
    window.speechSynthesis?.cancel();
    showToast('Voice read-aloud disabled', 'info');
  } else {
    showToast('Voice read-aloud enabled', 'success');
  }
  updateUiFromState();
}

/**
 * Conversations Management
 */
function initializeConversations() {
  if (state.conversations.length === 0) {
    startNewChat();
  } else {
    loadConversation(state.conversations[0].id);
  }
  renderHistoryList();
}

function startNewChat() {
  const newId = 'chat_' + Date.now();
  const newChat = {
    id: newId,
    title: 'New Conversation',
    createdAt: new Date().toISOString(),
    messages: []
  };

  state.conversations.unshift(newChat);
  saveConversationsLocally();
  persistConversationToSupabase(newChat);
  loadConversation(newId);
  renderHistoryList();

  if (window.innerWidth <= 768) {
    DOM.sidebar.classList.remove('open');
    DOM.sidebarBackdrop.classList.remove('active');
  }
}

function loadConversation(id) {
  const chat = state.conversations.find(c => c.id === id);
  if (!chat) return;

  state.currentChatId = id;
  DOM.sessionTitle.textContent = chat.title;
  renderMessages(chat.messages);
  renderHistoryList();
}

function getCurrentConversation() {
  return state.conversations.find(c => c.id === state.currentChatId);
}

function saveConversationsLocally() {
  localStorage.setItem('gemini_conversations', JSON.stringify(state.conversations));
}

function clearAllConversations() {
  if (!confirm('Are you sure you want to delete all conversation history?')) return;
  state.conversations.forEach(c => deleteConversationFromSupabase(c.id));
  state.conversations = [];
  saveConversationsLocally();
  startNewChat();
  showToast('All chat history cleared', 'info');
}

function clearCurrentChatMessages() {
  const chat = getCurrentConversation();
  if (!chat) return;
  chat.messages = [];
  chat.title = 'New Conversation';
  DOM.sessionTitle.textContent = chat.title;
  saveConversationsLocally();
  persistConversationToSupabase(chat);
  renderMessages([]);
  renderHistoryList();
  showToast('Chat messages cleared', 'info');
}

function deleteConversation(id, event) {
  event.stopPropagation();
  state.conversations = state.conversations.filter(c => c.id !== id);
  saveConversationsLocally();
  deleteConversationFromSupabase(id);

  if (state.currentChatId === id) {
    if (state.conversations.length > 0) {
      loadConversation(state.conversations[0].id);
    } else {
      startNewChat();
    }
  } else {
    renderHistoryList();
  }
  showToast('Chat deleted', 'info');
}

function renderHistoryList() {
  DOM.historyList.innerHTML = '';

  if (state.conversations.length === 0) {
    DOM.historyList.innerHTML = '<div class="history-empty-hint">No past conversations</div>';
    return;
  }

  state.conversations.forEach((chat) => {
    const item = document.createElement('div');
    item.className = `history-item ${chat.id === state.currentChatId ? 'active' : ''}`;
    item.innerHTML = `
      <div class="history-title-wrap">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
        <span class="history-title">${escapeHtml(chat.title)}</span>
      </div>
      <button class="delete-hist-btn" title="Delete chat" aria-label="Delete chat">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    `;

    item.addEventListener('click', () => loadConversation(chat.id));
    item.querySelector('.delete-hist-btn').addEventListener('click', (e) => deleteConversation(chat.id, e));

    DOM.historyList.appendChild(item);
  });
}

/**
 * Render Message List
 */
function renderMessages(messages) {
  DOM.messagesContainer.innerHTML = '';

  if (!messages || messages.length === 0) {
    DOM.welcomeHero.classList.remove('hidden');
    return;
  }

  DOM.welcomeHero.classList.add('hidden');

  messages.forEach(msg => {
    appendMessageToDom(msg.role, msg.content, msg.timestamp, false);
  });

  scrollToBottom();
}

/**
 * Append Message Bubble to DOM
 */
function appendMessageToDom(role, content, timestamp, shouldAnimate = true) {
  const isUser = role === 'user';
  const row = document.createElement('div');
  row.className = `msg-row ${isUser ? 'user-msg' : 'bot-msg'}`;
  if (!shouldAnimate) row.style.animation = 'none';

  const avatarSrc = isUser ? 'assets/user-avatar.jpg' : 'assets/bot-avatar.jpg';
  const senderName = isUser ? 'You' : `Gemini (${state.model})`;
  const timeStr = timestamp ? new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

  row.innerHTML = `
    <div class="msg-avatar">
      <img src="${avatarSrc}" alt="${senderName}">
    </div>
    <div class="msg-body">
      <div class="msg-header-meta">
        <span class="msg-sender-name">${senderName}</span>
        <span class="msg-time">${timeStr}</span>
      </div>
      <div class="msg-bubble">${isUser ? escapeHtml(content) : renderMarkdown(content)}</div>
      <div class="msg-actions">
        <button class="bubble-action-btn copy-msg-btn" title="Copy text">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
          <span>Copy</span>
        </button>
        ${!isUser ? `
          <button class="bubble-action-btn speak-msg-btn" title="Read aloud">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
            <span>Speak</span>
          </button>
        ` : ''}
      </div>
    </div>
  `;

  // Attach button actions
  row.querySelector('.copy-msg-btn').addEventListener('click', () => {
    navigator.clipboard.writeText(content);
    showToast('Copied to clipboard', 'success');
  });

  const speakBtn = row.querySelector('.speak-msg-btn');
  if (speakBtn) {
    speakBtn.addEventListener('click', () => speakText(content));
  }

  // Enhance code blocks inside bot response
  if (!isUser) {
    enhanceCodeBlocks(row.querySelector('.msg-bubble'));
  }

  DOM.messagesContainer.appendChild(row);
  return row;
}

/**
 * Enhance code blocks with custom header, language pill, and copy button
 */
function enhanceCodeBlocks(container) {
  const preElements = container.querySelectorAll('pre');
  preElements.forEach((pre) => {
    if (pre.parentElement.classList.contains('code-block-wrapper')) return;

    const code = pre.querySelector('code');
    const lang = code ? (code.className.match(/language-(\w+)/)?.[1] || 'code') : 'code';

    const wrapper = document.createElement('div');
    wrapper.className = 'code-block-wrapper';

    const header = document.createElement('div');
    header.className = 'code-header';
    header.innerHTML = `
      <span class="code-lang-label">${lang}</span>
      <button class="copy-code-btn" type="button">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
        <span>Copy Code</span>
      </button>
    `;

    header.querySelector('.copy-code-btn').addEventListener('click', () => {
      navigator.clipboard.writeText(code ? code.innerText : pre.innerText);
      showToast('Code copied to clipboard!', 'success');
    });

    pre.parentNode.insertBefore(wrapper, pre);
    wrapper.appendChild(header);
    wrapper.appendChild(pre);
  });
}

/**
 * Markdown Renderer Safe Fallback
 */
function renderMarkdown(text) {
  if (window.marked) {
    try {
      return marked.parse(text);
    } catch (e) {
      console.warn('Markdown parsing error:', e);
    }
  }
  return escapeHtml(text).replace(/\n/g, '<br>');
}

/**
 * Escape HTML
 */
function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Scroll to bottom of Chat Viewport
 */
function scrollToBottom() {
  DOM.chatViewport.scrollTop = DOM.chatViewport.scrollHeight;
}

/**
 * Send Message Handler
 */
async function sendMessage() {
  const text = DOM.chatTextarea.value.trim();
  if (!text || state.isGenerating) return;

  const hasKey = state.backendHasEnvKey || Boolean(state.apiKey && state.apiKey.length > 10);
  if (!hasKey) {
    showToast('Please set your Gemini API Key in Settings or backend/.env', 'error');
    openSettingsModal();
    return;
  }

  const currentChat = getCurrentConversation();
  if (!currentChat) return;

  // Add User Message
  const userMsg = {
    role: 'user',
    content: text,
    timestamp: new Date().toISOString()
  };
  currentChat.messages.push(userMsg);

  // Auto-generate chat title from first user prompt
  if (currentChat.messages.length === 1) {
    currentChat.title = text.length > 32 ? text.substring(0, 32) + '...' : text;
    DOM.sessionTitle.textContent = currentChat.title;
    renderHistoryList();
    persistConversationToSupabase(currentChat);
  }

  // Persist user message to Supabase
  persistMessageToSupabase(currentChat.id, 'user', text);

  // Clear input
  DOM.chatTextarea.value = '';
  handleInputResize();
  DOM.welcomeHero.classList.add('hidden');
  appendMessageToDom('user', userMsg.content, userMsg.timestamp);
  scrollToBottom();

  // Determine System Instruction
  let systemInstruction = state.customInstruction.trim();
  if (!systemInstruction) {
    systemInstruction = PERSONAS[state.activePersona]?.instruction || '';
  }

  const payload = {
    messages: currentChat.messages.map(m => ({ role: m.role, content: m.content })),
    model: state.model,
    systemInstruction,
    temperature: state.temperature,
    conversationId: currentChat.id
  };

  const headers = {
    'Content-Type': 'application/json'
  };
  if (state.apiKey) {
    headers['x-gemini-api-key'] = state.apiKey;
  }

  state.isGenerating = true;
  DOM.sendBtn.disabled = true;
  DOM.typingIndicator.classList.remove('hidden');
  scrollToBottom();

  if (state.isStreaming) {
    await handleStreamingChat(payload, headers, currentChat);
  } else {
    await handleStandardChat(payload, headers, currentChat);
  }

  state.isGenerating = false;
  DOM.sendBtn.disabled = DOM.chatTextarea.value.length === 0;
  DOM.typingIndicator.classList.add('hidden');
  saveConversationsLocally();
}

/**
 * Handle Streaming Chat via SSE
 */
async function handleStreamingChat(payload, headers, currentChat) {
  try {
    const response = await fetch(`${state.backendUrl}/api/chat/stream`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorJson = await response.json().catch(() => ({}));
      throw new Error(errorJson.message || `Server responded with ${response.status}`);
    }

    DOM.typingIndicator.classList.add('hidden');

    const botMsg = {
      role: 'assistant',
      content: '',
      timestamp: new Date().toISOString()
    };
    currentChat.messages.push(botMsg);

    const botRow = appendMessageToDom('assistant', '', botMsg.timestamp);
    const bubbleEl = botRow.querySelector('.msg-bubble');

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n\n');
      buffer = lines.pop() || '';

      for (const block of lines) {
        const trimmed = block.trim();
        if (trimmed.startsWith('data: ')) {
          try {
            const data = JSON.parse(trimmed.slice(6));
            if (data.type === 'chunk' && data.text) {
              botMsg.content += data.text;
              bubbleEl.innerHTML = renderMarkdown(botMsg.content);
              enhanceCodeBlocks(bubbleEl);
              scrollToBottom();
            } else if (data.type === 'error') {
              throw new Error(data.message);
            }
          } catch (parseErr) {
            console.warn('SSE Chunk parse error:', parseErr);
          }
        }
      }
    }

    bubbleEl.innerHTML = renderMarkdown(botMsg.content);
    enhanceCodeBlocks(bubbleEl);

    // Save completed assistant message to Supabase
    persistMessageToSupabase(currentChat.id, 'model', botMsg.content);

    if (state.voiceEnabled) {
      speakText(botMsg.content);
    }
  } catch (err) {
    console.error('Streaming request failed:', err);
    showToast(err.message, 'error');
    appendErrorToChat(err.message);
  }
}

/**
 * Handle Standard JSON Chat Request
 */
async function handleStandardChat(payload, headers, currentChat) {
  try {
    const response = await fetch(`${state.backendUrl}/api/chat`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || `HTTP ${response.status}`);
    }

    const botMsg = {
      role: 'assistant',
      content: data.reply || 'No response text received.',
      timestamp: data.timestamp || new Date().toISOString()
    };
    currentChat.messages.push(botMsg);

    DOM.typingIndicator.classList.add('hidden');
    appendMessageToDom('assistant', botMsg.content, botMsg.timestamp);
    scrollToBottom();

    persistMessageToSupabase(currentChat.id, 'model', botMsg.content);

    if (state.voiceEnabled) {
      speakText(botMsg.content);
    }
  } catch (err) {
    console.error('Chat request failed:', err);
    showToast(err.message, 'error');
    appendErrorToChat(err.message);
  }
}

/**
 * Append error message bubble to chat
 */
function appendErrorToChat(errorText) {
  const errBubble = {
    role: 'assistant',
    content: `⚠️ **Error communicating with Gemini:**\n\n> ${errorText}\n\n*Tip:* Check your API key in **Settings** or ensure \`backend/.env\` contains a valid \`GEMINI_API_KEY\`.`,
    timestamp: new Date().toISOString()
  };
  appendMessageToDom('assistant', errBubble.content, errBubble.timestamp);
  scrollToBottom();
}

/**
 * Export Current Conversation as Markdown
 */
function exportConversationMarkdown() {
  const currentChat = getCurrentConversation();
  if (!currentChat || currentChat.messages.length === 0) {
    showToast('No messages to export.', 'info');
    return;
  }

  let md = `# ${currentChat.title}\n\n`;
  md += `*Exported from Gemini AI Studio on ${new Date().toLocaleString()}*\n`;
  md += `*Model: ${state.model}*\n\n---\n\n`;

  currentChat.messages.forEach(msg => {
    const roleName = msg.role === 'user' ? '👤 User' : '🤖 Gemini';
    md += `### ${roleName} (${new Date(msg.timestamp).toLocaleTimeString()})\n\n`;
    md += `${msg.content}\n\n---\n\n`;
  });

  const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${currentChat.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.md`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Chat exported successfully!', 'success');
}

/**
 * Settings Modal Logic
 */
function openSettingsModal() {
  DOM.apiKeyInput.value = state.apiKey;
  DOM.supabaseUrlInput.value = state.supabaseUrl;
  DOM.supabaseAnonKeyInput.value = state.supabaseAnonKey;
  DOM.modelSelect.value = state.model;
  DOM.streamingToggle.checked = state.isStreaming;
  DOM.tempSlider.value = state.temperature;
  DOM.tempValue.textContent = state.temperature;
  DOM.customSystemPrompt.value = state.customInstruction;
  DOM.keyTestFeedback.className = 'key-test-feedback hidden';
  DOM.supabaseTestFeedback.className = 'key-test-feedback hidden';

  DOM.settingsModal.classList.remove('hidden');
}

function closeSettingsModal() {
  DOM.settingsModal.classList.add('hidden');
}

function saveSettings() {
  state.apiKey = DOM.apiKeyInput.value.trim();
  state.supabaseUrl = DOM.supabaseUrlInput.value.trim();
  state.supabaseAnonKey = DOM.supabaseAnonKeyInput.value.trim();
  state.model = DOM.modelSelect.value;
  state.isStreaming = DOM.streamingToggle.checked;
  state.temperature = parseFloat(DOM.tempSlider.value);
  state.customInstruction = DOM.customSystemPrompt.value.trim();

  localStorage.setItem('gemini_api_key', state.apiKey);
  localStorage.setItem('supabase_url', state.supabaseUrl);
  localStorage.setItem('supabase_anon_key', state.supabaseAnonKey);
  localStorage.setItem('gemini_model', state.model);
  localStorage.setItem('gemini_stream', state.isStreaming);
  localStorage.setItem('gemini_temp', state.temperature);
  localStorage.setItem('gemini_custom_prompt', state.customInstruction);

  initSupabaseClient();
  updateUiFromState();
  updateStatusIndicator();
  closeSettingsModal();
  showToast('Settings saved successfully!', 'success');
}

/**
 * Test Supabase Connection
 */
async function testSupabaseConnection() {
  const url = DOM.supabaseUrlInput.value.trim();
  const key = DOM.supabaseAnonKeyInput.value.trim();
  const feedback = DOM.supabaseTestFeedback;

  feedback.className = 'key-test-feedback';
  feedback.textContent = 'Testing connection with Supabase...';
  feedback.classList.remove('hidden');

  if (!url || !key || url.includes('your-project') || key.includes('your_supabase_anon_key')) {
    feedback.className = 'key-test-feedback error';
    feedback.textContent = '❌ Please enter a valid Supabase Project URL and Anon Key.';
    return;
  }

  try {
    const testClient = window.supabase.createClient(url, key);
    const { data, error } = await testClient.from('conversations').select('id').limit(1);

    if (error) {
      if (error.code === '42P01') {
        feedback.className = 'key-test-feedback success';
        feedback.textContent = '⚠️ Connected to Supabase, but "conversations" table does not exist yet. Run supabase_schema.sql in Supabase SQL editor.';
      } else {
        throw error;
      }
    } else {
      feedback.className = 'key-test-feedback success';
      feedback.textContent = '✅ Successfully connected to Supabase database!';
      updateSupabaseStatus(true, 'Supabase: Connected (Cloud Sync)');
    }
  } catch (err) {
    feedback.className = 'key-test-feedback error';
    feedback.textContent = `❌ Supabase connection failed: ${err.message}`;
  }
}

/**
 * Test Gemini API Connection
 */
async function testApiConnection() {
  const testKey = DOM.apiKeyInput.value.trim();
  const feedback = DOM.keyTestFeedback;

  feedback.className = 'key-test-feedback';
  feedback.textContent = 'Testing connection with Gemini...';
  feedback.classList.remove('hidden');

  const headers = { 'Content-Type': 'application/json' };
  if (testKey) {
    headers['x-gemini-api-key'] = testKey;
  }

  try {
    const res = await fetch(`${state.backendUrl}/api/chat`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'Respond with the word "CONNECTED" and nothing else.' }],
        model: DOM.modelSelect.value
      })
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || `Status ${res.status}`);
    }

    feedback.className = 'key-test-feedback success';
    feedback.textContent = `✅ Successfully connected to Gemini! Model: ${data.model}`;
  } catch (err) {
    feedback.className = 'key-test-feedback error';
    feedback.textContent = `❌ Connection failed: ${err.message}`;
  }
}

/**
 * Toast Notification System
 */
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;

  const iconMap = {
    info: '💡',
    success: '✅',
    error: '⚠️'
  };

  toast.innerHTML = `<span>${iconMap[type] || '💡'}</span> <span>${escapeHtml(message)}</span>`;
  DOM.toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// Start application when DOM is ready
document.addEventListener('DOMContentLoaded', initApp);
