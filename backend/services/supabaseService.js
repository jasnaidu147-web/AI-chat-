const { createClient } = require('@supabase/supabase-js');

let supabaseClient = null;

/**
 * Check if valid Supabase configuration is present in environment
 */
function isConfigured() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

  return Boolean(
    url &&
    key &&
    !url.includes('your-project') &&
    key !== 'your_supabase_anon_key_here' &&
    key !== 'your_supabase_service_role_key_here' &&
    url.startsWith('http')
  );
}

/**
 * Get or initialize Supabase client
 */
function getClient() {
  if (supabaseClient) return supabaseClient;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

  if (!isConfigured()) {
    return null;
  }

  try {
    supabaseClient = createClient(url, key, {
      auth: { persistSession: false }
    });
    return supabaseClient;
  } catch (err) {
    console.error('Failed to initialize Supabase client:', err.message);
    return null;
  }
}

/**
 * Check connection to Supabase
 */
async function checkConnection() {
  if (!isConfigured()) {
    return {
      connected: false,
      message: 'Supabase credentials not configured in backend/.env'
    };
  }

  const client = getClient();
  if (!client) {
    return { connected: false, message: 'Could not create Supabase client' };
  }

  try {
    // Attempt a light query to test connection
    const { data, error } = await client.from('conversations').select('id').limit(1);

    if (error) {
      // Check if table missing
      if (error.code === '42P01') {
        return {
          connected: true,
          tablesCreated: false,
          message: 'Connected to Supabase, but "conversations" table is not created yet. Run supabase_schema.sql in the Supabase SQL editor.'
        };
      }
      return { connected: false, message: error.message };
    }

    return {
      connected: true,
      tablesCreated: true,
      message: 'Successfully connected to Supabase database.'
    };
  } catch (err) {
    return { connected: false, message: err.message };
  }
}

/**
 * Fetch all conversations from Supabase
 */
async function getConversations() {
  const client = getClient();
  if (!client) return null;

  const { data, error } = await client
    .from('conversations')
    .select('*, messages(*)')
    .order('updated_at', { ascending: false });

  if (error) {
    console.warn('Supabase getConversations error:', error.message);
    return null;
  }

  return data;
}

/**
 * Upsert a conversation
 */
async function saveConversation(id, title) {
  const client = getClient();
  if (!client) return null;

  const { data, error } = await client
    .from('conversations')
    .upsert({ id, title }, { onConflict: 'id' })
    .select();

  if (error) {
    console.warn('Supabase saveConversation error:', error.message);
    return null;
  }

  return data;
}

/**
 * Save a single message to a conversation
 */
async function saveMessage(conversationId, role, content, timestamp) {
  const client = getClient();
  if (!client) return null;

  const { data, error } = await client
    .from('messages')
    .insert({
      conversation_id: conversationId,
      role,
      content,
      timestamp: timestamp || new Date().toISOString()
    })
    .select();

  if (error) {
    console.warn('Supabase saveMessage error:', error.message);
    return null;
  }

  return data;
}

/**
 * Delete a conversation
 */
async function deleteConversation(id) {
  const client = getClient();
  if (!client) return null;

  const { error } = await client
    .from('conversations')
    .delete()
    .eq('id', id);

  if (error) {
    console.warn('Supabase deleteConversation error:', error.message);
    return false;
  }

  return true;
}

module.exports = {
  isConfigured,
  getClient,
  checkConnection,
  getConversations,
  saveConversation,
  saveMessage,
  deleteConversation
};
