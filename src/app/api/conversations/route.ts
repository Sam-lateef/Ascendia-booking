/**
 * Conversations API - Get call/conversation history for admin view
 * 
 * Queries from Supabase for persistent storage, with in-memory fallback
 */

import { NextRequest, NextResponse } from 'next/server';
import { 
  getConversationsFromSupabase, 
  getAllConversationsFromSupabase,
  getConversationsByDateExported,
  getAllConversationsExported
} from '@/app/lib/conversationState';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const date = searchParams.get('date');
    const source = searchParams.get('source'); // 'memory' to force in-memory only
    
    let conversations;
    
    if (source === 'memory') {
      // Force in-memory only (for debugging)
      conversations = date 
        ? getConversationsByDateExported(date)
        : getAllConversationsExported();
    } else {
      // Query from Supabase (includes in-memory fallback)
      conversations = date 
        ? await getConversationsFromSupabase(date)
        : await getAllConversationsFromSupabase();
    }
    
    console.log(`[Conversations API] Returning ${conversations.length} conversations for date=${date || 'all'}`);
    
    return NextResponse.json(conversations);
  } catch (error: any) {
    console.error('[Conversations API] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

