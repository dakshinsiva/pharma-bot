# Database Models Documentation

## Customer
Stores customer information and call status.

**Fields:**
- `id` (String, UUID): Unique identifier
- `name` (String): Customer name
- `phone` (String, Unique): Customer phone number
- `status` (String): Current status - pending, contacted, completed, callback_scheduled
- `lastCallTime` (DateTime, Nullable): Last time customer was called
- `createdAt` (DateTime): Record creation timestamp
- `updatedAt` (DateTime): Last update timestamp

**Relations:**
- Has many Orders
- Has many Callbacks
- Has many CallLogs

---

## Order
Stores medicine orders placed by customers.

**Fields:**
- `id` (String, UUID): Unique identifier
- `customerId` (String): Foreign key to Customer
- `items` (String): JSON string containing order items
  - Format: `[{"name": "Paracetamol", "quantity": 2, "notes": "500mg"}]`
- `notes` (String, Nullable): Additional order notes
- `status` (String): Order status - pending, confirmed, delivered
- `createdAt` (DateTime): Order creation timestamp
- `updatedAt` (DateTime): Last update timestamp

**Relations:**
- Belongs to Customer

---

## Callback
Stores scheduled callback requests from customers.

**Fields:**
- `id` (String, UUID): Unique identifier
- `customerId` (String): Foreign key to Customer
- `callbackTime` (DateTime): Scheduled callback time
- `reason` (String, Nullable): Reason for callback
- `status` (String): Callback status - scheduled, completed, cancelled
- `createdAt` (DateTime): Record creation timestamp
- `updatedAt` (DateTime): Last update timestamp

**Relations:**
- Belongs to Customer

---

## CallLog
Stores detailed logs of all calls made to customers.

**Fields:**
- `id` (String, UUID): Unique identifier
- `customerId` (String): Foreign key to Customer
- `callSid` (String, Nullable): Twilio/Exotel call identifier
- `provider` (String): Telephony provider - twilio or exotel
- `status` (String): Call status - initiated, ringing, in-progress, completed, failed, busy, no-answer
- `duration` (Int, Nullable): Call duration in seconds
- `transcript` (String, Nullable): Full conversation transcript
- `actions` (String, Nullable): JSON string of all agent actions taken during call
- `startTime` (DateTime): Call start timestamp
- `endTime` (DateTime, Nullable): Call end timestamp

**Relations:**
- Belongs to Customer

---

## Usage Examples

### Create a new customer with an order:
```javascript
const customer = await prisma.customer.create({
  data: {
    name: "Raj Kumar",
    phone: "+919876543210",
    orders: {
      create: {
        items: JSON.stringify([
          { name: "Paracetamol", quantity: 2, notes: "500mg" }
        ]),
        notes: "Urgent delivery"
      }
    }
  }
});
```

### Schedule a callback:
```javascript
const callback = await prisma.callback.create({
  data: {
    customerId: customer.id,
    callbackTime: new Date("2024-01-15 10:00:00"),
    reason: "Medicine not available"
  }
});
```

### Log a call:
```javascript
const callLog = await prisma.callLog.create({
  data: {
    customerId: customer.id,
    callSid: "CA123456789",
    provider: "twilio",
    status: "completed",
    duration: 120,
    transcript: "Full conversation...",
    actions: JSON.stringify([
      { type: "SAVE_ORDER", items: [...] }
    ])
  }
});
```

