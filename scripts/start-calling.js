#!/usr/bin/env node
/**
 * Quick Start Script - Begin Calling All Pending Customers
 */

require('dotenv').config();
const axios = require('axios');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

async function startCalling() {
  console.log('📞 Starting outbound calling campaign...\n');

  try {
    // Check if server is running
    const health = await axios.get(`${BASE_URL}/health`);
    console.log('✅ Server is healthy\n');

    // Get pending customers count
    const customers = await axios.get(`${BASE_URL}/api/customers?status=pending`);
    const count = customers.data.count;

    console.log(`📋 Found ${count} pending customers\n`);

    if (count === 0) {
      console.log('⚠️  No pending customers to call.');
      console.log('   Run: node scripts/seed-customers.js to add sample customers\n');
      process.exit(0);
    }

    // Confirm
    console.log('⚠️  This will initiate calls to all pending customers.');
    console.log(`   Provider: ${process.env.ACTIVE_TELEPHONY_PROVIDER || 'Not set'}`);
    console.log(`   Delay between calls: ${process.env.CALL_DELAY_MS || 5000}ms\n`);

    // Queue all pending customers
    const response = await axios.post(`${BASE_URL}/api/calls/queue-all`, {
      status: 'pending',
    });

    console.log('✅ Calling campaign started!\n');
    console.log(`📊 Queued: ${response.data.count} customers`);
    console.log(`📊 Queue Status:`, response.data.queueStatus);
    console.log('\nMonitor progress at:');
    console.log(`   Queue Status: ${BASE_URL}/api/calls/queue/status`);
    console.log(`   Active Calls: ${BASE_URL}/api/calls/active`);
    console.log(`   LLM Stats: ${BASE_URL}/api/llm/stats\n`);

    // Monitor queue
    console.log('🔄 Monitoring queue (press Ctrl+C to stop)...\n');
    
    const monitorInterval = setInterval(async () => {
      try {
        const status = await axios.get(`${BASE_URL}/api/calls/queue/status`);
        const queueData = status.data;
        
        console.log(`[${new Date().toLocaleTimeString()}] Queue: ${queueData.queueLength} | Active: ${queueData.activeCalls} | Processing: ${queueData.isProcessing}`);
        
        if (queueData.queueLength === 0 && queueData.activeCalls === 0 && !queueData.isProcessing) {
          console.log('\n✅ All calls completed!\n');
          clearInterval(monitorInterval);
          process.exit(0);
        }
      } catch (error) {
        console.error('Error monitoring queue:', error.message);
      }
    }, 5000);

  } catch (error) {
    console.error('❌ Error:', error.message);
    
    if (error.code === 'ECONNREFUSED') {
      console.error('\n⚠️  Server is not running. Start it with: npm start\n');
    }
    
    process.exit(1);
  }
}

startCalling();







