# Exotel Setup Guide - Make Your AI Agent Work

## Problem
You're receiving calls but not hearing the AI agent 
## Why?
Exotel's `connect.json` API is designed for connecting **two people**, not for automated AI agents. It doesn't fetch the TwiML URL we provide.

## Solution
Create an **Exotel Flow/App** that will execute your TwiML/ExoML when the customer answers.

---

## Step-by-Step Setup

### 1. Log into Exotel Dashboard
Go to: https://my.exotel.com/

### 2. Navigate to Flows/App Bazaar
- Look for **"App Bazaar"** or **"Flows"** in the left sidebar
- Click to open the Flow/App management page

### 3. Create a New Flow
Click **"Create New Flow"** or **"Create App"**

#### Flow Configuration:
- **Name**: `Pharmacy Bot Agent` (or any name you prefer)
- **Description**: `AI-powered pharmacy assistant`

### 4. Add a Passthru Applet
1. In the Flow Builder, add a **"Passthru"** or **"Connect"** applet
2. Configure the Passthru settings:

   **Passthru URL**: 
   ```
   https://your-subdomain.ngrok-free.app/api/telephony/exotel/twiml/{{CustomField}}
   ```
   
   **Important**: 
   - Use your current ngrok URL (check `.env` file for `BASE_URL`)
   - The `{{CustomField}}` is a variable that Exotel will replace with the `callId`
   - This allows each call to get its own unique TwiML

3. **Method**: `GET`
4. **Content Type**: `application/xml` or `text/xml`

### 5. Save the Flow
- Click **Save** or **Publish**
- Exotel will assign an **App ID** or **Flow ID** (looks like a number, e.g., `123456`)
- **Copy this ID** - you'll need it next!

### 6. Update Your `.env` File
Add the Flow ID to your `.env`:

```bash
# Exotel Flow/App ID for AI Agent
EXOTEL_FLOW_ID=123456
```

Replace `123456` with your actual Flow ID.

### 7. Restart Your Server
```bash
pkill -f "node server.js"
npm start
```

### 8. Test the Call
```bash
node scripts/make-call.js 9876543210
```

---

## What Happens Now?

1. **Your code** calls Exotel API with `AppId` parameter
2. **Exotel** dials the customer's number (9876543210)
3. **Customer answers** 4. **Exotel** executes your Flow
5. **Flow's Passthru** requests TwiML from your server:
   - `GET https://your-ngrok-url/api/telephony/exotel/twiml/{callId}`
6. **Your server** returns TwiML (voice greeting + instructions)
7. **Exotel** plays the Tamil voice message to the customer 8. **Customer** interacts with the AI agent

---

## Troubleshooting

### Issue: "I don't see App Bazaar or Flows"
- **Solution**: Your Exotel account might be on a different plan. Contact Exotel support to enable Flows/Apps.

### Issue: "Flow created but calls still silent"
- Check that the `EXOTEL_FLOW_ID` in `.env` matches the Flow ID from Exotel
- Verify the Passthru URL in the Flow uses `{{CustomField}}` correctly
- Check server logs for TwiML requests: `tail -f server.log | grep "Exotel requesting TwiML"`

### Issue: "ngrok URL keeps changing"
- ngrok free tier generates new URLs on each restart
- **Solution**: 
  - Use ngrok's paid tier for a static domain
  - OR update the Flow's Passthru URL in Exotel dashboard each time ngrok restarts
  - OR use an alternative tunneling service with static URLs

### Issue: "Exotel says 'Invalid App ID'"
- Double-check the Flow ID is correct
- Ensure the Flow is **Published** (not just saved as draft)
- Make sure the Flow is associated with your Exotel phone number (0XXXXXXXXXX)

---

## Alternative: Using Exotel Simulator
If you want to test without making actual calls:

1. In Exotel Dashboard **Simulator** or **Test**
2. Enter customer number: `9876543210`
3. Select your Flow: `Pharmacy Bot Agent`
4. Click **Test Call**
5. This will simulate the call flow without actual telephony

---

## Next Steps After Setup

Once your AI agent is working:

### 1. Test the Full Conversation
- Make a call
- Listen to the Tamil greeting
- Speak a medicine name (e.g., "பாராசிட்டமால்" - Paracetamol)
- Verify the agent responds correctly

### 2. Monitor Calls
- Check ngrok inspector: `http://localhost:4040/inspect/http`
- Look for TwiML requests from Exotel
- Review server logs for conversation flow

### 3. Database Check
- View call logs: `http://localhost:3000/api/calls`
- Check orders: Query your SQLite database
- Verify callbacks are being saved

---

## Summary

**Calls reaching your phone**  
**Server configured correctly**  
**TwiML endpoint ready**  
⏳ **Need**: Exotel Flow to connect them

**Once you create the Flow and add the `EXOTEL_FLOW_ID`, your AI pharmacy agent will work perfectly!**

---

## Support

If you run into issues:
1. Check server logs: `tail -f server.log`
2. Check ngrok inspector: `http://localhost:4040`
3. Verify Exotel Dashboard → Call Logs
4. Contact Exotel support for Flow/App setup help


