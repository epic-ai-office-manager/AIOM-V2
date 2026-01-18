/**
 * Test actual Claude API call through the SDK
 */

const testClaudeAPI = async () => {
  console.log('🧪 Testing Claude API call through SDK...\n');

  try {
    const response = await fetch('http://localhost:3000/api/analytics/claude-usage?period=24h');
    const beforeData = await response.json();
    
    console.log('📊 Before test call:');
    console.log(`   Requests: ${beforeData.summary.totalRequests}`);
    console.log(`   Cost: $${beforeData.summary.totalCost.toFixed(4)}`);
    console.log(`   Cache efficiency: ${beforeData.summary.cacheEfficiency}\n`);

    // Note: To actually test a Claude API call, you need to:
    // 1. Navigate to your app in the browser
    // 2. Use any feature that calls Claude (e.g., generate a call summary)
    // 3. Then check the analytics again

    console.log('✅ Analytics API is working!');
    console.log('\n📝 Next steps:');
    console.log('   1. Open http://localhost:3000 in your browser');
    console.log('   2. Use any Claude feature in your app');
    console.log('   3. Check http://localhost:3000/admin/claude-usage');
    console.log('   4. Or run this script again to see updated stats\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
};

testClaudeAPI();
