/**
 * Migration: gán ownerId cho toàn bộ link chưa có owner.
 *
 * Chạy MỘT LẦN sau khi deploy code multi-user lần đầu:
 *   npx tsx scripts/migrate-add-owner.ts
 *
 * Yêu cầu biến môi trường trong .env.local:
 *   MONGODB_URI      — connection string MongoDB
 *   ADMIN_EMAIL      — email tài khoản admin sẽ nhận link cũ
 *   ADMIN_PASSWORD   — mật khẩu tài khoản admin (≥ 8 ký tự)
 *
 * Idempotent: chạy lại không nhân đôi user, không ghi đè link đã có owner.
 */

import { MongoClient, ObjectId } from 'mongodb';
import { hash } from 'bcryptjs';
import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env.local từ root project
config({ path: resolve(process.cwd(), '.env.local') });

const MONGODB_URI = process.env.MONGODB_URI;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

if (!MONGODB_URI) {
  console.error('❌  MONGODB_URI is not set in .env.local');
  process.exit(1);
}

if (!ADMIN_EMAIL) {
  console.error('❌  ADMIN_EMAIL is not set in .env.local');
  process.exit(1);
}

if (!ADMIN_PASSWORD || ADMIN_PASSWORD.length < 8) {
  console.error('❌  ADMIN_PASSWORD is not set or is shorter than 8 characters');
  process.exit(1);
}

async function migrate() {
  const client = new MongoClient(MONGODB_URI!);

  try {
    await client.connect();
    console.log('✓  Connected to MongoDB');

    const db = client.db('linkhub');
    const users = db.collection('users');
    const links = db.collection('links');

    // Ensure unique index on email (idempotent)
    await users.createIndex({ email: 1 }, { unique: true });

    const email = ADMIN_EMAIL!.toLowerCase().trim();

    // Upsert admin user — insert only if not exists
    let adminId: string;
    const existing = await users.findOne({ email });

    if (existing) {
      adminId = existing._id.toString();
      console.log(`✓  Admin user already exists: ${email} (id: ${adminId})`);
    } else {
      const passwordHash = await hash(ADMIN_PASSWORD!, 10);
      const now = new Date().toISOString();
      const result = await users.insertOne({
        email,
        name: 'Admin',
        passwordHash,
        createdAt: now,
        updatedAt: now,
      });
      adminId = result.insertedId.toString();
      console.log(`✓  Admin user created: ${email} (id: ${adminId})`);
    }

    // Migrate links that have no ownerId
    const updateResult = await links.updateMany(
      { ownerId: { $exists: false } },
      { $set: { ownerId: adminId } }
    );

    if (updateResult.modifiedCount === 0) {
      console.log('✓  No links to migrate (all links already have an owner)');
    } else {
      console.log(`✓  Migrated ${updateResult.modifiedCount} link(s) → ownerId: ${adminId}`);
    }

    // Summary
    const totalLinks = await links.countDocuments();
    const orphanLinks = await links.countDocuments({ ownerId: { $exists: false } });
    console.log(`\nSummary:`);
    console.log(`  Total links : ${totalLinks}`);
    console.log(`  Orphan links: ${orphanLinks} (should be 0)`);
    console.log(`  Admin email : ${email}`);

    if (orphanLinks > 0) {
      console.error('\n⚠️  There are still orphan links — migration may have failed partially.');
      process.exit(1);
    }

    console.log('\n✅  Migration complete.');
  } finally {
    await client.close();
  }
}

migrate().catch((err) => {
  console.error('❌  Migration failed:', err);
  process.exit(1);
});
