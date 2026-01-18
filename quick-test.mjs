/**
 * Quick test to verify SDK is working in the running app
 */

import 'dotenv/config';

console.log('🔍 Environment Check:');
console.log('USE_SDK_CLIENT:', process.env.USE_SDK_CLIENT);
console.log('ANTHROPIC_API_KEY:', process.env.ANTHROPIC_API_KEY ? '✅ Set' : '❌ Not set');

const useSDK = process.env.USE_SDK_CLIENT === 'true';
console.log('\n📊 Migration Status:', useSDK ? '✅ SDK Enabled' : '⚠️ Legacy Client');

if (!useSDK) {
  console.log('\n❌ SDK not enabled. Check your .env file.');
  process.exit(1);
}

console.log('\n✅ Configuration looks good!');
console.log('The dev server should now be using the SDK client.');
console.log('\nNext: Make an API call through your app to test cost tracking.');
