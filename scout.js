require('dotenv').config();
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const INTERVAL_MS = (parseInt(process.env.CHECK_INTERVAL_SECONDS) || 45) * 1000;
const PORT = process.env.PORT || 10000;

const SUBS_FILE = path.join(__dirname, 'subreddits.json');

function loadSubreddits() {
  try {
    if (fs.existsSync(SUBS_FILE)) {
      return JSON.parse(fs.readFileSync(SUBS_FILE, 'utf8'));
    }
  } catch (e) {
    console.error('Error reading subreddits.json:', e.message);
  }
  return ['forhire', 'slavelabour', 'freelance_forhire', 'jobbit', 'RemoteJobs', 'SideJobs'];
}

function saveSubreddits(subs) {
  try {
    fs.writeFileSync(SUBS_FILE, JSON.stringify(subs, null, 2), 'utf8');
  } catch (e) {
    console.error('Error saving subreddits.json:', e.message);
  }
}

let monitoredSubs = loadSubreddits();

const SKILL_RULES = [
  {
    category: 'React / Frontend / Web Development',
    keywords: ['react', 'nextjs', 'next.js', 'frontend', 'front-end', 'tailwind', 'typescript', 'javascript', 'html', 'landing page', 'web dev', 'web developer', 'website'],
    pitch: (title, sub) => sub === 'slavelabour'
      ? `Comment on post: $bid\n\nDM to send:\nHi! I saw your post regarding: "${title}". I am a software developer experienced in React, Next.js, TypeScript, and Tailwind CSS. Clean, responsive UI with fast turnaround.\n\nGitHub: https://github.com/Goodyness-dev\nHappy to start right now!`
      : `Hi! Reaching out regarding your post: "${title}".\n\nI am a software developer experienced in React, Next.js, TypeScript, and modern frontend development. I build fast, responsive user interfaces and robust API integrations.\n\nGitHub: https://github.com/Goodyness-dev\nEmail: adewolegoodness22@gmail.com\n\nI'd love to help you build this. When can we discuss requirements?`
  },
  {
    category: 'Python / Web Scraping / Bots / Automation',
    keywords: ['python', 'scraper', 'scraping', 'selenium', 'playwright', 'bot', 'script', 'crawl', 'automation', 'api integration', 'telegram bot'],
    pitch: (title, sub) => sub === 'slavelabour'
      ? `Comment on post: $bid\n\nDM to send:\nHi! I saw your post for: "${title}". I have solid experience writing Python automation scripts, web scrapers, and bot integrations (including reverse-engineering APIs). Fast and clean delivery.\n\nGitHub: https://github.com/Goodyness-dev\nLet me know details and I'll jump on it!`
      : `Hi! Reaching out regarding: "${title}".\n\nI am a developer with strong Python experience (Stanford Code in Place certified). I specialize in automated web scrapers, data pipelines, bots, and reverse-engineering complex APIs.\n\nGitHub: https://github.com/Goodyness-dev\nEmail: adewolegoodness22@gmail.com\n\nHappy to deliver a working solution promptly!`
  },
  {
    category: 'Web3 / Crypto / Solidity',
    keywords: ['web3', 'solidity', 'smart contract', 'ethereum', 'ethers', 'solana', 'crypto', 'token'],
    pitch: (title, sub) => `Hi! Reaching out regarding: "${title}".\n\nI am a Web3 developer experienced in building DApps, smart contracts, ethers.js/wagmi integrations, and prediction engines (TxODDS hackathon finalist).\n\nGitHub: https://github.com/Goodyness-dev\nEmail: adewolegoodness22@gmail.com\n\nLet me know how I can help you ship this!`
  },
  {
    category: 'AI Training / Annotation / Evaluation',
    keywords: ['annotation', 'data labeling', 'ai training', 'prompt engineer', 'evaluation', 'rlhf', 'model review', 'dataset'],
    pitch: (title, sub) => `Hi! I saw your post regarding: "${title}".\n\nI have direct experience in AI content evaluation, text classification, and data annotation with Atlas Capture and independent projects. High accuracy, strict guideline adherence, and edge-case reporting.\n\nEmail: adewolegoodness22@gmail.com\nReady to begin immediately!`
  },
  {
    category: 'Quick Tasks & General Gigs',
    keywords: ['need help building', 'need developer', 'quick task', 'fix bug', 'simple script', 'side gig', 'small task'],
    pitch: (title, sub) => sub === 'slavelabour'
      ? `Comment on post: $bid\n\nDM to send:\nHi! I can help you knock this out right away. Computer Engineering student with broad software experience. Let me know!`
      : `Hi! Reaching out regarding: "${title}".\n\nI am available to resolve this for you immediately. Software developer with experience across web dev, debugging, and scripts.\n\nGitHub: https://github.com/Goodyness-dev\nEmail: adewolegoodness22@gmail.com`
  }
];

