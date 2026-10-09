# Order Taker Mode

## What Is This?

**Order Taker Mode** is a **non-conversational** order taking system where:
- Customer lists ALL medicines at once
- System extracts and confirms the complete order
- Minimal back-and-forth - maximum efficiency

---

## Two Modes Comparison

### **Conversational Mode (Default)**
```
Agent: வணக்கம். என்ன மருந்து தேவை?
Customer: பாராசிட்டமால்
Agent: பாராசிட்டமால் கிடைக்கும். எத்தனை ஸ்டிரிப் வேணும்?
Customer: மூணு ஸ்டிரிப்
Agent: சரி. வேற எதாவது வேணுமா?
Customer: டோலோ 650
Agent: எத்தனை?
Customer: ரெண்டு ஸ்டிரிப்
```
**Total exchanges: 7**

### **Order Taker Mode (New)**
```
Agent: வணக்கம். என்ன மருந்து வேணும்? சொல்லுங்க.
Customer: பாராசிட்டமால் மூணு ஸ்டிரிப், டோலோ 650 ரெண்டு ஸ்டிரிப்
Agent: சரி. நீங்க சொன்னது: பாராசிட்டமால் மூணு ஸ்டிரிப், டோலோ 650 ரெண்டு ஸ்டிரிப். சரியா?
Customer: ஆமாம்
Agent: சரி. ஆர்டர் நோட் பண்ணிட்டேன். நன்றி.
```
**Total exchanges: 4** **Faster!**

---

## How to Use

### **Web Interface (Easiest)**

```bash
# 1. Start server
npm start

# 2. Open order taker UI
open http://localhost:3000/order-taker.html
```

### **API Usage**

#### **1. Initialize Session**
```bash
POST /api/order-taker/init
{
  "callId": "order-123",
  "customerName": "Test Customer"
}
```

**Response:**
```json
{
  "success": true,
  "greeting": {
    "assistant_speech": "வணக்கம். என்ன மருந்து வேணும்? சொல்லுங்க.",
    "agent_action": {
      "type": "NONE"
    }
  }
}
```

#### **2. Process Customer Speech**
```bash
POST /api/order-taker/process
{
  "callId": "order-123",
  "transcript": "பாராசிட்டமால் மூணு ஸ்டிரிப், டோலோ 650 ரெண்டு ஸ்டிரிப்"
}
```

**Response:**
```json
{
  "success": true,
  "response": {
    "assistant_speech": "சரி. நீங்க சொன்னது: பாராசிட்டமால் மூணு ஸ்டிரிப், டோலோ 650 ரெண்டு ஸ்டிரிப். சரியா?",
    "agent_action": {
      "type": "NONE"
    }
  }
}
```

#### **3. Confirm Order**
```bash
POST /api/order-taker/process
{
  "callId": "order-123",
  "transcript": "ஆமாம்"
}
```

**Response:**
```json
{
  "success": true,
  "response": {
    "assistant_speech": "சரி. ஆர்டர் நோட் பண்ணிட்டேன். நன்றி.",
    "agent_action": {
      "type": "SAVE_ORDER",
      "order_details": {
        "items": [
          {
            "medicine_name": "Paracetamol",
            "quantity": "3 strips"
          },
          {
            "medicine_name": "Dolo 650",
            "quantity": "2 strips"
          }
        ]
      }
    }
  }
}
```

---

## Key Differences

| Feature | Conversational Mode | Order Taker Mode |
|---------|---------------------|------------------|
| **Conversation** | Back-and-forth Q&A | Customer speaks once |
| **System Responses** | Every turn | Only greeting & confirmation |
| **Efficiency** | Slower | Faster |
| **User Experience** | Guided | Efficient |
| **Best For** | New/uncertain customers | Regular customers |
| **API Endpoint** | `/api/llm` | `/api/order-taker` |
| **Web UI** | `/voice-test.html` | `/order-taker.html` |

---

## Example Conversations

### **Example 1: Simple Order**
```
System: வணக்கம். என்ன மருந்து வேணும்? சொல்லுங்க.
Customer: பாராசிட்டமால் மூணு ஸ்டிரிப்
System: சரி. நீங்க சொன்னது: பாராசிட்டமால் மூணு ஸ்டிரிப். சரியா?
Customer: ஆமாம்
System: சரி. ஆர்டர் நோட் பண்ணிட்டேன். நன்றி.
```

### **Example 2: Multiple Medicines**
```
System: வணக்கம். என்ன மருந்து வேணும்? சொல்லுங்க.
Customer: பாராசிட்டமால் மூணு ஸ்டிரிப், டோலோ 650 ரெண்டு ஸ்டிரிப், செட்ரிசின் ஒரு ஸ்டிரிப், அமோக்ஸிசில்லின் நாலு ஸ்டிரிப்
System: சரி. நீங்க சொன்னது: பாராசிட்டமால் மூணு ஸ்டிரிப், டோலோ 650 ரெண்டு ஸ்டிரிப், செட்ரிசின் ஒரு ஸ்டிரிப், அமோக்ஸிசில்லின் நாலு ஸ்டிரிப். சரியா?
Customer: ஆமாம்
System: சரி. ஆர்டர் நோட் பண்ணிட்டேன். நன்றி.
```

