# ShowUp 🎵
Your personal concert radar. Track artists, discover upcoming shows, never miss a gig.

## Deploy in ~10 minutes

### 1. Push to GitHub
1. Go to [github.com](https://github.com) → **New repository** → name it `showup`
2. Don't initialize with README (you already have files)
3. Follow the commands GitHub shows you, something like:
```bash
cd showup
git init
git add .
git commit -m "initial commit"
git remote add origin https://github.com/YOUR_USERNAME/showup.git
git push -u origin main
```

### 2. Deploy on Vercel
1. Go to [vercel.com](https://vercel.com) → **Add New Project**
2. Import your `showup` GitHub repo
3. Framework will auto-detect as **Vite** — leave defaults as-is
4. Before clicking Deploy, click **Environment Variables** and add:
   - Key: `TM_API_KEY`
   - Value: `yMEDuXbDyj9Mz1YADSgEJB67yiG1VOXt`
5. Click **Deploy**

That's it. Vercel gives you a live URL like `showup.vercel.app`.

---

## Project structure
```
showup/
├── api/
│   └── events.js        ← Serverless function (Ticketmaster proxy)
├── src/
│   ├── main.jsx         ← React entry point
│   └── App.jsx          ← Main app
├── index.html
├── package.json
├── vite.config.js
└── vercel.json
```

## How it works
- **Frontend**: React + Vite, styled with inline styles, localStorage for persistence
- **Backend**: Single Vercel serverless function at `/api/events` that proxies Ticketmaster
- **AI**: Claude API for the Ask AI tab (uses the built-in Anthropic API key from the artifact)

## Updating the app
Any push to `main` on GitHub auto-deploys to Vercel.

## Custom domain
In Vercel project settings → Domains → add your domain.
