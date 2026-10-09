#!/usr/bin/env node
/**
 * Quick Script - Make a single call to any phone number
 */

require('dotenv').config();
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const PHONE_NUMBER = process.argv[2];

if (!PHONE_NUMBER) {
  console.error('❌ Error: Phone number required');
  console.log('\nUsage:');
  console.log('  node scripts/make-call.js <phone-number>');
  console.log('\nExample:');
  console.log('  node scripts/make-call.js 9876543210');
  console.log('  node scripts/make-call.js +919876543210');
  process.exit(1);
}

async function makeCall() {
  console.log('📞 Making outbound call...\n');
  console.log(`   To: ${PHONE_NUMBER}`);
  console.log(`   Provider: ${process.env.ACTIVE_TELEPHONY_PROVIDER || 'Not set'}`);
  console.log(`   Server: ${BASE_URL}\n`);

  try {
    // Check if server is running
    const health = await axios.get(`${BASE_URL}/health`);
    console.log('✅ Server is healthy\n');

    // Format phone number (add +91 if it's a 10-digit Indian number)
    let formattedPhone = PHONE_NUMBER;
    if (PHONE_NUMBER.length === 10 && !PHONE_NUMBER.startsWith('+')) {
      formattedPhone = `+91${PHONE_NUMBER}`;
      console.log(`📱 Formatted phone number: ${formattedPhone}\n`);
    }

    // Try to find existing customer first
    let customerId;
    let customerName;
    
    console.log('📋 Checking for existing customer...');
    try {
      const customersResponse = await axios.get(`${BASE_URL}/api/customers?limit=1000`);
      const existingCustomer = customersResponse.data.customers.find(
        c => c.phone === formattedPhone || c.phone === PHONE_NUMBER
      );
      
      if (existingCustomer) {
        customerId = existingCustomer.id;
        customerName = existingCustomer.name;
        console.log(`✅ Found existing customer: ${customerName} (${customerId})\n`);
      }
    } catch (error) {
      console.log('⚠️  Could not check for existing customer, will create new one\n');
    }

    // Create customer if not found
    if (!customerId) {
      const tempName = `Temp-${Date.now()}`;
      console.log('📋 Creating new customer...');
      try {
        const customerResponse = await axios.post(`${BASE_URL}/api/customers`, {
          name: tempName,
          phone: formattedPhone,
          status: 'pending',
        });
        customerId = customerResponse.data.customer.id;
        customerName = customerResponse.data.customer.name;
        console.log(`✅ Created customer: ${customerName} (${customerId})\n`);
      } catch (error) {
        if (error.response?.status === 409) {
          // Customer exists but we couldn't find it, try to get it
          console.log('⚠️  Customer exists, fetching...');
          const customersResponse = await axios.get(`${BASE_URL}/api/customers?limit=1000`);
          const existingCustomer = customersResponse.data.customers.find(
            c => c.phone === formattedPhone || c.phone === PHONE_NUMBER
          );
          if (existingCustomer) {
            customerId = existingCustomer.id;
            customerName = existingCustomer.name;
            console.log(`✅ Using existing customer: ${customerName} (${customerId})\n`);
          } else {
            throw new Error('Customer exists but could not be retrieved');
          }
        } else {
          throw error;
        }
      }
    }

    // Make the call
    console.log('📞 Initiating call...\n');
    const callResponse = await axios.post(`${BASE_URL}/api/calls/initiate`, {
      customerId: customerId,
      phone: formattedPhone,
      name: customerName,
    });

    if (callResponse.data.success) {
      console.log('✅ Call initiated successfully!\n');
      console.log(`   Call ID: ${callResponse.data.callId}`);
      console.log(`   Call SID: ${callResponse.data.callSid}`);
      console.log(`   Status: ${callResponse.data.status}\n`);
      console.log('📊 Monitor call at:');
      console.log(`   Active Calls: ${BASE_URL}/api/calls/active`);
      console.log(`   Call Details: ${BASE_URL}/api/calls/${callResponse.data.callId}\n`);
    } else {
      console.error('❌ Call failed:', callResponse.data.error);
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    
    if (error.response) {
      console.error('   Response:', error.response.data);
    }
    
    if (error.code === 'ECONNREFUSED') {
      console.error('\n⚠️  Server is not running. Start it with: npm start\n');
    }
    
    process.exit(1);
  }
}

makeCall();


