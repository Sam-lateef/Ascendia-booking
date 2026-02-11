/**
 * Check Vapi Assistant Configuration
 * 
 * Shows exactly what's configured on a Vapi assistant
 */

require('dotenv').config();

const VAPI_API_KEY = process.env.VAPI_API_KEY;
const VAPI_API_URL = 'https://api.vapi.ai';

if (!VAPI_API_KEY) {
  console.error('❌ VAPI_API_KEY not set in .env');
  process.exit(1);
}

const assistantId = process.argv[2];

if (!assistantId) {
  console.error('❌ Usage: node check-vapi-assistant.js <assistant-id>');
  process.exit(1);
}

async function main() {
  try {
    console.log('\n🔍 Fetching Vapi Assistant Configuration');
    console.log('='.repeat(60));
    console.log(`Assistant ID: ${assistantId}\n`);

    const response = await fetch(`${VAPI_API_URL}/assistant/${assistantId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${VAPI_API_KEY}`
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to fetch (${response.status}): ${errorText}`);
    }

    const assistant = await response.json();

    // Display summary
    console.log('📋 ASSISTANT SUMMARY');
    console.log('='.repeat(60));
    console.log(`Name: ${assistant.name}`);
    console.log(`Voice: ${assistant.voice?.provider} - ${assistant.voice?.voiceId || 'default'}`);
    console.log(`Model: ${assistant.model?.provider} ${assistant.model?.model}`);
    console.log(`First Message: ${assistant.firstMessage || 'None'}`);

    // Display tools
    console.log('\n🛠️  TOOLS');
    console.log('='.repeat(60));
    
    const tools = assistant.model?.tools || [];
    
    if (tools.length === 0) {
      console.log('❌ NO TOOLS CONFIGURED!');
    } else {
      console.log(`Total: ${tools.length}\n`);
      
      tools.forEach((tool, i) => {
        console.log(`${i + 1}. ${tool.function?.name || tool.type}`);
        console.log(`   Type: ${tool.type}`);
        console.log(`   Async: ${tool.async}`);
        
        if (tool.server?.url) {
          console.log(`   Server: ${tool.server.url}`);
        }
        
        if (tool.function?.parameters?.properties) {
          const params = Object.keys(tool.function.parameters.properties);
          console.log(`   Parameters: ${params.join(', ')}`);
        }
        
        console.log('');
      });
    }

    // Display system prompt (first 500 chars)
    console.log('\n💬 SYSTEM PROMPT');
    console.log('='.repeat(60));
    const systemMsg = assistant.model?.messages?.find(m => m.role === 'system');
    if (systemMsg) {
      const preview = systemMsg.content.substring(0, 500);
      console.log(preview + (systemMsg.content.length > 500 ? '...' : ''));
      console.log(`\nTotal length: ${systemMsg.content.length} characters`);
    } else {
      console.log('❌ No system prompt configured');
    }

    // Full JSON output
    console.log('\n📄 FULL JSON (for debugging)');
    console.log('='.repeat(60));
    console.log(JSON.stringify(assistant, null, 2));

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

main();
