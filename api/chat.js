// ============================================================
//  Vercel Serverless Function — /api/chat
//  Securely proxies chat requests to the Groq API (OpenAI-compatible).
//  The API key lives ONLY on the server (environment variable),
//  so it is never exposed in the browser.
//
//  Setup:
//    1. Get a free key (no credit card) at https://console.groq.com/keys
//    2. In your Vercel project → Settings → Environment Variables,
//       add:  GROQ_API_KEY = gsk_...
//    3. Redeploy. That's it.
//
//  Local dev:  create a .env file with GROQ_API_KEY=... and
//              run `vercel dev`.
// ============================================================

const GROQ_MODEL = 'llama-3.3-70b-versatile';

// System prompt that defines the assistant's knowledge and behavior.
const SYSTEM_PROMPT = `You are Felipe Pouysségur's portfolio assistant. Answer questions about Felipe concisely and professionally. Here is everything you need to know about him:

Felipe is a Test Automation Engineer at Accenture with 4 years of IT experience, specialized in Tricentis Tosca and Playwright with Python. He has a background in full-stack development (JavaScript, React, Node.js). He is actively exploring agentic AI and large language models. English level C1.

He led the migration from Tosca to Playwright with Python at Banco Patagonia, incorporating agentic AI and MCP into automation workflows. He independently automated a complete banking channel from scratch. He built personal AI-powered tools including a Prompt Improver and an Excel Reader Agent.

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

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: 'Server is not configured. Missing GROQ_API_KEY environment variable.'
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

    // Groq uses the OpenAI chat format: a system message followed by the
    // user/assistant turns (which already match our {role, content} shape).
    const chatMessages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...messages.map((m) => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: String(m.content || '')
      }))
    ];

    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: chatMessages,
        max_tokens: 600,
        temperature: 0.7
      })
    });

    if (!groqRes.ok) {
      const errText = await groqRes.text();
      console.error('Groq API error:', groqRes.status, errText);
      return res.status(502).json({ error: 'Upstream API error.' });
    }

    const data = await groqRes.json();
    const reply =
      (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content)
        ? data.choices[0].message.content
        : "Sorry, I couldn't generate a response.";

    return res.status(200).json({ reply });
  } catch (err) {
    console.error('Serverless function error:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}
