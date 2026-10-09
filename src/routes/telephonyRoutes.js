const express = require('express');
const router = express.Router();
const multer = require('multer');
const { callController } = require('../telephony/callController');

// Configure multer for multipart/form-data (Exotel uses this)
const upload = multer();

/**
 * Telephony Provider Webhook Routes
 * Handles callbacks from Twilio and Exotel
 */

/**
 * POST /api/telephony/twilio/status
 * Twilio status callback
 */
router.post('/twilio/status', (req, res) => {
  try {
    console.log('[TelephonyRoutes] Twilio status callback:', req.body);

    if (callController.telephony.handleStatusUpdate) {
      callController.telephony.handleStatusUpdate(req.body);
    }

    res.status(200).send('OK');
  } catch (error) {
    console.error('[TelephonyRoutes] Error handling Twilio status:', error);
    res.status(500).send('Error');
  }
});

/**
 * GET /api/telephony/twilio/twiml/:callId
 * Serve TwiML for Twilio call
 */
router.get('/twilio/twiml/:callId', (req, res) => {
  try {
    const { callId } = req.params;
    
    const twiml = callController.telephony.generateInitialTwiML(callId);
    
    res.type('text/xml');
    res.send(twiml);
  } catch (error) {
    console.error('[TelephonyRoutes] Error generating TwiML:', error);
    res.status(500).send('Error');
  }
});

/**
 * POST /api/telephony/exotel/status
 * Exotel status callback
 * Exotel sends data as multipart/form-data
 */
router.post('/exotel/status', upload.none(), (req, res) => {
  try {
    // Exotel sends multipart/form-data - multer parses it into req.body
    console.log('[TelephonyRoutes] Exotel status callback - Body:', req.body);
    console.log('[TelephonyRoutes] Exotel status callback - Query:', req.query);
    console.log('[TelephonyRoutes] Exotel status callback - Raw body keys:', Object.keys(req.body));
    
    // Get data from body (now properly parsed by multer)
    const statusData = req.body;
    
    // Exotel field names - normalize them
    const normalizedData = {
      CallSid: statusData.CallSid || statusData.Sid || statusData.call_sid || statusData.CallSid,
      Status: statusData.Status || statusData.status || statusData.CallStatus || statusData.Status,
      To: statusData.To || statusData.to || statusData.To,
      From: statusData.From || statusData.from || statusData.From,
      CustomField: statusData.CustomField || statusData.custom_field || statusData.CallId || statusData.CustomField,
      Direction: statusData.Direction || statusData.direction || statusData.Direction,
      Duration: statusData.Duration || statusData.duration || statusData.Duration,
    };
    
    console.log('[TelephonyRoutes] Normalized status data:', normalizedData);
    console.log('[TelephonyRoutes] Full status data:', JSON.stringify(statusData, null, 2));

    if (callController.telephony.handleStatusUpdate) {
      callController.telephony.handleStatusUpdate(normalizedData);
    }

    res.status(200).send('OK');
  } catch (error) {
    console.error('[TelephonyRoutes] Error handling Exotel status:', error);
    res.status(500).send('Error');
  }
});

/**
 * GET /api/telephony/exotel/twiml (with query parameter)
 * Serve TwiML for Exotel call when using query parameter format
 * URL format: /api/telephony/exotel/twiml?CustomField={{CustomField}}
 */