// Cap seen posts to 1500 to prevent any memory growth
const seenPosts = new Set();
function addSeenPost(id) {
  if (seenPosts.size > 1500) {
    const firstItems = Array.from(seenPosts).slice(0, 500);
    firstItems.forEach(item => seenPosts.delete(item));
  }
  seenPosts.add(id);
}

let isFirstRun = true;
let lastUpdateId = 0;

function sendTelegramMessage(text) {
  return new Promise((resolve) => {
    const postData = JSON.stringify({ chat_id: CHAT_ID, text: text, disable_web_page_preview: false });
    const req = https.request({
      hostname: 'api.telegram.org',
      path: '/bot' + BOT_TOKEN + '/sendMessage',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postData) }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    });
    req.on('error', () => resolve(null));
    req.write(postData);
    req.end();
  });
}

function pollTelegramCommands() {
  const req = https.request({
    hostname: 'api.telegram.org',
    path: `/bot${BOT_TOKEN}/getUpdates?offset=${lastUpdateId + 1}&timeout=10`,
    method: 'GET'
  }, (res) => {
    let data = '';
    res.on('data', c => data += c);
    res.on('end', async () => {
      try {
        const json = JSON.parse(data);
        if (json.ok && Array.isArray(json.result)) {
          for (const item of json.result) {
            lastUpdateId = item.update_id;
            const msg = item.message;
            if (msg && msg.text && String(msg.chat.id) === String(CHAT_ID)) {
              await handleTelegramCommand(msg.text.trim());
            }
          }
        }
      } catch (e) {}
      setTimeout(pollTelegramCommands, 2500);
    });
  });
  req.on('error', () => setTimeout(pollTelegramCommands, 5000));
  req.setTimeout(12000, () => { req.destroy(); setTimeout(pollTelegramCommands, 2500); });
  req.end();
}

async function handleTelegramCommand(text) {
  const parts = text.split(/\s+/);
  const cmd = parts[0].toLowerCase();
  const arg = parts[1] ? parts[1].replace(/^r\//i, '').trim() : '';

  if (cmd === '/add' && arg) {
    const subClean = arg.toLowerCase();
    if (!monitoredSubs.map(s => s.toLowerCase()).includes(subClean)) {
      monitoredSubs.push(arg);
      saveSubreddits(monitoredSubs);
      await sendTelegramMessage(`✅ Added r/${arg} to scout list!\n\nCurrently monitoring (${monitoredSubs.length} subs):\n` + monitoredSubs.map(s => '• r/' + s).join('\n'));
    } else {
      await sendTelegramMessage(`⚠️ r/${arg} is already being monitored.`);
    }
  } else if (cmd === '/remove' && arg) {
    const subClean = arg.toLowerCase();
    monitoredSubs = monitoredSubs.filter(s => s.toLowerCase() !== subClean);
    saveSubreddits(monitoredSubs);
    await sendTelegramMessage(`🗑 Removed r/${arg}.\n\nRemaining subs (${monitoredSubs.length}):\n` + monitoredSubs.map(s => '• r/' + s).join('\n'));
  } else if (cmd === '/list') {
    await sendTelegramMessage(`📋 Currently monitored subreddits (${monitoredSubs.length}):\n\n` + monitoredSubs.map(s => '• r/' + s).join('\n') + `\n\nTip: Send /add [sub] or /remove [sub] anytime!`);
  } else if (cmd === '/help') {
    await sendTelegramMessage(`💡 Bot Commands:\n\n/list - View monitored subreddits\n/add [sub] - Add a subreddit (e.g. /add SideJobs)\n/remove [sub] - Remove a subreddit\n/status - Check scout health`);
  } else if (cmd === '/status') {
    await sendTelegramMessage(`⚡ Bot is running live!\nTotal subreddits: ${monitoredSubs.length}\nCheck interval: ${INTERVAL_MS / 1000}s\nSeen posts: ${seenPosts.size}`);
  }
}

function parseXmlEntries(xml) {
  const entries = [];
  const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
  let match;
  while ((match = entryRegex.exec(xml)) !== null) {
    const block = match[1];
    const idMatch = block.match(/<id>([\s\S]*?)<\/id>/);
    const titleMatch = block.match(/<title>([\s\S]*?)<\/title>/);
    const linkMatch = block.match(/<link href="([^"]+)"/);
    const contentMatch = block.match(/<content[^>]*>([\s\S]*?)<\/content>/);

    const id = idMatch ? idMatch[1].trim() : Math.random().toString();
    const title = titleMatch ? titleMatch[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').trim() : '';
    const link = linkMatch ? linkMatch[1] : '';
    let content = contentMatch ? contentMatch[1] : '';
    content = content.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#32;/g, ' ').replace(/\s+/g, ' ').trim();

    entries.push({ id, title, link, content });
  }
  return entries;
}

function fetchSubredditRss(sub) {
  return new Promise((resolve) => {
    const req = https.request({
      hostname: 'www.reddit.com',
      path: '/r/' + sub + '/new/.rss?limit=25',
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const entries = parseXmlEntries(data);
          resolve(entries);
        } catch (e) { resolve([]); }
      });
    });
    req.on('error', () => resolve([]));
    req.setTimeout(8000, () => { req.destroy(); resolve([]); });
    req.end();
  });
}

