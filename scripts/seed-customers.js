#!/usr/bin/env node
/**
 * Seed Database with Sample Customers
 */

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const sampleCustomers = [
  { name: 'Raj Kumar', phone: '+919876543210' },
  { name: 'Priya Sharma', phone: '+919876543211' },
  { name: 'Arun Patel', phone: '+919876543212' },
  { name: 'Lakshmi Reddy', phone: '+919876543213' },
  { name: 'Vijay Krishnan', phone: '+919876543214' },
  { name: 'Meera Iyer', phone: '+919876543215' },
  { name: 'Karthik Nair', phone: '+919876543216' },
  { name: 'Divya Menon', phone: '+919876543217' },
  { name: 'Sanjay Gupta', phone: '+919876543218' },
  { name: 'Anjali Singh', phone: '+919876543219' },
];

async function seedCustomers() {
  console.log('🌱 Seeding customers...\n');

  let created = 0;
  let skipped = 0;

  for (const customerData of sampleCustomers) {
    try {
      const customer = await prisma.customer.create({
        data: {
          name: customerData.name,
          phone: customerData.phone,
          status: 'pending',
        },
      });

      console.log(`✅ Created: ${customer.name} (${customer.phone})`);
      created++;
    } catch (error) {
      if (error.code === 'P2002') {
        console.log(`⏭️  Skipped: ${customerData.name} (already exists)`);
        skipped++;
      } else {
        console.error(`❌ Error creating ${customerData.name}:`, error.message);
      }
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log(`📊 Summary:`);
  console.log(`   Created: ${created}`);
  console.log(`   Skipped: ${skipped}`);
  console.log(`   Total: ${created + skipped}`);
  console.log('='.repeat(50) + '\n');

  await prisma.$disconnect();
}

seedCustomers().catch((error) => {
  console.error('❌ Seeding failed:', error);
  process.exit(1);
});






