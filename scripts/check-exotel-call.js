#!/usr/bin/env node
/**
 * Diagnostic script to check Exotel call status and errors
 */

require('dotenv').config();
const axios = require('axios');

const EXOTEL_API_KEY = process.env.EXOTEL_API_KEY;
const EXOTEL_API_TOKEN = process.env.EXOTEL_API_TOKEN;
const EXOTEL_SID = process.env.EXOTEL_SID;
const EXOTEL_PHONE_NUMBER = process.env.EXOTEL_PHONE_NUMBER;

const EXOTEL_API_URL = `https://${EXOTEL_API_KEY}:${EXOTEL_API_TOKEN}@api.exotel.com/v1/Accounts/${EXOTEL_SID}`;

async function checkExotelStatus() {
  console.log('🔍 Checking Exotel Configuration...\n');
  
  console.log('📋 Configuration:');
  console.log(`   SID: ${EXOTEL_SID}`);
  console.log(`   Phone: ${EXOTEL_PHONE_NUMBER}`);
  console.log(`   API Key: ${EXOTEL_API_KEY ? '✅ Set' : '❌ Missing'}`);
  console.log(`   API Token: ${EXOTEL_API_TOKEN ? '✅ Set' : '❌ Missing'}\n`);

  // Check recent calls
  try {
    console.log('📞 Fetching recent calls from Exotel...\n');
    const response = await axios.get(
      `${EXOTEL_API_URL}/Calls.json`,
      {
        auth: {
          username: EXOTEL_API_KEY,
          password: EXOTEL_API_TOKEN
        },
        params: {
          limit: 5
        }
      }
    );

    const calls = response.data.Calls || [];
    
    if (calls.length === 0) {
      console.log('⚠️  No recent calls found\n');
    } else {
      console.log(`✅ Found ${calls.length} recent call(s):\n`);
      
      calls.forEach((call, index) => {
        console.log(`Call ${index + 1}:`);
        console.log(`   SID: ${call.Sid}`);
        console.log(`   From: ${call.From}`);
        console.log(`   To: ${call.To}`);
        console.log(`   Status: ${call.Status}`);
        console.log(`   Direction: ${call.Direction}`);
        console.log(`   Start Time: ${call.StartTime || 'N/A'}`);
        console.log(`   End Time: ${call.EndTime || 'N/A'}`);
        
        if (call.Status === 'failed' || call.Status === 'busy' || call.Status === 'no-answer') {
          console.log(`   ⚠️  Call ${call.Status}`);
        }
        console.log('');
      });
    }

    // Check account status
    console.log('📊 Checking account status...\n');
    try {
      const accountResponse = await axios.get(
        `${EXOTEL_API_URL}.json`,
        {
          auth: {
            username: EXOTEL_API_KEY,
            password: EXOTEL_API_TOKEN
          }
        }
      );
      
      const account = accountResponse.data.Account || {};
      console.log(`   Account Name: ${account.Name || 'N/A'}`);
      console.log(`   Status: ${account.Status || 'N/A'}`);
      console.log('');
    } catch (error) {
      console.log('   ⚠️  Could not fetch account details\n');
    }

  } catch (error) {
    console.error('❌ Error checking Exotel status:\n');
    
    if (error.response) {
      console.error(`   Status: ${error.response.status}`);
      console.error(`   Response:`, JSON.stringify(error.response.data, null, 2));
      
      if (error.response.status === 403) {
        console.error('\n⚠️  KYC ISSUE DETECTED!');
        console.error('   Your Exotel account needs KYC verification.');
        console.error('   Go to: https://my.exotel.com');
        console.error('   Complete KYC to enable outbound calls.\n');
      } else if (error.response.status === 401) {
        console.error('\n⚠️  AUTHENTICATION ERROR!');
        console.error('   Check your EXOTEL_API_KEY and EXOTEL_API_TOKEN in .env\n');
      }
    } else {
      console.error(`   Error: ${error.message}\n`);
    }
  }

  // Test call creation (dry run)
  console.log('🧪 Testing call creation (dry run)...\n');
  console.log('   This will show what error (if any) Exotel returns\n');
  
  const testPhone = '+919876543210';
  const testParams = new URLSearchParams({
    From: EXOTEL_PHONE_NUMBER,
    To: testPhone,
    CallerId: EXOTEL_PHONE_NUMBER,
    Url: 'https://example.com/test', // Dummy URL
  });

  try {
    const testResponse = await axios.post(
      `${EXOTEL_API_URL}/Calls/connect.json`,
      testParams,
      {
        auth: {
          username: EXOTEL_API_KEY,
          password: EXOTEL_API_TOKEN
        },
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );
    
    console.log('✅ Call creation test successful!');
    console.log(`   Call SID: ${testResponse.data.Call?.Sid}`);
    console.log(`   Status: ${testResponse.data.Call?.Status}\n`);
    console.log('⚠️  Note: A test call was created. Check your Exotel dashboard.\n');
    
  } catch (error) {
    console.error('❌ Call creation test FAILED:\n');
    
    if (error.response) {
      console.error(`   Status: ${error.response.status}`);
      console.error(`   Response:`, JSON.stringify(error.response.data, null, 2));
      
      if (error.response.status === 403) {
        console.error('\n🔴 KYC VERIFICATION REQUIRED!');
        console.error('   Your account is not KYC compliant.');
        console.error('   Exotel blocks outbound calls until KYC is completed.');
        console.error('\n   Steps to fix:');
        console.error('   1. Go to: https://my.exotel.com');
        console.error('   2. Navigate to Settings → KYC Verification');
        console.error('   3. Upload required documents');
        console.error('   4. Wait for approval (1-2 business days)\n');
      } else if (error.response.data?.RestException) {
        const restError = error.response.data.RestException;
        console.error(`\n   Error Code: ${restError.Code}`);
        console.error(`   Error Message: ${restError.Message}\n`);
      }
    } else {
      console.error(`   Error: ${error.message}\n`);
    }
  }
}

checkExotelStatus().catch(console.error);

