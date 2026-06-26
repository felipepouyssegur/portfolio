// ============================================================
//  Vercel Serverless Function — /api/chat
//  Securely proxies chat requests to the Anthropic Messages API.
//  The API key lives ONLY on the server (environment variable),
//  so it is never exposed in the browser.
//
//  Setup:
//    1. In your Vercel project → Settings → Environment Variables,
//       add:  ANTHROPIC_API_KEY = sk-ant-...
//    2. Redeploy. That's it.
//
//  Local dev:  create a .env file with ANTHROPIC_API_KEY=... and
//              run `vercel dev`.
// ============================================================

const ANTHROPIC_MODEL = 'claude-sonnet-4-6';

// System prompt that defines the assistant's knowledge and behavior.
const SYSTEM_PROMPT = `You are Felipe Pouysségur's portfolio assistant. Answer questions about Felipe concisely and professionally. Here is everything you need to know about him:

Felipe is a Test Automation Engineer at Accenture with 4 years of IT experience, specialized in Tricentis Tosca and Playwright with Python. He has a background in full-stack development (JavaScript, React, Node.js). He is actively exploring agentic AI and large language models. English level C1.

He led the migration from Tosca to Playwright with Python at Banco Patagonia, incorporating agentic AI and MCP into automation workflows. He independently automated a complete banking channel from scratch. He built personal AI-powered tools including a Prompt Improver and an Excel Reader Agent using the Claude API.

He started his career in Law, then switched to IT in 2022 — self-taught JavaScript via Argentina Programa, completed a full-stack development program at Coderhouse, and joined Accenture through a testing bootcamp.

Personal projects include CHAT XP (real-time chat with React and Firebase), TYPING GAME, DELIGHT and LOTUS SHOP (e-commerce apps), and KURT BURGERS (landing page).

He is based in Mar del Plata, Argentina. Contact: felipepouyssegur@hotmail.com

Only answer questions related to Felipe's professional profile. Be concise. If asked something unrelated, redirect politely.`;

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: 'Server is not configured. Missing ANTHROPIC_API_KEY environment variable.'
    });
  }

  try {
    // Vercel parses JSON bodies automatically; fall back just in case.
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const messages = body && Array.isArray(body.messages) ? body.messages : null;

    // Basic validation of the conversation payload
    if (!messages || messages.length === 0) {
      return res.status(400).json({ error: 'Invalid request: "messages" array is required.' });
    }

    // Forward the request to the Anthropic Messages API
    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: 600,
        system: SYSTEM_PROMPT,
        messages: messages
      })
    });

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text();
      console.error('Anthropic API error:', anthropicRes.status, errText);
      return res.status(502).json({ error: 'Upstream API error.' });
    }

    const data = await anthropicRes.json();
    const reply = (data.content && data.content[0] && data.content[0].text)
      ? data.content[0].text
      : "Sorry, I couldn't generate a response.";

    return res.status(200).json({ reply });
  } catch (err) {
    console.error('Serverless function error:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}
