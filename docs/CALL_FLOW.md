# Call Flow Diagram - Pharmacy Calling Agent

## **Overview**

This document maps the complete call flow based on the agent prompt. The agent follows a **customer-first approach** where customers initiate by asking about medicine availability.

---

## **Main Call Flow**

```
┌─────────────────────────────────────────────────────────────┐
│                    CALL STARTS                               │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
        ┌──────────────────────────────┐
        │  1. GREETING                  │
        │  "வணக்கம். என் பேர் சரண்யா..." │
        │  Action: NONE                 │
        │  Status: "contacted"           │
        └──────────────┬─────────────────┘
                       │
                       ▼
        ┌──────────────────────────────┐
        │  2. ASK FOR MEDICINE NEED     │
        │  "என்ன மருந்து தேவை?"        │
        │  Action: NONE                 │
        └──────────────┬─────────────────┘
                       │
                       ▼
        ┌──────────────────────────────┐
        │  3. CUSTOMER ASKS ABOUT       │
        │     MEDICINE AVAILABILITY     │
        │  "இந்த மருந்து கிடைக்குமா?"   │
        └──────────────┬─────────────────┘
                       │
        ┌──────────────┴──────────────┐
        │                             │
        ▼                             ▼
┌───────────────┐           ┌──────────────────┐
│  AVAILABLE    │           │  NOT AVAILABLE    │
│  Path         │           │  Path             │
└───────┬───────┘           └────────┬─────────┘
        │                             │
        ▼                             ▼
┌──────────────────┐         ┌──────────────────────┐
│ 4a. CONFIRM      │         │ 4b. INFORM & OFFER   │
│    AVAILABILITY  │         │    CALLBACK          │
│ "ஆமாம் கிடைக்கும்"│         │ "இப்போ கிடைக்கவில்லை"│
│ Action: NONE    │         │ Action: NOT_AVAILABLE│
└────────┬─────────┘         └──────────┬───────────┘
         │                              │
         ▼                              ▼
┌──────────────────┐         ┌──────────────────────┐
│ 5a. ASK QUANTITY │         │ 5b. CUSTOMER WANTS   │
│ "எத்தனை ஸ்டிரிப்?"│         │    CALLBACK?         │
│ Action: NONE     │         │ "வந்தவுடன் சொல்லலாமா?"│
└────────┬─────────┘         └──────────┬───────────┘
         │                              │
         ▼                              ▼
┌──────────────────┐         ┌──────────────────────┐
│ 6a. CUSTOMER     │         │ 6b. ASK CALLBACK TIME │
│    PROVIDES QTY  │         │ "எப்போ அழைத்தா சரி?"│
│ "ரெண்டு ஸ்டிரிப்" │         │ Action: NONE         │
└────────┬─────────┘         └──────────┬───────────┘
         │                              │
         ▼                              ▼
┌──────────────────┐         ┌──────────────────────┐
│ 7a. CONFIRM      │         │ 7b. CUSTOMER PROVIDES│
│    ORDER        │         │    CALLBACK TIME      │
│ "பாராசிட்டமால் 2" │         │ "நாளைக்கு காலைல"      │
│ Action: SAVE_ORDER│        │ Action: SAVE_CALLBACK│
│ Status: "order_placed"│    │ Status: "callback_requested"│
└────────┬─────────┘         └──────────┬───────────┘
         │                              │
         └──────────────┬───────────────┘
                       │
                       ▼
        ┌──────────────────────────────┐
        │  8. POLITE GOODBYE           │
        │  "நன்றி. விரைவில்..."        │
        │  Action: END_CALL             │
        └──────────────┬─────────────────┘
                       │
                       ▼
        ┌──────────────────────────────┐
        │  9. NEXT CUSTOMER             │
        │  Action: NEXT_CUSTOMER        │
        └──────────────────────────────┘
```

---

## **Detailed Step-by-Step Flow**

### **Step 1: Initial Greeting**
- **Agent Says:** "வணக்கம். என் பேர் சரண்யா, ஸ்ரீ பார்மசியில் இருந்து பேசுறேன்."
- **Action Type:** `NONE`
- **Customer Status:** `"contacted"`
- **Next:** Ask what medicine they need

