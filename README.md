# Reddit Gig Scout & Proposal Generator 🚀

An automated real-time Reddit gig monitor and instant proposal generator. It tracks hiring subreddits for developer, automation, AI annotation, and Web3 gigs, generates customized pitches, and alerts instantly via Telegram.

## Features
- ⚡ **Real-Time Monitoring**: Scouts hiring subreddits every 45 seconds using lightweight feeds.
- 🎯 **Smart Keyword Matching**: Matches posts across Web Dev (React/Next.js/TS), Python/Scraping/Bots, AI Annotation, and Web3/Crypto.
- 📝 **Pre-Crafted Pitches**: Tailors human, non-generic proposals formatted for sub-specific rules (like `$bid` on `r/slavelabour`).
- 📱 **Telegram Remote Control**:
  - `/list` - View monitored subreddits
  - `/add <sub_name>` - Add a new subreddit dynamically
  - `/remove <sub_name>` - Remove a subreddit
  - `/status` - Check scout health and stats
- 🌐 **Render Ready**: Includes a built-in health check HTTP server for free 24/7 deployment on Render.

## Environment Variables
Create a `.env` file or configure in your hosting platform:
```env
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
TELEGRAM_CHAT_ID=your_telegram_chat_id
CHECK_INTERVAL_SECONDS=45
PORT=10000
```

## Running Locally
```bash
npm install
npm start
```