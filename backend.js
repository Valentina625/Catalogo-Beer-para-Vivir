export default async function handler(req, res) {
  const scriptUrl = process.env.APPS_SCRIPT_URL;
  if (!scriptUrl) return res.status(500).json({ error: 'Falta configurar APPS_SCRIPT_URL en Vercel.' });
  const action = String(req.query.action || '');
  const allowed = ['productos', 'proveedores', 'validarCupon', 'guardarPedido'];
  if (!allowed.includes(action)) return res.status(400).json({ error: 'Acción no permitida.' });
  try {
    const target = new URL(scriptUrl);
    target.searchParams.set('action', action);
    if (req.method === 'GET' && action === 'validarCupon') target.searchParams.set('codigo', String(req.query.codigo || ''));
    else if (req.method !== 'GET' && !(req.method === 'POST' && action === 'guardarPedido')) return res.status(405).json({ error: 'Método no permitido.' });
    const response = await fetch(target.toString(), { method: req.method, headers: req.method === 'POST' ? { 'Content-Type': 'application/json' } : undefined, body: req.method === 'POST' ? JSON.stringify(req.body || {}) : undefined, redirect: 'follow' });
    const raw = await response.text();
    let data;
    try { data = JSON.parse(raw); } catch { throw new Error('Apps Script no devolvió JSON. Revisá la URL y los permisos de implementación.'); }
    if (data && data.error) return res.status(400).json(data);
    return res.status(200).json(data);
  } catch (error) { return res.status(502).json({ error: error.message || 'Error de conexión con Apps Script.' }); }
}
