// ============================================================
//  Vercel Serverless Function — /api/chat
//  Securely proxies chat requests to the Google Gemini API.
//  The API key lives ONLY on the server (environment variable),
//  so it is never exposed in the browser.
//
//  Setup:
//    1. Get a free key at https://aistudio.google.com/app/apikey
//    2. In your Vercel project → Settings → Environment Variables,
//       add:  GEMINI_API_KEY = AIza...
//    3. Redeploy. That's it.
//
//  Local dev:  create a .env file with GEMINI_API_KEY=... and
//              run `vercel dev`.
// ============================================================

const GEMINI_MODEL = 'gemini-2.0-flash';

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

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: 'Server is not configured. Missing GEMINI_API_KEY environment variable.'
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

    // Map our {role, content} history to Gemini's format.
    // Gemini uses the role "model" for assistant turns.
    const contents = messages.map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: String(m.content || '') }]
    }));

    const endpoint =
      'https://generativelanguage.googleapis.com/v1beta/models/' +
      GEMINI_MODEL + ':generateContent?key=' + encodeURIComponent(apiKey);

    const geminiRes = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: contents,
        generationConfig: { maxOutputTokens: 600, temperature: 0.7 }
      })
    });

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error('Gemini API error:', geminiRes.status, errText);
      return res.status(502).json({ error: 'Upstream API error.' });
    }

    const data = await geminiRes.json();
    const reply =
      (data.candidates &&
        data.candidates[0] &&
        data.candidates[0].content &&
        data.candidates[0].content.parts &&
        data.candidates[0].content.parts[0] &&
        data.candidates[0].content.parts[0].text)
        ? data.candidates[0].content.parts[0].text
        : "Sorry, I couldn't generate a response.";

    return res.status(200).json({ reply });
  } catch (err) {
    console.error('Serverless function error:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}