### **Example 3: Correction**
```
System: வணக்கம். என்ன மருந்து வேணும்? சொல்லுங்க.
Customer: பாராசிட்டமால் மூணு ஸ்டிரிப், டோலோ 650 ரெண்டு ஸ்டிரிப்
System: சரி. நீங்க சொன்னது: பாராசிட்டமால் மூணு ஸ்டிரிப், டோலோ 650 ரெண்டு ஸ்டிரிப். சரியா?
Customer: இல்ல, பாராசிட்டமால் நாலு ஸ்டிரிப்
System: சரி. பாராசிட்டமால் நாலு ஸ்டிரிப், டோலோ 650 ரெண்டு ஸ்டிரிப். இப்போ சரியா?
Customer: ஆமாம்
System: சரி. ஆர்டர் நோட் பண்ணிட்டேன். நன்றி.
```

---

## When to Use Each Mode

### **Use Conversational Mode When:**
- Customer is new/unfamiliar with system
- Need to check medicine availability
- Need to guide customer through process
- Customer wants callback options
- Complex inquiries

### **Use Order Taker Mode When:**
- Regular customers who know what they want
- Quick orders
- Multiple items at once
- Customer prefers efficiency
- Bulk orders

---

## API Endpoints

### **Order Taker Mode**
```
POST   /api/order-taker/init           - Initialize session
POST   /api/order-taker/process        - Process transcript
GET    /api/order-taker/transcript/:id - Get transcript
GET    /api/order-taker/actions/:id    - Get actions
DELETE /api/order-taker/session/:id    - Cleanup
```

### **Conversational Mode (Existing)**
```
POST   /api/llm/init                   - Initialize session
POST   /api/llm/process                - Process transcript
GET    /api/llm/transcript/:id         - Get transcript
GET    /api/llm/actions/:id            - Get actions
```

---

## Database Storage

Both modes use the **same database schema**:

```javascript
Order {
  id: 1,
  customerId: 123,
  callId: "order-123",
  items: [
    {
      medicine_name: "Paracetamol",
      quantity: "3 strips"
    },
    {
      medicine_name: "Dolo 650",
      quantity: "2 strips"
    }
  ],
  total_items: 2,
  status: "pending",
  createdAt: "2025-11-16..."
}
```

---

## Testing

### **Web Interface**
```bash
# Terminal 1: Start server
npm start

# Terminal 2: Open order taker
open http://localhost:3000/order-taker.html
```

**Then:**
1. Click "Start Order Taking"
2. Allow microphone
3. Speak: "பாராசிட்டமால் மூணு ஸ்டிரிப், டோலோ 650 ரெண்டு ஸ்டிரிப்"
4. Confirm when asked
5. Done!

### **Check Database**
```bash
npm run db:studio
```

View saved orders with all medicines!

---

## Medicine Extraction

System automatically extracts:

### **Medicine Names**
```
பாராசிட்டமால் Paracetamol
டோலோ 650 Dolo 650
செட்ரிசின் Cetirizine
அமோக்ஸிசில்லின் Amoxicillin
ஆஸ்பிரின் Aspirin
மெட்ஃபார்மின் Metformin
```

### **Quantities**
```
மூணு ஸ்டிரிப் 3 strips
ரெண்டு டேப்லட் 2 tablets
ஒரு பாட்டில் 1 bottle
இருபது மாத்திரை 20 tablets
```

---

## Advantages of Order Taker Mode

1. **Faster** - Fewer exchanges
2. **Efficient** - Customer speaks once
3. **Bulk-friendly** - Handle multiple items easily
4. **Cost-effective** - Less API calls
5. **User-friendly** - For regular customers

---

## Integration with Calls

### **Existing Architecture Unchanged**
- Conversational mode: Use `/api/llm`
- Order taker mode: Use `/api/order-taker`
- Both work with same telephony system
- Same STT/TTS engines
- Same database

### **Choose Mode Per Call**
```javascript
// In call controller
if (customer.preferredMode === 'order-taker') {
  // Use order taker endpoints
  await initializeOrderTaker(callId, customerName);
} else {
  // Use conversational endpoints (default)
  await initializeLLM(callId, customerName);
}
```

---

## Summary

**Two Modes Available:**

1. **Conversational** (`/api/llm`) - Guided Q&A
2. **Order Taker** (`/api/order-taker`) - Quick list & confirm

**Both modes:**
- Store to same database
- Use same STT/TTS
- Work with telephony
- Full Tamil support

**Choose based on use case!**

---

**Web UIs:**
- Conversational: http://localhost:3000/voice-test.html
- Order Taker: http://localhost:3000/order-taker.html

**Try both and see which fits your workflow!** 






