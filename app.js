require('dotenv').config();
const Framework = require('webex-node-bot-framework');
const express = require('express');
const bodyParser = require('body-parser');
const crypto = require('crypto');

const app = express();
app.use(bodyParser.json({ 
  verify: (req, res, buf) => { req.rawBody = buf; },
  limit: '10mb' // Increase limit for larger payloads
})); // Preserve raw body for signature validation

// Error handling middleware for JSON parsing
app.use((error, req, res, next) => {
  if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
    console.error('❌ JSON parsing error:', {
      error: error.message,
      url: req.url,
      method: req.method,
      contentType: req.headers['content-type'],
      timestamp: new Date().toISOString()
    });
    return res.status(400).json({ error: 'Invalid JSON payload' });
  }
  next();
});

// Health check endpoint
app.get('/', (req, res) => {
  res.json({
    status: 'OK',
    message: 'Webex GitHub Bot is running',
    timestamp: new Date().toISOString(),
    endpoints: {
      github_webhook: '/github',
      health: '/'
    }
  });
});

// Framework config (uses websockets since no webhookUrl is set)
const config = {
  token: process.env.WEBEX_TOKEN
};

// Initialize framework
const framework = new Framework(config);
console.log('🚀 Starting Webex framework...');

framework.start();
framework.on('initialized', () => {
  console.log('✅ Framework initialized!');
  console.log('🤖 Bot is ready to receive events');
});

framework.on('spawn', (bot) => {
  console.log('👋 Bot spawned in space:', {
    roomId: bot.room.id,
    roomTitle: bot.room.title,
    timestamp: new Date().toISOString()
  });
});

framework.on('despawn', (bot) => {
  console.log('👋 Bot despawned from space:', {
    roomId: bot.room.id,
    timestamp: new Date().toISOString()
  });
});

// Optional: Handle a message to get room ID (e.g., say "roomid" to the bot in Webex)
framework.hears('roomid', (bot) => {
  console.log('📍 Room ID requested by user:', {
    roomId: bot.room.id,
    personEmail: bot.person.emails[0],
    timestamp: new Date().toISOString()
  });
  bot.say(`This space's Room ID: ${bot.room.id}`);
});

// GitHub webhook endpoint
app.post('/github', async (req, res) => {
  const startTime = Date.now();
  const event = req.headers['x-github-event'];
  const userAgent = req.headers['user-agent'];
  
  console.log('🔄 Incoming webhook request:', {
    event: event,
    userAgent: userAgent,
    timestamp: new Date().toISOString(),
    ip: req.ip || req.connection.remoteAddress
  });

  // Validate signature
  const sigHeader = req.headers['x-hub-signature-256'];
  if (!sigHeader) {
    console.warn('❌ Webhook rejected: Missing signature');
    return res.status(401).send('Signature missing');
  }

  const hmac = crypto.createHmac('sha256', process.env.GITHUB_SECRET);
  hmac.update(req.rawBody);
  const expectedSig = `sha256=${hmac.digest('hex')}`;

  if (!crypto.timingSafeEqual(Buffer.from(sigHeader), Buffer.from(expectedSig))) {
    console.warn('❌ Webhook rejected: Invalid signature', {
      event: event,
      receivedSig: sigHeader.substring(0, 20) + '...',
      expectedSig: expectedSig.substring(0, 20) + '...'
    });
    return res.status(401).send('Invalid signature');
  }

  console.log('✅ Webhook signature validated successfully');

  // Handle event
  const payload = req.body;
  let message = '';

  console.log('📋 Processing GitHub event:', {
    event: event,
    action: payload.action,
    repository: payload.repository?.full_name,
    sender: payload.sender?.login
  });

  switch (event) {
    case 'push':
      message = `**Push Event**: ${payload.commits?.length || 0} commits pushed to ${payload.ref} by ${payload.pusher?.name || 'unknown'}. Compare: ${payload.compare}`;
      console.log('📤 Push event details:', {
        commits: payload.commits?.length || 0,
        ref: payload.ref,
        pusher: payload.pusher?.name,
        repository: payload.repository?.full_name
      });
      break;
    case 'pull_request':
      message = `**Pull Request ${payload.action}**: #${payload.number} "${payload.pull_request.title}" by ${payload.sender.login}. URL: ${payload.pull_request.html_url}`;
      console.log('🔄 Pull request event details:', {
        action: payload.action,
        number: payload.number,
        title: payload.pull_request.title,
        author: payload.sender.login,
        url: payload.pull_request.html_url
      });
      break;
    case 'issues':
      message = `**Issue ${payload.action}**: #${payload.issue.number} "${payload.issue.title}" by ${payload.sender.login}. URL: ${payload.issue.html_url}`;
      console.log('🐛 Issue event details:', {
        action: payload.action,
        number: payload.issue.number,
        title: payload.issue.title,
        author: payload.sender.login,
        url: payload.issue.html_url
      });
      break;
    default:
      console.log(`⚠️  Unhandled event type: ${event}`, {
        availableData: Object.keys(payload),
        sender: payload.sender?.login,
        repository: payload.repository?.full_name
      });
      return res.status(200).send('Event received');
  }

  // Post to Webex space using the framework's Webex SDK
  console.log('📨 Sending message to Webex:', {
    roomId: process.env.ROOM_ID ? 'configured' : 'missing',
    messageLength: message.length,
    messagePreview: message.substring(0, 100) + (message.length > 100 ? '...' : '')
  });

  try {
    const webex = framework.webex; // Access the SDK (note: in some versions, use framework.getWebexSDK())
    await webex.messages.create({
      roomId: process.env.ROOM_ID,
      markdown: message
    });
    const processingTime = Date.now() - startTime;
    console.log('✅ Message posted to Webex successfully', {
      processingTime: `${processingTime}ms`,
      event: event,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error posting to Webex:', {
      error: error.message,
      stack: error.stack,
      event: event,
      roomId: process.env.ROOM_ID ? 'configured' : 'missing',
      timestamp: new Date().toISOString()
    });
  }

  const totalTime = Date.now() - startTime;
  console.log('🏁 Webhook processing completed', {
    event: event,
    totalProcessingTime: `${totalTime}ms`,
    timestamp: new Date().toISOString()
  });

  res.status(200).send('Event processed');
});

// Start server
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log('🌐 Server running on port', port);
  console.log('📋 Environment check:', {
    webexToken: process.env.WEBEX_TOKEN ? '✅ configured' : '❌ missing',
    githubSecret: process.env.GITHUB_SECRET ? '✅ configured' : '❌ missing',
    roomId: process.env.ROOM_ID ? '✅ configured' : '❌ missing',
    port: port,
    nodeVersion: process.version,
    timestamp: new Date().toISOString()
  });
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('🛑 Received SIGINT, shutting down gracefully...');
  framework.stop().then(() => {
    console.log('✅ Framework stopped, exiting process');
    process.exit();
  });
});
