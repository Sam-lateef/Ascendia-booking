import { NextRequest, NextResponse } from 'next/server';
import { getCurrentOrganization } from '@/app/lib/apiHelpers';
import OpenAI from 'openai';

export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const context = await getCurrentOrganization(request);
    if (!['owner', 'admin'].includes(context.role)) {
      return NextResponse.json(
        { success: false, error: 'Permission denied' },
        { status: 403 }
      );
    }
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: 'Authentication required' },
      { status: 401 }
    );
  }
  
  // Initialize OpenAI at runtime, not at module load time
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
  try {
    const { targetLanguage, context, sourceMessages } = await request.json();

    if (!targetLanguage || !sourceMessages) {
      return NextResponse.json(
        { success: false, error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    // Get language name
    const languageNames: Record<string, string> = {
      ar: 'Arabic',
      tr: 'Turkish',
      es: 'Spanish',
      fr: 'French',
      de: 'German',
      it: 'Italian',
      pt: 'Portuguese',
      ru: 'Russian',
      zh: 'Chinese',
      ja: 'Japanese',
      ko: 'Korean',
      hi: 'Hindi',
      bn: 'Bengali',
      pa: 'Punjabi',
      ur: 'Urdu',
      vi: 'Vietnamese',
      th: 'Thai',
      id: 'Indonesian',
      ms: 'Malay',
      fil: 'Filipino',
      nl: 'Dutch',
      pl: 'Polish',
      uk: 'Ukrainian',
      cs: 'Czech',
      ro: 'Romanian',
      el: 'Greek',
      he: 'Hebrew',
      sv: 'Swedish',
      no: 'Norwegian',
      da: 'Danish',
      fi: 'Finnish',
      hu: 'Hungarian',
      sk: 'Slovak',
      bg: 'Bulgarian',
      hr: 'Croatian',
      sr: 'Serbian',
      sl: 'Slovenian',
      lt: 'Lithuanian',
      lv: 'Latvian',
      et: 'Estonian',
      fa: 'Persian',
      sw: 'Swahili',
      am: 'Amharic',
    };

    const languageName = languageNames[targetLanguage] || targetLanguage;

    // Build context description
    const contextDescription = context
      ? `
Business Context:
- Type: ${context.businessType || 'General'}
- Description: ${context.description || ''}
- Tone: ${context.tone || 'professional'}
- Custom Mappings: ${JSON.stringify(context.customMappings || {})}
- Additional Guidelines: ${context.additionalGuidelines?.join(', ') || 'None'}
`
      : 'No specific business context provided.';

    // Create system prompt
    const systemPrompt = `You are a professional translator specializing in UI/UX localization.
You will translate admin dashboard labels from English to ${languageName}.

${contextDescription}

CRITICAL INSTRUCTIONS:
1. Maintain a ${context?.tone || 'professional'} tone
2. Consider the business context when translating terms
3. Keep placeholders like {count}, {date}, {name} EXACTLY as they appear
4. Preserve any HTML tags or special formatting
5. Be consistent with terminology throughout
6. Return ONLY valid JSON in the EXACT same structure as the input
7. Do not add explanations, comments, or any text outside the JSON

Example of custom mappings to consider:
${context?.customMappings ? JSON.stringify(context.customMappings, null, 2) : 'None'}

Your response must be valid JSON that can be parsed directly.`;

    const userPrompt = `Translate the following English UI labels to ${languageName}:\n\n${JSON.stringify(
      sourceMessages,
      null,
      2
    )}`;

    console.log('[AI Translate] Starting translation to', languageName);

    // Call OpenAI API with gpt-4o-mini
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_TRANSLATION_MODEL || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3, // Lower temperature for more consistent translations
      response_format: { type: 'json_object' },
    });

    const translatedText = completion.choices[0]?.message?.content;

    if (!translatedText) {
      throw new Error('No translation received from OpenAI');
    }

    // Parse the translated JSON
    let translatedMessages;
    try {
      translatedMessages = JSON.parse(translatedText);
    } catch (parseError) {
      console.error('[AI Translate] Failed to parse OpenAI response:', translatedText);
      throw new Error('Invalid JSON response from translation service');
    }

    console.log('[AI Translate] Successfully translated to', languageName);

    return NextResponse.json({
      success: true,
      translatedMessages,
    });
  } catch (error: any) {
    console.error('[AI Translate] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to translate',
      },
      { status: 500 }
    );
  }
}