router.get('/exotel/twiml', (req, res) => {
  try {
    // Get callId from query parameter
    let callId = req.query.CustomField || req.query.CallSid || req.query.callId;
    
    console.log(`[TelephonyRoutes] Exotel requesting TwiML (GET with query) for callId: ${callId}`);
    console.log(`[TelephonyRoutes] Request query:`, req.query);
    console.log(`[TelephonyRoutes] Request headers:`, JSON.stringify(req.headers, null, 2));
    
    // Check if variable wasn't substituted ({{CustomField}} or $CustomField)
    const isVariableNotSubstituted = !callId || 
      callId.includes('{{') || 
      callId.includes('$CustomField') || 
      callId === 'CustomField' ||
      callId.startsWith('$');
    
    if (isVariableNotSubstituted) {
      console.warn(`[TelephonyRoutes] Variable not substituted: ${callId}`);
      
      // Try to get CallSid from query params or headers
      const callSid = req.query.CallSid || 
                     req.query.CallSid || 
                     req.headers['x-exotel-callsid'] || 
                     req.headers['call-sid'] ||
                     req.headers['x-call-sid'];
      
      console.log(`[TelephonyRoutes] Attempting to find callId from CallSid: ${callSid}`);
      
      if (callSid && callController.telephony && callController.telephony.getActiveCalls) {
        // Try to find callId from active calls using CallSid
        const activeCalls = callController.telephony.getActiveCalls();
        console.log(`[TelephonyRoutes] Active calls:`, activeCalls.length);
        const matchingCall = activeCalls.find(call => call.callSid === callSid);
        if (matchingCall) {
          callId = matchingCall.callId;
          console.log(`[TelephonyRoutes] ✅ Found callId ${callId} from CallSid ${callSid}`);
        } else {
          // If no match, try to use the most recent active call (fallback)
          if (activeCalls.length > 0) {
            const mostRecent = activeCalls[activeCalls.length - 1];
            callId = mostRecent.callId;
            console.log(`[TelephonyRoutes] ⚠️ Using most recent active call: ${callId}`);
          }
        }
      }
      
      // If still no callId, use fallback TwiML (will still work for basic greeting)
      if (!callId || isVariableNotSubstituted) {
        console.log(`[TelephonyRoutes] Using fallback TwiML (no valid callId)`);
        // Use simple Say without Gather - Exotel may not support speech input in Gather
        const fallbackTwiML = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="woman" language="ta-IN">வணக்கம். என் பேர் சரண்யா, ஸ்ரீ பார்மசியில் இருந்து பேசுறேன். என்ன மருந்து தேவை?</Say>
  <Pause length="2"/>
  <Say voice="woman" language="ta-IN">தயவு செய்து பதில் சொல்லுங்க.</Say>
</Response>`;
        res.type('text/xml');
        return res.send(fallbackTwiML);
      }
    }
    
    const twiml = callController.telephony.generateInitialTwiML(callId);
    
    console.log(`[TelephonyRoutes] Generated TwiML:`, twiml);
    
    res.type('text/xml');
    res.send(twiml);
    
    console.log(`[TelephonyRoutes] TwiML sent successfully to Exotel`);
  } catch (error) {
    console.error('[TelephonyRoutes] Error generating TwiML:', error);
    res.status(500).send('Error');
  }
});

/**
 * GET /api/telephony/exotel/twiml/:callId
 * Serve TwiML for Exotel call (GET request with path parameter)
 */
router.get('/exotel/twiml/:callId', (req, res) => {
  try {
    // Try to get callId from path parameter, query parameter, or CustomField
    let callId = req.params.callId;
    
    // If callId is {{CustomField}} or empty, try query params
    if (!callId || callId === '{{CustomField}}' || callId.includes('{{')) {
      callId = req.query.CustomField || req.query.CallSid || req.query.callId || callId;
    }
    
    console.log(`[TelephonyRoutes] Exotel requesting TwiML (GET) for callId: ${callId}`);
    console.log(`[TelephonyRoutes] Request params:`, req.params);
    console.log(`[TelephonyRoutes] Request query:`, req.query);
    console.log(`[TelephonyRoutes] Request headers:`, JSON.stringify(req.headers, null, 2));
    console.log(`[TelephonyRoutes] Request IP: ${req.ip || req.connection.remoteAddress}`);
    
    if (!callId || callId.includes('{{')) {
      console.error(`[TelephonyRoutes] Invalid callId: ${callId} - Exotel variable not substituted`);
      // Return a basic TwiML even if callId is missing
      const fallbackTwiML = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="woman">Hello, this is a test call from your pharmacy. Please respond.</Say>
</Response>`;
      res.type('text/xml');
      return res.send(fallbackTwiML);
    }
    
    const twiml = callController.telephony.generateInitialTwiML(callId);
    
    console.log(`[TelephonyRoutes] Generated TwiML:`, twiml);
    
    res.type('text/xml');
    res.send(twiml);
    
    console.log(`[TelephonyRoutes] TwiML sent successfully to Exotel`);
  } catch (error) {
    console.error('[TelephonyRoutes] Error generating TwiML:', error);
    res.status(500).send('Error');
  }
});

/**
 * POST /api/telephony/exotel/twiml/:callId
 * Serve TwiML for Exotel call (POST request - for Passthru applet)
 * Exotel Passthru can POST data, and we return TwiML in response
 */
router.post('/exotel/twiml/:callId', upload.none(), (req, res) => {
  try {
    const { callId } = req.params;
    
    console.log(`[TelephonyRoutes] Exotel Passthru requesting TwiML (POST) for callId: ${callId}`);
    console.log(`[TelephonyRoutes] Passthru body:`, req.body);
    console.log(`[TelephonyRoutes] Passthru query:`, req.query);
    
    const twiml = callController.telephony.generateInitialTwiML(callId);
    
    console.log(`[TelephonyRoutes] Generated TwiML for Passthru:`, twiml);
    
    res.type('text/xml');
    res.send(twiml);
    
    console.log(`[TelephonyRoutes] TwiML sent successfully to Exotel Passthru`);
  } catch (error) {
    console.error('[TelephonyRoutes] Error generating TwiML for Passthru:', error);
    res.status(500).send('Error');
  }
});

/**
 * POST /api/telephony/exotel/webhook
 * Exotel webhook endpoint - called when call connects
 * This is an alternative to TwiML URL - Exotel calls this and we return TwiML
 */
router.post('/exotel/webhook', upload.none(), (req, res) => {
  try {
    console.log(`[TelephonyRoutes] Exotel webhook called`);
    console.log(`[TelephonyRoutes] Webhook body:`, req.body);
    console.log(`[TelephonyRoutes] Webhook query:`, req.query);
    
    // Extract callId from CustomField or other parameters
    const callId = req.body.CustomField || req.query.CustomField || req.body.CallSid || req.query.CallSid;
    
    if (!callId) {
      console.error(`[TelephonyRoutes] No callId found in webhook`);
      // Return empty TwiML if no callId
      res.type('text/xml');
      return res.send(`<?xml version="1.0" encoding="UTF-8"?><Response><Say>Error connecting call.</Say></Response>`);
    }
    
    console.log(`[TelephonyRoutes] Exotel webhook requesting TwiML for callId: ${callId}`);
    
    const twiml = callController.telephony.generateInitialTwiML(callId);
    
    console.log(`[TelephonyRoutes] Generated TwiML for webhook:`, twiml);
    
    res.type('text/xml');
    res.send(twiml);
    
    console.log(`[TelephonyRoutes] TwiML sent successfully to Exotel via webhook`);
  } catch (error) {
    console.error('[TelephonyRoutes] Error handling Exotel webhook:', error);
    res.type('text/xml');
    res.status(500).send(`<?xml version="1.0" encoding="UTF-8"?><Response><Say>Error processing call.</Say></Response>`);
  }
});

/**
 * POST /api/telephony/exotel/stream/:callId
 * Exotel audio stream endpoint
 */
router.post('/exotel/stream/:callId', (req, res) => {
  try {
    const { callId } = req.params;
    
    // Handle Exotel audio streaming
    console.log(`[TelephonyRoutes] Exotel stream for call ${callId}`);
    
    // This is a placeholder - actual implementation depends on Exotel's streaming API
    res.status(200).send('OK');
  } catch (error) {
    console.error('[TelephonyRoutes] Error handling Exotel stream:', error);
    res.status(500).send('Error');
  }
});

module.exports = router;






