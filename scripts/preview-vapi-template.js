/**
 * Preview Vapi Master Template Configuration
 * 
 * Shows exactly what configuration will be cloned for all new orgs
 */

require('dotenv').config();

const VAPI_API_KEY = process.env.VAPI_API_KEY;
const ASSISTANT_ID = process.env.VAPI_MASTER_TEMPLATE_ASSISTANT_ID;

if (!VAPI_API_KEY) {
  console.error('❌ VAPI_API_KEY not set in .env');
  process.exit(1);
}

if (!ASSISTANT_ID) {
  console.error('❌ VAPI_MASTER_TEMPLATE_ASSISTANT_ID not set in .env');
  process.exit(1);
}

async function previewTemplate() {
  console.log('🔍 Fetching master template config from Vapi API...');
  console.log('   Assistant ID:', ASSISTANT_ID);
  console.log('');

  try {
    const response = await fetch(`https://api.vapi.ai/assistant/${ASSISTANT_ID}`, {
      headers: { 'Authorization': `Bearer ${VAPI_API_KEY}` }
    });

    if (!response.ok) {
      console.error('❌ Vapi API error:', response.status, response.statusText);
      process.exit(1);
    }

    const config = await response.json();

    console.log('✅ Successfully fetched Riley\'s configuration!');
    console.log('');
    console.log('═══════════════════════════════════════════════════════');
    console.log('📋 MASTER TEMPLATE CONFIGURATION (Riley)');
    console.log('═══════════════════════════════════════════════════════');
    console.log('');
    
    console.log('📝 BASIC INFO:');
    console.log('   Name:', config.name);
    console.log('   Created:', config.createdAt);
    console.log('');
    
    console.log('🤖 MODEL SETTINGS:');
    console.log('   Provider:', config.model?.provider);
    console.log('   Model:', config.model?.model);
    console.log('   Temperature:', config.model?.temperature);
    console.log('   Max Tokens:', config.model?.maxTokens);
    console.log('   Functions:', config.model?.functions?.length || 0);
    console.log('');
    
    console.log('🎤 VOICE SETTINGS:');
    console.log('   Provider:', config.voice?.provider);
    console.log('   Voice ID:', config.voice?.voiceId);
    console.log('   Model:', config.voice?.model);
    console.log('   Speed:', config.voice?.speed);
    console.log('   Stability:', config.voice?.stability);
    console.log('');
    
    console.log('🎙️ TRANSCRIBER SETTINGS:');
    console.log('   Provider:', config.transcriber?.provider);
    console.log('   Model:', config.transcriber?.model);
    console.log('   Language:', config.transcriber?.language);
    console.log('');
    
    console.log('💬 MESSAGE SETTINGS:');
    console.log('   First Message Mode:', config.firstMessageMode);
    console.log('   First Message:', config.firstMessage?.substring(0, 80) + '...');
    console.log('');
    
    console.log('⚙️ ADVANCED SETTINGS:');
    console.log('   Background Sound:', config.backgroundSound);
    console.log('   Background Denoising:', config.backgroundDenoisingEnabled);
    console.log('   End Call Phrases:', config.endCallPhrases?.length || 0);
    console.log('   Silence Timeout:', config.silenceTimeoutSeconds);
    console.log('   Max Duration:', config.maxDurationSeconds);
    console.log('');
    
    console.log('📡 SERVER SETTINGS:');
    console.log('   Server URL:', config.serverUrl);
    console.log('   Has Secret:', !!config.serverUrlSecret);
    console.log('');
    
    console.log('═══════════════════════════════════════════════════════');
    console.log('📦 ALL CONFIGURATION KEYS (Everything being cloned):');
    console.log('═══════════════════════════════════════════════════════');
    console.log(Object.keys(config).sort().join(', '));
    console.log('');
    console.log('✅ When you setup a new phone number, ALL of these settings');
    console.log('   will be cloned and applied to the new assistant!');
    console.log('');
    console.log('🎯 Only these will be customized per org:');
    console.log('   - name (user enters)');
    console.log('   - firstMessage (updated with org name)');
    console.log('   - model.messages (updated with org name)');
    console.log('   - voice.provider (if user changes it)');
    console.log('   - serverUrl (always your webhook)');
    console.log('   - functions (always your latest)');
    console.log('');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

previewTemplate();
