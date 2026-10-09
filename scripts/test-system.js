#!/usr/bin/env node
/**
 * System Test Script
 * Tests all components of the Pharmacy Calling Agent
 */

require('dotenv').config();
const axios = require('axios');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[36m',
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

async function testEndpoint(name, method, url, data = null) {
  try {
    const config = {
      method,
      url: `${BASE_URL}${url}`,
      headers: { 'Content-Type': 'application/json' },
    };
    
    if (data) {
      config.data = data;
    }

    const response = await axios(config);
    log(`✅ ${name}: PASSED`, colors.green);
    return { success: true, data: response.data };
  } catch (error) {
    log(`❌ ${name}: FAILED - ${error.message}`, colors.red);
    return { success: false, error: error.message };
  }
}

async function runTests() {
  log('\n' + '='.repeat(60), colors.blue);
  log('🧪 Pharmacy Calling Agent - System Test', colors.blue);
  log('='.repeat(60) + '\n', colors.blue);

  let passedTests = 0;
  let failedTests = 0;

  // Test 1: Health Check
  log('Testing Health Check...', colors.yellow);
  const health = await testEndpoint('Health Check', 'GET', '/health');
  health.success ? passedTests++ : failedTests++;

  // Test 2: Create Customer
  log('\nTesting Customer Creation...', colors.yellow);
  const customerData = {
    name: 'Test User',
    phone: `+91999999${Math.floor(1000 + Math.random() * 9000)}`,
  };
  const customer = await testEndpoint(
    'Create Customer',
    'POST',
    '/api/customers',
    customerData
  );
  customer.success ? passedTests++ : failedTests++;

  let customerId = null;
  if (customer.success && customer.data.customer) {
    customerId = customer.data.customer.id;
    log(`   Customer ID: ${customerId}`, colors.green);
  }

  // Test 3: Get Customers
  log('\nTesting Get Customers...', colors.yellow);
  const getCustomers = await testEndpoint('Get Customers', 'GET', '/api/customers');
  getCustomers.success ? passedTests++ : failedTests++;

  // Test 4: Tamil TTS
  log('\nTesting Tamil TTS...', colors.yellow);
  const ttsData = {
    text: 'வணக்கம். என்ன மருந்து தேவை?',
    format: 'base64',
  };
  const tts = await testEndpoint('Tamil TTS', 'POST', '/api/tts/tamil', ttsData);
  tts.success ? passedTests++ : failedTests++;

  // Test 5: LLM Initialization
  log('\nTesting LLM Session...', colors.yellow);
  const llmInit = await testEndpoint('LLM Init', 'POST', '/api/llm/init', {
    callId: 'test-call-' + Date.now(),
    customerName: 'Test User',
  });
  llmInit.success ? passedTests++ : failedTests++;

  // Test 6: LLM Processing
  if (llmInit.success) {
    log('\nTesting LLM Processing...', colors.yellow);
    const llmProcess = await testEndpoint('LLM Process', 'POST', '/api/llm/process', {
      callId: 'test-call-' + Date.now(),
      transcript: 'பாராசிட்டமால் கிடைக்குமா?',
    });
    llmProcess.success ? passedTests++ : failedTests++;
  }

  // Test 7: LLM Stats
  log('\nTesting LLM Stats...', colors.yellow);
  const llmStats = await testEndpoint('LLM Stats', 'GET', '/api/llm/stats');
  llmStats.success ? passedTests++ : failedTests++;

  // Test 8: Queue Status
  log('\nTesting Queue Status...', colors.yellow);
  const queueStatus = await testEndpoint('Queue Status', 'GET', '/api/calls/queue/status');
  queueStatus.success ? passedTests++ : failedTests++;

  // Test 9: Active Calls
  log('\nTesting Active Calls...', colors.yellow);
  const activeCalls = await testEndpoint('Active Calls', 'GET', '/api/calls/active');
  activeCalls.success ? passedTests++ : failedTests++;

  // Test 10: Get Customer Details (if we created one)
  if (customerId) {
    log('\nTesting Get Customer Details...', colors.yellow);
    const customerDetails = await testEndpoint(
      'Get Customer Details',
      'GET',
      `/api/customers/${customerId}`
    );
    customerDetails.success ? passedTests++ : failedTests++;
  }

  // Test 11: TTS Voices
  log('\nTesting TTS Voices...', colors.yellow);
  const voices = await testEndpoint('Get TTS Voices', 'GET', '/api/tts/voices');
  voices.success ? passedTests++ : failedTests++;

  // Summary
  log('\n' + '='.repeat(60), colors.blue);
  log('📊 Test Results', colors.blue);
  log('='.repeat(60), colors.blue);
  log(`✅ Passed: ${passedTests}`, colors.green);
  log(`❌ Failed: ${failedTests}`, colors.red);
  log(`📈 Success Rate: ${((passedTests / (passedTests + failedTests)) * 100).toFixed(1)}%`, colors.blue);
  log('='.repeat(60) + '\n', colors.blue);

  // Environment Check
  log('🔍 Environment Check', colors.blue);
  log('='.repeat(60), colors.blue);
  
  const checks = [
    { name: 'DATABASE_URL', value: process.env.DATABASE_URL },
    { name: 'OPENAI_API_KEY', value: process.env.OPENAI_API_KEY ? '✓ Set' : '✗ Missing' },
    { name: 'GOOGLE_APPLICATION_CREDENTIALS', value: process.env.GOOGLE_APPLICATION_CREDENTIALS },
    { name: 'TWILIO_ACCOUNT_SID', value: process.env.TWILIO_ACCOUNT_SID ? '✓ Set' : '✗ Missing' },
    { name: 'EXOTEL_API_KEY', value: process.env.EXOTEL_API_KEY ? '✓ Set' : '✗ Missing' },
    { name: 'BASE_URL', value: process.env.BASE_URL },
    { name: 'ACTIVE_TELEPHONY_PROVIDER', value: process.env.ACTIVE_TELEPHONY_PROVIDER },
  ];

  checks.forEach(check => {
    const status = check.value ? colors.green : colors.red;
    log(`${check.name}: ${check.value || '✗ Not Set'}`, status);
  });

  log('='.repeat(60) + '\n', colors.blue);

  process.exit(failedTests > 0 ? 1 : 0);
}

// Run tests
runTests().catch(error => {
  log(`\n❌ Test suite failed: ${error.message}`, colors.red);
  process.exit(1);
});






