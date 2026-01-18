/**
 * Local Test Script for Claude SDK Migration
 * 
 * Run this to verify the migration is working correctly
 */

import { getClaudeClient } from './src/lib/claude/migration-wrapper';
import { isUsingSDKClient, getMigrationStatus } from './src/lib/claude/migration-wrapper';
import { getClaudeSDKClient } from './src/lib/claude/sdk-client';

async function testMigration() {
  console.log('🧪 Testing Claude SDK Migration...\n');

  // Step 1: Check migration status
  console.log('1️⃣ Checking migration status...');
  const status = getMigrationStatus();
  console.log(`   Status: ${status.usingSDK ? '✅ Using SDK Client' : '⚠️ Using Legacy Client'}`);
  console.log(`   Flag: USE_SDK_CLIENT=${status.envVar || 'not set'}\n`);

  if (!status.usingSDK) {
    console.log('❌ SDK client not enabled!');
    console.log('   To enable: Set USE_SDK_CLIENT=true in your .env file\n');
    return;
  }

  // Step 2: Test client initialization
  console.log('2️⃣ Testing client initialization...');
  try {
    const client = getClaudeClient();
    console.log('   ✅ Client initialized successfully\n');
  } catch (error) {
    console.error('   ❌ Failed to initialize client:', error);
    return;
  }

  // Step 3: Test simple completion
  console.log('3️⃣ Testing simple API call...');
  try {
    const client = getClaudeClient();
    const response = await client.createMessage({
      messages: [
        {
          role: 'user',
          content: 'Say "Hello from SDK!" in exactly 3 words.',
        },
      ],
      maxTokens: 50,
    });

    const textContent = response.content.find((block) => block.type === 'text');
    if (textContent && textContent.type === 'text') {
      console.log(`   ✅ Response: "${textContent.text}"`);
      console.log(`   📊 Tokens: ${response.usage.input_tokens} input, ${response.usage.output_tokens} output\n`);
    }
  } catch (error) {
    console.error('   ❌ API call failed:', error);
    if (error instanceof Error) {
      console.error('   Error details:', error.message);
    }
    return;
  }

  // Step 4: Check usage tracking
  console.log('4️⃣ Checking usage tracking...');
  try {
    const sdkClient = getClaudeSDKClient();
    const stats = sdkClient.getUsageStats();
    
    console.log(`   ✅ Usage tracked successfully`);
    console.log(`   📊 Total requests: ${stats.totalRequests}`);
    console.log(`   💰 Total cost: $${stats.totalCost.toFixed(4)}`);
    console.log(`   📈 Cache efficiency: ${stats.cacheEfficiency.toFixed(1)}%`);
    console.log(`   🎯 Total tokens: ${stats.totalTokens}\n`);
  } catch (error) {
    console.error('   ❌ Failed to get usage stats:', error);
    return;
  }

  // Step 5: Test with system prompt (for cache testing)
  console.log('5️⃣ Testing with system prompt (cache test)...');
  try {
    const client = getClaudeClient();
    const response = await client.createMessage({
      messages: [
        {
          role: 'user',
          content: 'What is 2+2?',
        },
      ],
      system: [
        {
          type: 'text',
          text: 'You are a helpful math assistant.',
          cache_control: { type: 'ephemeral' },
        },
      ],
      maxTokens: 50,
    });

    console.log('   ✅ System prompt test successful');
    console.log(`   📊 Cache creation tokens: ${response.usage.cache_creation_input_tokens || 0}`);
    console.log(`   📊 Cache read tokens: ${response.usage.cache_read_input_tokens || 0}\n`);
  } catch (error) {
    console.error('   ⚠️ System prompt test failed (non-critical):', error instanceof Error ? error.message : error);
    console.log('');
  }

  // Step 6: Final stats
  console.log('6️⃣ Final usage statistics...');
  try {
    const sdkClient = getClaudeSDKClient();
    const stats = sdkClient.getUsageStats();
    
    console.log(`   📊 Total requests: ${stats.totalRequests}`);
    console.log(`   💰 Total cost: $${stats.totalCost.toFixed(4)}`);
    console.log(`   📈 Cache efficiency: ${stats.cacheEfficiency.toFixed(1)}%`);
    
    if (Object.keys(stats.byUseCase).length > 0) {
      console.log('\n   📋 By use case:');
      for (const [useCase, data] of Object.entries(stats.byUseCase)) {
        console.log(`      • ${useCase}: ${data.requests} requests, $${data.cost.toFixed(4)}`);
      }
    }
    console.log('');
  } catch (error) {
    console.error('   ❌ Failed to get final stats:', error);
  }

  console.log('✅ Migration test complete!\n');
  console.log('📊 Next steps:');
  console.log('   1. View dashboard: http://localhost:3000/admin/claude-usage');
  console.log('   2. Check API: curl http://localhost:3000/api/analytics/claude-usage?period=24h');
  console.log('   3. Export data: curl http://localhost:3000/api/analytics/claude-usage-export?period=24h&format=csv\n');
}

// Run the test
testMigration().catch((error) => {
  console.error('💥 Test failed with error:', error);
  process.exit(1);
});
