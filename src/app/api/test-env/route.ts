import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ? '✅ SET' : '❌ NOT SET',
    SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_KEY ? `✅ SET (${process.env.SUPABASE_SERVICE_KEY.length} chars)` : '❌ NOT SET',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? '✅ SET' : '❌ NOT SET',
    
    // Show what IS set (for debugging)
    allEnvVars: Object.keys(process.env)
      .filter(k => k.includes('SUPABASE'))
      .reduce((acc, k) => {
        acc[k] = process.env[k] ? '✅ SET' : '❌ NOT SET';
        return acc;
      }, {} as Record<string, string>)
  });
}

































