/**
 * Create Test User Script
 * 
 * Creates a test user account for local development and testing.
 * Run with: npx tsx scripts/create-test-user.ts
 */

import { database } from '../src/db';
import { user } from '../src/db/schema';
import { eq } from 'drizzle-orm';
import * as crypto from 'crypto';
import { nanoid } from 'nanoid';

const TEST_USER = {
  email: 'test@aiom.local',
  password: 'Test123!@#',
  name: 'Test User',
};

async function hashPassword(password: string): Promise<string> {
  // Simple hash for testing - Better Auth will handle proper hashing in production
  return crypto.createHash('sha256').update(password).digest('hex');
}

async function createTestUser() {
  try {
    console.log('🔍 Checking for existing test user...');
    
    // Check if user already exists
    const existingUser = await database
      .select()
      .from(user)
      .where(eq(user.email, TEST_USER.email))
      .limit(1);

    if (existingUser.length > 0) {
      console.log('✅ Test user already exists!');
      console.log('\n📧 Email:', TEST_USER.email);
      console.log('🔑 Password:', TEST_USER.password);
      console.log('\n💡 You can sign in at: http://localhost:3001/sign-in');
      return;
    }

    console.log('👤 Creating test user...');

    // Create user with Better Auth compatible structure
    const [newUser] = await database
      .insert(user)
      .values({
        id: nanoid(),
        email: TEST_USER.email,
        emailVerified: true, // Auto-verify for testing
        name: TEST_USER.name,
        image: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    console.log('✅ Test user created successfully!');
    console.log('\n📋 User Details:');
    console.log('   ID:', newUser.id);
    console.log('   Email:', TEST_USER.email);
    console.log('   Name:', TEST_USER.name);
    console.log('\n🔑 Credentials:');
    console.log('   Email:', TEST_USER.email);
    console.log('   Password:', TEST_USER.password);
    console.log('\n💡 Next Steps:');
    console.log('   1. Go to: http://localhost:3001/sign-in');
    console.log('   2. Sign in with the credentials above');
    console.log('   3. Start testing the application!');
    console.log('\n⚠️  Note: You need to set a password via Better Auth.');
    console.log('   Alternative: Use the sign-up flow to create a user with password.');

  } catch (error) {
    console.error('❌ Error creating test user:', error);
    throw error;
  } finally {
    process.exit(0);
  }
}

createTestUser();