### **Step 2: Ask for Medicine Need**
- **Agent Says:** "என்ன மருந்து தேவை?"
- **Action Type:** `NONE`
- **Purpose:** Customer-first approach - let customer state their need

### **Step 3: Customer Asks About Availability**
- **Customer Says:** "இந்த மருந்து கிடைக்குமா?" (Is this medicine available?)
- **Agent Response:** Depends on availability

---

## **Branch A: Medicine Available**

### **Step 4a: Confirm Availability**
- **Agent Says:** "ஆமாம் கிடைக்கும். எத்தனை ஸ்டிரிப் வேண்டும்?"
- **Action Type:** `NONE`
- **Purpose:** Confirm availability and ask for quantity

### **Step 5a: Customer Provides Quantity**
- **Customer Says:** "ரெண்டு ஸ்டிரிப் வேணும்" (Need 2 strips)
- **Agent Response:** Confirm order

### **Step 6a: Confirm Order**
- **Agent Says:** "சரி. பாராசிட்டமால் ரெண்டு ஸ்டிரிப் வேணும் இல்லையா? வேற ஏதாவது வேணுமா?"
- **Action Type:** `SAVE_ORDER`
- **Order Details:**
  ```json
  {
    "items": [
      {"name": "Paracetamol", "quantity": 2, "notes": ""}
    ],
    "notes": ""
  }
  ```
- **Customer Status:** `"order_placed"`

