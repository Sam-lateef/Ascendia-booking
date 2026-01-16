import { NextResponse } from "next/server";

export async function GET() {
  // Debug endpoint to check environment variables
  // This shows all env vars without exposing sensitive values
  const envVars = {
    // Check if secrets are accessible
    OPENAI_API_KEY: process.env.OPENAI_API_KEY 
      ? `set (length: ${process.env.OPENAI_API_KEY.length}, starts with: ${process.env.OPENAI_API_KEY.substring(0, 10)}..., ends with: ...${process.env.OPENAI_API_KEY.substring(process.env.OPENAI_API_KEY.length - 10)})` 
      : 'missing',
    OPENDENTAL_API_KEY: process.env.OPENDENTAL_API_KEY 
      ? `set (length: ${process.env.OPENDENTAL_API_KEY.length}, starts with: ${process.env.OPENDENTAL_API_KEY.substring(0, 7)}...)` 
      : 'missing',
    OPENDENTAL_MOCK_MODE: process.env.OPENDENTAL_MOCK_MODE || 'not set',
    OPENDENTAL_API_BASE_URL: process.env.OPENDENTAL_API_BASE_URL || 'not set',
    NODE_ENV: process.env.NODE_ENV || 'not set',
    PORT: process.env.PORT || 'not set',
    HOSTNAME: process.env.HOSTNAME || 'not set',
  };

  // Also check all process.env keys (non-sensitive)
  const allEnvKeys = Object.keys(process.env)
    .filter(key => !key.includes('KEY') && !key.includes('SECRET') && !key.includes('PASSWORD'))
    .sort();

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    env: envVars,
    allEnvKeys: allEnvKeys.slice(0, 50), // First 50 keys
    totalEnvKeys: Object.keys(process.env).length,
  });
}

