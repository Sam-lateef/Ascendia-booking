/**
 * Quick script to inspect dynamically created workflow
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectWorkflow() {
  const { data, error } = await supabase
    .from('dynamic_workflows')
    .select('*')
    .eq('workflow_name', 'reschedule')
    .order('created_at', { ascending: false })
    .limit(1);

  if (error) {
    console.error('Error:', error);
    return;
  }

  if (!data || data.length === 0) {
    console.log('No reschedule workflow found');
    return;
  }

  const workflow = data[0];
  console.log('\n=== WORKFLOW INFO ===');
  console.log('ID:', workflow.id);
  console.log('Name:', workflow.workflow_name);
  console.log('Intent Triggers:', workflow.intent_triggers);
  console.log('Created:', workflow.created_at);
  
  console.log('\n=== WORKFLOW DEFINITION ===');
  console.log(JSON.stringify(workflow.definition, null, 2));
  
  console.log('\n=== STEP INPUT MAPPINGS ===');
  workflow.definition.steps.forEach((step: any, i: number) => {
    console.log(`\nStep ${i + 1}: ${step.function}`);
    console.log('  Input Mapping:', step.inputMapping);
  });

  console.log('\n=== REQUIRED USER INPUTS ===');
  workflow.definition.requiredUserInputs.forEach((input: any) => {
    console.log(`- ${input.field}: "${input.prompt}"`);
  });
}

inspectWorkflow().then(() => process.exit(0));


















