# 🚨 Emergency Mesh Network System

An **offline-first emergency messaging system** that works without internet connectivity. Messages are stored locally in the browser and automatically synced to AWS when connectivity returns.

## 📋 Project Overview

This project addresses a critical real-world problem: **communication during network outages** caused by disasters (floods, earthquakes, network failures, or rural areas with poor connectivity).

### Key Features

- ✅ **Offline-First Architecture** - Works without internet
- ✅ **Automatic Sync** - Messages send automatically when connection restores
- ✅ **Local Storage Queue** - Messages persist in browser storage
- ✅ **AWS Backend** - Serverless architecture (Lambda + DynamoDB + SNS)
- ✅ **Emergency Alerts** - Automatic notifications via SNS
- ✅ **Mobile Responsive** - Works on phones and desktops

## 🏗️ Architecture

```
┌─────────┐
│ Browser │ (HTML/CSS/JS)
│  (User) │
└────┬────┘
     │
     │ ✨ No internet? → Save to localStorage
     │ ✨ Internet available? → POST to API Gateway
     ↓
┌─────────────────┐
│  API Gateway    │
│  (REST Endpoint)│
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│   AWS Lambda    │ ← Python backend
│  (Serverless)   │   - Validate message
└────────┬────────┘   - Save to DynamoDB
         │           - Trigger SNS alert
         ↓
┌─────────────────┐
│  DynamoDB       │ ← Persistent storage
│  (Messages)     │   - id, text, location,
└─────────────────┘     timestamp, synced_at
```

## 🚀 Quick Start

### Prerequisites

- Modern web browser (Chrome, Firefox, Safari, Edge)
- Python 3.8+ (for AWS Lambda deployment)
- AWS Account (Free Tier)

### Run Locally (5 minutes)

1. **Clone or download this folder**
   ```bash
   cd emergency-mesh-network
   ```

2. **Start local server**
   ```bash
   python -m http.server 8000
   ```

3. **Open in browser**
   ```
   http://localhost:8000/emergency.html
   ```

4. **Test offline mode**
   - Open DevTools (F12)
   - Go to **Network tab**
   - Throttle to **Offline**
   - Fill form and submit
   - Messages will be saved to `localStorage`

5. **Test sync**
   - Set Network back to **Online**
   - Messages auto-sync to AWS (when configured)

## ☁️ AWS Deployment

### Step 1: AWS Setup

