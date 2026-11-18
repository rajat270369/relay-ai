# Relay AI — Internship Assessment (Phase 2)

A mobile-responsive email-management prototype for personal assistants and their clients. The inbox uses **fictional sample data**. A Node/Express API now stores demo conversations and optionally calls the OpenAI Responses API for email classification, conversation summaries and reply drafting.

**Not production software:** login, Gmail/Outlook connections and actual email sending are simulated. There is no multi-user authentication, account isolation, real calendar integration or actual mailbox access.

## Requirements

- Node.js 20.19+ or 22.12+
- npm
- Optional: OpenAI API key with API billing/credits. A ChatGPT subscription is not an API key.

## Run locally (two terminals)

Extract the ZIP and open the folder containing `package.json`.

```bash
npm install
cp .env.example .env     # optional, only for a real AI API key
```

**Terminal 1 — backend (port 3001):**

```bash
npm run server
```

**Terminal 2 — frontend (Vite; usually port 5173):**

```bash
npm run dev
```

Open http://localhost:5173. Verify that the top-right label says **Demo inbox · server synced** (or shows the message in your app when your screen is narrow).

If the frontend says **Offline · browser demo**, check Terminal 1 and reload the browser. The UI deliberately continues to work as a local demonstration even without the backend.

## Enable actual AI (optional)

Add your own key in the root `.env` file (which is gitignored):

```dotenv
OPENAI_API_KEY=your_api_key_here
OPENAI_MODEL=gpt-4.1-mini
PORT=3001
```

Restart **Terminal 1** (`Ctrl+C`, `npm run server`). **Do not paste your key into chat, put it into a React file, commit it to GitHub, or include it in a demo video.** The key is read by Express and never returned to the browser. The API costs are billed separately from ChatGPT.

With a key, click **Simulate incoming email** or **Re-analyze** on an existing thread. The server sends the fictional email thread to OpenAI for a classification, short reason and summary. **Draft reply** can generate an editable draft too. When an API call fails, the app transparently falls back to deterministic demo logic and labels the result accordingly. Previously seeded sample summaries continue to be labeled **DEMO AI** until re-analyzed.

The application never automatically sends a drafted reply.

## What is implemented

- Responsive assistant dashboard with conversation search, category filters, stats and message details
- Minimal client portal: review, delegate or mark handled; updates persist on the server and affect the assistant view
- Conversation flags: unread, important, archived, completed, manual responsibility overrides
- Express API routes for loading/updating email records, simulating incoming email and follow-ups, reclassification, and draft generation
- Real OpenAI Responses API integration **when an API key is present**, with live/demo indicators and safe fallback
- AI model uses entire supplied conversation context, including newest external replies, not just the subject
- Demo data saved in `server/data/emails.json` (created automatically), not merely browser localStorage
- Mock Gmail/Outlook connection experience; demo email composer with copy-to-clipboard, no real email sending
- Unit tests for demo AI, mock live AI, and fallback logic

## Important limitations

- No account authorization: do **not** use real personal emails or sensitive client information.
- The backend demo data store is a JSON file; it is not MongoDB. It may reset on hosts with ephemeral filesystems.
- All visitors of a deployed demo share the same demo inbox and can reset or edit its fictional messages.
- Client and assistant role views share state within one browser session; another browser will see server updates after a refresh. There is no WebSocket live multi-user sync.
- AI confidence is a model estimate, not a calibrated probability.
- Gmail/Outlook OAuth, login, sending emails and meeting/calendar integrations remain simulated.

## Tests

```bash
npm run test:ai
npm run check
npm run build
```

## Deploy to Render (one web service)

1. Put this folder in your GitHub repo (don't commit `.env`).
2. Create a **Node Web Service**, not a static site, because this version has an Express server.
3. Build command: `npm install --include=dev && npm run build`
4. Start command: `npm start`
5. If needed, set `OPENAI_API_KEY` and `OPENAI_MODEL` as environment variables **in Render**, not in GitHub.
6. Test the deployed URL. In production, Express serves both `/api` and the Vite `dist/` build.

For the demo, the JSON database is acceptable; it is ephemeral on a standard hosting instance. You can add MongoDB persistence later if time permits.

## Two-minute demo outline

1. Click **Continue with Gmail — demo**, explain simulated connection.
2. Show dashboard, filter categories and search.
3. **Simulate incoming email**; observe automatic classification and inspect summary + explanation.
4. Click **Simulate follow-up** to reclassify a thread based on the latest message.
5. Manually reassign a thread to client and switch to client portal.
6. Client **delegates** the conversation back to assistant; show category change.
7. Generate a **reply draft**, edit it, copy it. Explicitly state sending is disabled.
8. Explain where live AI is used (or state if AI was simulated), then describe the Express API and file-based demo persistence.