function matchJob(entry, sub) {
  const title = (entry.title || '').toLowerCase();
  const text = (entry.content || '').toLowerCase();
  const full = title + ' ' + text;

  // STRICT HIRING FILTER: Exclude freelancers offering services, job seekers, and discussions
  if (title.includes('[for hire]') || title.includes('[forhire]') || title.includes('[offer]') || title.includes('for hire')) {
    return null;
  }

  // Exclude common discussion / career question posts on subreddits like jobbit
  if (title.includes('career gap') || title.includes('is landing a job') || title.includes('0 callbacks') || title.includes('how to increase') || title.includes('is that normal')) {
    return null;
  }

  // Positive hiring check
  const isHiring = title.includes('[hiring]') || 
                  title.includes('hiring') || 
                  title.includes('[task]') || 
                  title.includes('paying') || 
                  title.includes('looking for a developer') || 
                  title.includes('need a developer') ||
                  title.includes('looking to hire');

  // For subs where people post both offers and tasks
  if (!isHiring && (sub.toLowerCase() === 'forhire' || sub.toLowerCase() === 'slavelabour' || sub.toLowerCase() === 'freelance_forhire' || sub.toLowerCase() === 'jobbit')) {
    return null;
  }

  for (const rule of SKILL_RULES) {
    for (const kw of rule.keywords) {
      if (full.includes(kw)) {
        return { category: rule.category, keywordMatched: kw, pitch: rule.pitch(entry.title, sub) };
      }
    }
  }
  return null;
}

async function checkSubreddits() {
  console.log(`[${new Date().toLocaleTimeString()}] Scouting Reddit (${monitoredSubs.length} subs)...`);
  let alertCount = 0;
  for (const sub of [...monitoredSubs]) {
    try {
      const entries = await fetchSubredditRss(sub);
      for (const entry of entries) {
        if (!seenPosts.has(entry.id)) {
          addSeenPost(entry.id);
          const match = matchJob(entry, sub);
          if (match) {
            console.log(`🎯 MATCH in r/${sub}: ${entry.title}`);
            const preview = entry.content.slice(0, 300).trim();
            const msg = [
              '🚨 NEW GIG DETECTED!',
              '━━━━━━━━━━━━━━━━━━━',
              '📌 Title: ' + entry.title,
              '📍 Subreddit: r/' + sub,
              '🏷 Category: ' + match.category + ' (' + match.keywordMatched + ')',
              '🔗 Link: ' + entry.link,
              '━━━━━━━━━━━━━━━━━━━',
              '📝 Post Details:\n' + (preview ? preview + '...' : '(No details)'),
              '━━━━━━━━━━━━━━━━━━━',
              '⚡ READY PITCH (Copy & Send):\n\n' + match.pitch
            ].join('\n\n');
            await sendTelegramMessage(msg);
            alertCount++;
            await new Promise(r => setTimeout(r, 1200));
          }
        }
      }
    } catch (e) { console.error(`Error r/${sub}:`, e.message); }
    await new Promise(r => setTimeout(r, 1200));
  }
  if (isFirstRun) {
    console.log(`✅ Initial scan done! Sent ${alertCount} alerts. Monitoring live...`);
    isFirstRun = false;
  }
}

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    status: 'online',
    scouting: monitoredSubs,
    postsTracked: seenPosts.size
  }));
});

server.listen(PORT, () => {
  console.log(`🌐 Web/Health check server listening on port ${PORT}`);
});

async function main() {
  console.log('🤖 Goodness Reddit Gig Scout is running...');
  console.log('Monitored subreddits:', monitoredSubs.join(', '));
  console.log(`Check interval: ${INTERVAL_MS / 1000}s`);

  pollTelegramCommands();

  await checkSubreddits();
  setInterval(checkSubreddits, INTERVAL_MS);
}

main();