### **Step 7a: Final Confirmation**
- **Customer Says:** "இல்ல போதும்" (No, that's enough)
- **Agent Says:** "சரி சார். உங்க ஆர்டர் நோட் பண்ணிட்டேன். விரைவில் டெலிவரி செய்யுறோம். நன்றி."
- **Action Type:** `END_CALL`
- **Customer Status:** `"order_placed"`

---

## **Branch B: Medicine Not Available**

### **Step 4b: Inform Unavailability**
- **Agent Says:** "இப்போ கிடைக்கவில்லை சார். வந்தவுடன் சொல்லிக் கொடுக்கலாமா?"
- **Action Type:** `NOT_AVAILABLE`
- **Order Details Notes:** "Dolo 650 not available"
- **Purpose:** Inform customer and offer callback

### **Step 5b: Customer Wants Callback**
- **Customer Says:** "ஆமாம் சொல்லுங்க" (Yes, please inform)
- **Agent Says:** "சரி. எப்போ அழைக்கிறது?" (When should I call?)
- **Action Type:** `NONE`

### **Step 6b: Customer Provides Callback Time**
- **Customer Says:** "நாளைக்கு காலைல அழையுங்க" (Call tomorrow morning)
- **Agent Says:** "சரி சார். நாளைக்கு காலை 10 மணிக்கு அழைக்கிறேன். நன்றி."
- **Action Type:** `SAVE_CALLBACK`
- **Callback Time:** `"tomorrow 10am"`
- **Customer Status:** `"callback_requested"`

---

## **Branch C: Customer Not Interested**

### **Alternative Path:**
- **Customer Says:** "எனக்கு வேண்டாம்" (I don't need it)
- **Agent Says:** "பரவாயில்ல சார். தேவைப்பட்டா எங்க கடைக்கு வாங்க. நன்றி."
- **Action Type:** `END_CALL`
- **Customer Status:** `"not_interested"`

---

## **Action Types Reference**

| Action Type | When Used | What Happens |
|------------|-----------|-------------|
| **NONE** | Continue conversation | No backend action, just continue talking |
| **SAVE_ORDER** | Customer confirms order | Save order to database with medicine + quantity |
| **SAVE_CALLBACK** | Customer wants callback | Save callback request with time |
| **NOT_AVAILABLE** | Medicine not in stock | Log unavailability, offer callback |
| **END_CALL** | Conversation complete | End the call gracefully |
| **NEXT_CUSTOMER** | Call ended | Move to next customer in queue |

---

## **Customer Status Values**

| Status | Meaning | When Set |
|--------|---------|----------|
| `"contacted"` | Successfully spoke with customer | Initial greeting |
| `"order_placed"` | Customer placed an order | When SAVE_ORDER action triggered |
| `"callback_requested"` | Customer wants callback | When SAVE_CALLBACK action triggered |
| `"not_interested"` | Customer not interested | When customer declines |
| `"no_answer"` | Customer didn't answer | If call not answered |

---

## **Order Details Structure**

```json
{
  "items": [
    {
      "name": "Paracetamol",      // English medicine name
      "quantity": 2,               // Number of strips/units
      "notes": "500mg"             // Optional notes (strength, etc.)
    }
  ],
  "notes": "Any additional notes"  // General order notes
}
```

---

## ⏰ **Callback Time Format**

- **ISO 8601:** `"2024-01-15T10:00:00"`
- **Natural Language:** `"tomorrow 10am"`, `"evening 6pm"`, `"tomorrow morning"`

---

## **Medicine Name Mapping**

The agent handles Tamil-to-English medicine name conversion:

| Tamil Input | English Output |
|------------|----------------|
| "பாரா" or "பராசிட்டமால்" | Paracetamol |
| "டோலோ" | Dolo |
| "க்ரோசின்" | Crocin |
| "சித்ரிசின்" | Cetrizine |

---

## **Key Design Principles**

1. **Customer-First Approach:** Customer initiates by asking about availability
2. **Natural Tamil:** All agent speech in natural, conversational Tamil
3. **Structured JSON:** All actions in English JSON for backend processing
4. **Graceful Handling:** Handles unclear speech, not interested, etc.
5. **Confirmation:** Always confirms order details before ending
6. **Polite & Professional:** Respectful tone throughout

---

## **Complete Flow Example**

### **Scenario 1: Successful Order**

```
1. Agent: "வணக்கம். என் பேர் சரண்யா..."
   Action: NONE, Status: "contacted"

2. Agent: "என்ன மருந்து தேவை?"
   Action: NONE

3. Customer: "பாராசிட்டமால் கிடைக்குமா?"
   Action: NONE

4. Agent: "ஆமாம் கிடைக்கும். எத்தனை ஸ்டிரிப் வேண்டும்?"
   Action: NONE

5. Customer: "ரெண்டு ஸ்டிரிப் வேணும்"
   Action: SAVE_ORDER
   Order: [{"name": "Paracetamol", "quantity": 2}]
   Status: "order_placed"

6. Agent: "சரி. பாராசிட்டமால் ரெண்டு ஸ்டிரிப் வேணும் இல்லையா?"
   Action: NONE

7. Customer: "இல்ல போதும்"
   Action: END_CALL
   Status: "order_placed"

8. Agent: "சரி சார். உங்க ஆர்டர் நோட் பண்ணிட்டேன். நன்றி."
   Call ends
```

### **Scenario 2: Not Available Callback**

```
1-3. [Same as above]

4. Customer: "டோலோ 650 இருக்கா?"
   Action: NOT_AVAILABLE
   Notes: "Dolo 650 not available"

5. Agent: "இப்போ கிடைக்கவில்லை சார். வந்தவுடன் சொல்லிக் கொடுக்கலாமா?"
   Action: NONE

6. Customer: "ஆமாம் சொல்லுங்க"
   Action: NONE

7. Agent: "சரி. எப்போ அழைக்கிறது?"
   Action: NONE

8. Customer: "நாளைக்கு காலைல அழையுங்க"
   Action: SAVE_CALLBACK
   Callback Time: "tomorrow 10am"
   Status: "callback_requested"

9. Agent: "சரி சார். நாளைக்கு காலை 10 மணிக்கு அழைக்கிறேன். நன்றி."
   Action: END_CALL
```

---

## **Implementation Notes**

1. **LLM Processing:** Each customer transcript is sent to LLM with conversation history
2. **Action Execution:** Backend processes `agent_action` JSON to save orders/callbacks
3. **State Management:** Conversation history maintained per call
4. **Error Handling:** Fallback response if LLM fails: "மன்னிச்சுக்கங்க, எனக்கு தெளிவா கேக்கல..."
5. **Validation:** Response format validated before processing

---

## **Summary**

The flow is **conversational, customer-first, and structured**:
- Customer initiates by asking about medicine
- Agent responds naturally in Tamil
- Actions extracted as structured JSON
- Handles all scenarios (available, not available, not interested)
- Always confirms before ending
- Polite and professional throughout



