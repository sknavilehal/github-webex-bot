# Webex GitHub Bot

A Node.js bot that integrates GitHub webhooks with Webex Teams spaces.

## Node.js Compatibility

This project uses a compatibility loader (`loader.js`) to resolve issues with Node.js v23+ and the Webex SDK. The Webex SDK's internal media core library has compatibility issues with newer Node.js versions due to changes in global object property descriptors.

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Create a `.env` file with your configuration:
   ```
   WEBEX_TOKEN=your_webex_bot_token
   ROOM_ID=your_webex_room_id
   GITHUB_SECRET=your_github_webhook_secret
   PORT=3000
   ```

3. Run the application:
   ```bash
   npm start
   # or
   node loader.js
   ```

## Usage

- The bot will connect to Webex Teams using websockets
- Set up a GitHub webhook pointing to `http://your-server:3000/github`
- The bot will post messages to the configured Webex space when GitHub events occur

## Supported Events

- Push events
- Pull request events  
- Issue events

## Troubleshooting

If you encounter `TypeError: Cannot set property navigator` errors:
- Make sure you're using `node loader.js` instead of `node app.js`
- The loader script includes compatibility patches for Node.js v23+

For better compatibility, consider using Node.js v18 or v20 with a version manager like nvm.
