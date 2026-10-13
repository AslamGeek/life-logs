module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed.' });

  const appsScriptUrl = process.env.APPS_SCRIPT_URL;
  if (!appsScriptUrl) return res.status(503).json({ ok: false, error: 'Missing Vercel environment variable: APPS_SCRIPT_URL.' });

  const { method, args = [] } = req.body || {};
  const allowed = new Set(['getAppData', 'saveActivity', 'saveEvent', 'deleteEvent']);
  if (!allowed.has(method) || !Array.isArray(args)) {
    return res.status(400).json({ ok: false, error: 'Invalid tracker request.' });
  }

  try {
    const upstream = await fetch(appsScriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ method, args }),
      redirect: 'follow'
    });
    const text = await upstream.text();
    let payload;
    try { payload = JSON.parse(text); }
    catch { throw new Error(`Apps Script returned HTTP ${upstream.status} instead of JSON.`); }
    if (!upstream.ok || !payload.ok) throw new Error(payload.error || 'Apps Script request failed.');
    return res.status(200).json(payload);
  } catch (error) {
    return res.status(502).json({ ok: false, error: error.message || 'Could not reach Apps Script.' });
  }
};
