// Escensus — Talk-mode L3 AI scoring.
// -----------------------------------------------------------------------------
// Receives the agent's spoken turns from the Role-play sim, transcribes each with
// AssemblyAI, and grades each line against the model move with Claude. Returns
// per-line grades + an overall score.
//
// This runs ONLY on a server (Netlify Functions / any Node serverless host) — the
// GitHub Pages build can't run it, which is why the client falls back gracefully
// when SCORE_ENDPOINT is empty. To go live:
//   1. Deploy this repo to Netlify (functions dir = netlify/functions).
//   2. Set env vars:  ASSEMBLYAI_API_KEY  and  ANTHROPIC_API_KEY
//   3. In public/train/roleplay/index.html set  SCORE_ENDPOINT = '/.netlify/functions/score'
// Keys live here on the server, never in the client.
//
// Request body: { turns: [ { beat, model, audio } ] }  where audio is a data: URL.
// Response:     { overall, summary, turns: [ { beat, grade, note } ] }

const AAI = 'https://api.assemblyai.com/v2';
const ANTHROPIC = 'https://api.anthropic.com/v1/messages';
const CLAUDE_MODEL = 'claude-sonnet-5'; // swap to any current Claude model id

function json(statusCode, obj) {
  return { statusCode, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(obj) };
}

// --- AssemblyAI: upload one clip + transcribe (poll to completion) ---
async function transcribe(dataUrl, key) {
  const b64 = String(dataUrl || '').split(',')[1] || '';
  const bytes = Buffer.from(b64, 'base64');
  if (!bytes.length) return '';

  const up = await fetch(`${AAI}/upload`, {
    method: 'POST',
    headers: { authorization: key, 'content-type': 'application/octet-stream' },
    body: bytes,
  });
  if (!up.ok) throw new Error('upload failed');
  const { upload_url } = await up.json();

  const tr = await fetch(`${AAI}/transcript`, {
    method: 'POST',
    headers: { authorization: key, 'content-type': 'application/json' },
    body: JSON.stringify({ audio_url: upload_url }),
  });
  if (!tr.ok) throw new Error('transcript create failed');
  const { id } = await tr.json();

  // poll (short clips finish fast)
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 1500));
    const st = await fetch(`${AAI}/transcript/${id}`, { headers: { authorization: key } });
    const data = await st.json();
    if (data.status === 'completed') return data.text || '';
    if (data.status === 'error') throw new Error(data.error || 'transcription error');
  }
  throw new Error('transcription timed out');
}

// --- Claude: grade the whole call from transcripts vs model moves ---
async function grade(turns, key) {
  const rubric = turns
    .map((t, i) => `Turn ${i + 1} — ${t.beat}\n  Model (a strong version): ${t.model}\n  Agent actually said: ${t.said || '(nothing captured)'}`)
    .join('\n\n');

  const prompt =
    `You are a final-expense sales trainer grading an agent's practice call. For each turn, ` +
    `compare what the agent SAID to the model move for that beat. Grade on intent, structure, ` +
    `and delivery — not word-for-word matching. Be encouraging but honest.\n\n` +
    `${rubric}\n\n` +
    `Respond with ONLY valid JSON, no prose:\n` +
    `{"overall": <0-100>, "summary": "<one sentence>", "turns": [{"beat": "<beat>", "grade": "<A|B|C>", "note": "<short, specific>"}]}`;

  const res = await fetch(ANTHROPIC, {
    method: 'POST',
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: CLAUDE_MODEL, max_tokens: 1024, messages: [{ role: 'user', content: prompt }] }),
  });
  if (!res.ok) throw new Error('claude request failed');
  const data = await res.json();
  const text = (data.content && data.content[0] && data.content[0].text) || '';
  const match = text.match(/\{[\s\S]*\}/);
  return JSON.parse(match ? match[0] : text);
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return json(200, {});
  if (event.httpMethod !== 'POST') return json(405, { error: 'POST only' });

  const AAI_KEY = process.env.ASSEMBLYAI_API_KEY;
  const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
  if (!AAI_KEY || !ANTHROPIC_KEY) return json(500, { error: 'Scoring keys not configured' });

  let turns;
  try { turns = (JSON.parse(event.body || '{}').turns) || []; } catch (e) { return json(400, { error: 'bad body' }); }
  if (!turns.length) return json(400, { error: 'no turns' });

  try {
    // transcribe each turn (in parallel), then grade the whole call in one call
    await Promise.all(turns.map(async (t) => { t.said = await transcribe(t.audio, AAI_KEY); }));
    const result = await grade(turns, ANTHROPIC_KEY);
    return json(200, result);
  } catch (e) {
    return json(502, { error: String((e && e.message) || e) });
  }
};