1. Create AWS Free Tier account at [aws.amazon.com](https://aws.amazon.com)
2. Install AWS CLI:
   ```bash
   pip install awscli
   aws configure  # Enter Access Key, Secret, region: ap-south-1
   ```

### Step 2: Create DynamoDB Table

1. Go to DynamoDB Console
2. Create table: `EmergencyMessages`
   - Partition key: `id` (String)
   - Billing mode: **Pay-per-request** (free tier)

### Step 3: Create SNS Topic

1. Go to SNS Console
2. Create topic: `EmergencyAlerts` (Standard)
3. Note the Topic ARN (you'll need it)

### Step 4: Create Lambda Function

1. Go to Lambda Console
2. Create function: `EmergencyHandler`
   - Runtime: Python 3.12
   - Permissions: Add `DynamoDBFullAccess` + `SNSFullAccess`

3. Upload code from `lambda_function.py` (see file)

4. Set environment variable:
   ```
   SNS_TOPIC_ARN = arn:aws:sns:ap-south-1:XXXX:EmergencyAlerts
   ```

### Step 5: Create API Gateway

1. Create REST API
2. Create resource `/emergency`
3. Create POST method → Lambda integration
4. Deploy to `prod` stage
5. Copy the **Invoke URL** (looks like: `https://xxxx.execute-api.ap-south-1.amazonaws.com/prod`)

### Step 6: Update Frontend Configuration

In `app.js`, replace:
```javascript
const API_URL = 'YOUR_API_GATEWAY_URL_HERE/emergency';
```

With your actual API Gateway URL:
```javascript
const API_URL = 'https://xxxx.execute-api.ap-south-1.amazonaws.com/prod/emergency';
```

### Step 7: Deploy Frontend to S3 (Optional)

1. Create S3 bucket: `your-app-name-emergency`
2. Enable static hosting
3. Upload all files (HTML, CSS, JS)
4. Set bucket policy for public read
5. Access via: `http://bucket.s3-website-ap-south-1.amazonaws.com/emergency.html`

## 🧪 Testing

### Manual Offline Test

1. Open app in browser
2. DevTools → Application → Local Storage
   - Verify `emergency_queue` and `emergency_history` keys exist
3. Network tab → Offline mode
4. Submit emergency message
5. Check console logs: "You are offline. Message saved locally."
6. Refresh page → message persists in history as "⏳ Pending"
7. Network → Online
8. Watch for "Syncing X message(s)..." notification
9. Message status changes to "✓ Sent"

### API Test with Curl

```bash
curl -X POST https://your-api.execute-api.ap-south-1.amazonaws.com/prod/emergency \
  -H "Content-Type: application/json" \
  -d '{
    "id": "123456",
    "text": "Test emergency message",
    "location": "Village Alpha",
    "timestamp": "2026-04-21T21:00:00Z",
    "synced": false
  }'
```

Verify in DynamoDB Console: Record appears in table.

## 📁 Project Structure

```
emergency-mesh-network/
├── emergency.html      # Main UI (message form, history)
├── style.css           # Emergency-themed styling (red/black)
├── app.js              # Offline detection, localStorage, sync logic
│
├── # AWS Backend Files
├── lambda_function.py  # Python Lambda handler
├── requirements.txt    # Python dependencies (boto3)
│
├── # Deployment Scripts
├── deploy.sh           # Bash script to deploy Lambda (optional)
├── terraform/          # Infrastructure as code (optional)
│
└── README.md           # This file
```

## 🔐 Security Considerations

- ⚠️ **This is a prototype** - Not for production emergency services
- ⚠️ Add input validation/sanitization
- ⚠️ Implement rate limiting on API Gateway
- ⚠️ Consider message encryption for sensitive data
- ⚠️ Add authentication/authorization for multi-tenant usage
- ⚠️ Use HTTPS (S3 + CloudFront)

## 📊 Data Model

### DynamoDB Table: `EmergencyMessages`

| Field | Type | Description |
|-------|------|-------------|
| `id` | String | Unique timestamp-based ID |
| `text` | String | Emergency message content |
| `location` | String | Optional locationdata |
| `timestamp` | String | ISO 8601 timestamp (when message created) |
| `synced_at` | String | ISO 8601 timestamp (when reached AWS) |
| `source` | String | `offline_mesh` |

### localStorage Keys

| Key | Value |
|-----|-------|
| `emergency_queue` | Array of pending messages to sync |
| `emergency_history` | Array of sent messages (UI display) |
| `failed_messages` | Array of messages that failed after retries |

## 🔄 Sync Logic Flow

```
1. User submits message
   ↓
2. Check navigator.onLine
   ↓
3a. IF ONLINE → POST to API Gateway immediately
       - Success: Add to history
       - Failure: Save to localStorage queue
   ↓
3b. IF OFFLINE → Save to localStorage queue directly
   ↓
4. Window 'online' event triggers
   ↓
5. Iterate through localStorage queue
   - POST each message to AWS
   - On success: Remove from queue, add to history
   - On failure: Increment retryCount, retry up to 3 times
   ↓
6. After 3 failures: Move to failed_messages, show error
```

## 🎯 Future Enhancements

- [ ] **Mesh Networking**: WebRTC for direct P2P communication (no internet needed)
- [ ] **QR Code Sharing**: Share messages via Bluetooth/NFC when offline
- [ ] **Geolocation Auto-Detect**: Use browser geolocation API
- [ ] **Multilingual UI**: Hindi + regional languages
- [ ] **Priority Levels**: Urgent vs. non-urgent messages
- [ ] **Delivery Receipts**: Read confirmations (when recipient also has app)
- [ ] **SMS/USSD Fallback**: For feature phones
- [ ] **Admin Dashboard**: View all messages on web interface
- [ ] **Battery Optimization**: Reduce polling frequency
- [ ] **Data Compression**: Minimize data usage

## 📈 AWS Free Tier Usage

| Service | Free Tier Limit | Expected Usage | Cost |
|---------|----------------|----------------|------|
| Lambda | 1M requests/month | ~1000 | Free |
| DynamoDB | 25GB storage | <1MB | Free |
| SNS | 10k publishes/month | ~100 | Free |
| API Gateway | 1M API calls | ~1000 | Free |
| S3 | 5GB storage | ~10MB | Free |

**First year cost: ₹0** (within free tier limits)

## 🐛 Known Limitations

1. **Network Detection**: `navigator.onLine` is not 100% reliable
   - Workaround: Always attempt API calls; fallback to localStorage on error
2. **localStorage Limits**: 5-10MB per domain (enough for thousands of text messages)
3. **Single Device**: Messages stored locally only (not synced across devices)
4. **No Real Mesh**: Current version uses store-and-forward, not true P2P mesh

## 📚 Learning Resources

If you're new to these concepts:

1. **AWS Lambda**: Serverless functions
   - [Official Docs](https://docs.aws.amazon.com/lambda/)
   - [Tutorial](https://aws.amazon.com/getting-started/hands-on/run-serverless-code/)

2. **DynamoDB**: NoSQL database
   - [Getting Started](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/GettingStarted.html)

3. **Service Workers**: For true offline PWA (next step)
   - [MDN Web Workers](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)

4. **WebRTC**: Peer-to-peer communication
   - [WebRTC.org](https://webrtc.org/)

## 👨‍💻 Author

Built as a portfolio project demonstrating:
- Full-stack development (frontend + backend + cloud)
- Offline-first architecture patterns
- Event-driven systems design
- AWS serverless technologies
- Real-world problem solving

**Perfect for internship interviews** - Shows ability to build complex systems beyond simple CRUD apps.

## 📄 License

MIT License - Free to use, modify, distribute.

---

**Ready to deploy?** Start with Week 1 tasks in the project checklist.

**Questions?** Open an issue or contact [your-email].
