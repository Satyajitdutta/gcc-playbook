// Pithonix GCC Playbook — Edit partner application details from email
// GET: shows editable form pre-filled with current data
// POST: saves changes

import pg from 'pg';
const { Pool } = pg;
let pool;
function getPool() {
  if (!pool) pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 1 });
  return pool;
}

const CATEGORIES = [
  'Real Estate & Workspace',
  'Legal & Compliance',
  'Recruitment & Staffing',
  'IT Infrastructure',
  'Payroll & Benefits',
  'Training & L&D',
  'Banking & Finance',
  'Technology Partner'
];

function shell(title, body) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} — Pithonix</title>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'DM Sans',sans-serif;background:#0a0f1e;color:#f1f5f9;min-height:100vh;padding:2rem 1rem}
  .wrap{max-width:600px;margin:0 auto}
  .hdr{background:#0f172a;border:1px solid rgba(255,255,255,0.08);border-radius:12px 12px 0 0;padding:1.25rem 1.5rem}
  .hdr p{color:#94a3b8;font-size:11px;letter-spacing:2px;text-transform:uppercase;margin-bottom:4px}
  .hdr h2{color:#fff;font-size:1.2rem;font-weight:700}
  .hdr span{color:#38bdf8;font-size:0.8rem}
  .body{background:#0d1426;border:1px solid rgba(255,255,255,0.08);border-top:none;border-radius:0 0 12px 12px;padding:1.5rem}
  .row{margin-bottom:1rem}
  label{display:block;font-size:0.78rem;font-weight:600;color:#94a3b8;margin-bottom:0.3rem;letter-spacing:0.5px}
  input,select,textarea{width:100%;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:0.6rem 0.9rem;color:#f1f5f9;font-family:'DM Sans',sans-serif;font-size:0.88rem}
  input:focus,select:focus,textarea:focus{outline:none;border-color:#3b82f6}
  select option{background:#1e293b}
  textarea{resize:vertical;min-height:80px}
  .grid2{display:grid;grid-template-columns:1fr 1fr;gap:1rem}
  .btn{display:inline-block;padding:0.75rem 2rem;border-radius:8px;font-weight:700;font-size:0.9rem;cursor:pointer;border:none;font-family:'DM Sans',sans-serif;transition:opacity 0.2s}
  .btn-save{background:#3b82f6;color:#fff;width:100%;margin-top:0.5rem;font-size:1rem;padding:0.9rem}
  .btn-save:hover{opacity:0.88}
  .note{color:#64748b;font-size:0.78rem;margin-top:0.75rem;text-align:center}
  .msg{padding:0.75rem 1rem;border-radius:8px;margin-bottom:1rem;font-size:0.85rem}
  .msg.ok{background:rgba(34,197,94,0.1);border:1px solid rgba(34,197,94,0.3);color:#86efac}
  .msg.err{background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);color:#fca5a5}
  .back{display:inline-block;margin-top:1.25rem;color:#64748b;font-size:0.82rem;text-decoration:none}
  .back:hover{color:#94a3b8}
</style>
</head>
<body>
<div class="wrap">${body}</div>
</body>
</html>`;
}

export default async function handler(req, res) {
  const { id, token } = req.query || {};

  if (!id || !token) {
    res.setHeader('Content-Type', 'text/html');
    res.status(400).send(shell('Invalid Link', '<p style="color:#f87171;text-align:center;padding:3rem">Invalid or missing link parameters.</p>'));
    return;
  }

  if (!process.env.DATABASE_URL) {
    res.setHeader('Content-Type', 'text/html');
    res.status(500).send(shell('Error', '<p style="color:#f87171;text-align:center;padding:3rem">Database not configured.</p>'));
    return;
  }

  const client = await getPool().connect();

  try {
    // POST: save changes
    if (req.method === 'POST') {
      let body;
      try {
        if (typeof req.body === 'object') body = req.body;
        else body = JSON.parse(await new Promise((resolve) => {
          let d = ''; req.on('data', c => d += c); req.on('end', () => resolve(d));
        }));
      } catch(e) {
        res.status(400).json({ error: 'Invalid request' }); return;
      }

      const check = await client.query(
        'SELECT id FROM gcc_partner_applications WHERE id = $1 AND approval_token = $2',
        [parseInt(id), token]
      );
      if (check.rows.length === 0) {
        res.status(403).json({ error: 'Invalid token' }); return;
      }

      await client.query(`
        UPDATE gcc_partner_applications SET
          partner_category = $1,
          cities = $2,
          description = $3,
          company_name = $4,
          contact_name = $5,
          designation = $6,
          website = $7,
          gcc_projects = $8,
          team_size = $9
        WHERE id = $10
      `, [
        body.partner_category || null,
        body.cities || null,
        body.description || null,
        body.company_name || null,
        body.contact_name || null,
        body.designation || null,
        body.website || null,
        body.gcc_projects || null,
        body.team_size || null,
        parseInt(id)
      ]);

      res.status(200).json({ success: true });
      return;
    }

    // GET: show form
    if (req.method !== 'GET') { res.status(405).end(); return; }

    const result = await client.query(
      'SELECT * FROM gcc_partner_applications WHERE id = $1 AND approval_token = $2',
      [parseInt(id), token]
    );

    if (result.rows.length === 0) {
      res.setHeader('Content-Type', 'text/html');
      res.status(404).send(shell('Not Found', '<p style="color:#f87171;text-align:center;padding:3rem">Application not found or link has expired.</p>'));
      return;
    }

    const p = result.rows[0];
    const cats = CATEGORIES.map(c =>
      `<option value="${c}"${p.partner_category === c ? ' selected' : ''}>${c}</option>`
    ).join('');

    const approveUrl = `https://gcc-playbook.pithonix.ai/api/partner-approve?id=${id}&token=${token}&action=approve`;
    const rejectUrl = `https://gcc-playbook.pithonix.ai/api/partner-approve?id=${id}&token=${token}&action=reject`;

    const html = shell(`Edit Application #${id}`, `
      <div class="hdr">
        <p>Pithonix GCC Platform</p>
        <h2>Edit Application #${id}</h2>
        <span>${p.company_name}</span>
      </div>
      <div class="body">
        <div id="msg"></div>
        <form id="editForm">
          <div class="grid2">
            <div class="row">
              <label>Company Name</label>
              <input name="company_name" value="${(p.company_name||'').replace(/"/g,'&quot;')}">
            </div>
            <div class="row">
              <label>Partner Category</label>
              <select name="partner_category"><option value="">Select</option>${cats}</select>
            </div>
          </div>
          <div class="row">
            <label>Cities / Zones</label>
            <input name="cities" value="${(p.cities||'').replace(/"/g,'&quot;')}">
          </div>
          <div class="grid2">
            <div class="row">
              <label>Contact Name</label>
              <input name="contact_name" value="${(p.contact_name||'').replace(/"/g,'&quot;')}">
            </div>
            <div class="row">
              <label>Designation</label>
              <input name="designation" value="${(p.designation||'').replace(/"/g,'&quot;')}">
            </div>
          </div>
          <div class="grid2">
            <div class="row">
              <label>Website</label>
              <input name="website" value="${(p.website||'').replace(/"/g,'&quot;')}">
            </div>
            <div class="row">
              <label>Team Size</label>
              <select name="team_size">
                <option value="">Select</option>
                ${['1 to 10','11 to 50','51 to 200','200+'].map(v=>`<option${p.team_size===v?' selected':''}>${v}</option>`).join('')}
              </select>
            </div>
          </div>
          <div class="row">
            <label>GCC Projects Handled</label>
            <select name="gcc_projects">
              <option value="">Select</option>
              ${['1 to 5','6 to 15','16 to 30','30+'].map(v=>`<option${p.gcc_projects===v?' selected':''}>${v}</option>`).join('')}
            </select>
          </div>
          <div class="row">
            <label>Services Description</label>
            <textarea name="description">${p.description||''}</textarea>
          </div>
          <button type="button" class="btn btn-save" onclick="saveChanges()">Save Changes</button>
          <p class="note">Changes are saved immediately. Then use the buttons below to approve or reject.</p>
        </form>
        <div style="display:flex;gap:0.75rem;margin-top:1.5rem">
          <a href="${approveUrl}" style="flex:1;display:block;background:#22c55e;color:#fff;padding:0.75rem;border-radius:8px;text-decoration:none;font-weight:700;font-size:0.9rem;text-align:center">Approve Partner</a>
          <a href="${rejectUrl}" style="flex:1;display:block;background:#ef4444;color:#fff;padding:0.75rem;border-radius:8px;text-decoration:none;font-weight:700;font-size:0.9rem;text-align:center">Reject Application</a>
        </div>
        <a href="https://gcc-playbook.pithonix.ai" class="back">Back to GCC Playbook</a>
      </div>
      <script>
      async function saveChanges() {
        var form = document.getElementById('editForm');
        var data = {};
        new FormData(form).forEach(function(v,k){ data[k]=v; });
        var msg = document.getElementById('msg');
        try {
          var r = await fetch('/api/partner-edit?id=${id}&token=${token}', {
            method: 'POST',
            headers: {'Content-Type':'application/json'},
            body: JSON.stringify(data)
          });
          var j = await r.json();
          if (j.success) {
            msg.innerHTML = '<div class="msg ok">Changes saved successfully.</div>';
          } else {
            msg.innerHTML = '<div class="msg err">Save failed: ' + (j.error||'unknown error') + '</div>';
          }
        } catch(e) {
          msg.innerHTML = '<div class="msg err">Save failed. Please try again.</div>';
        }
        window.scrollTo(0,0);
      }
      </script>
    `);

    res.setHeader('Content-Type', 'text/html');
    res.status(200).send(html);

  } finally {
    client.release();
  }
}
