// Pithonix GCC Playbook — One-click partner approval from email
// Opens in browser from email button click — returns HTML page

import { Resend } from 'resend';
import pg from 'pg';

const { Pool } = pg;
let pool;
function getPool() {
  if (!pool) pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 1 });
  return pool;
}

function page(title, heading, body, color) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} — Pithonix</title>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;600;700&display=swap" rel="stylesheet">
<style>
  body{font-family:'DM Sans',sans-serif;background:#0a0f1e;color:#f1f5f9;margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:2rem}
  .card{background:#0d1426;border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:3rem 2.5rem;max-width:480px;width:100%;text-align:center}
  .icon{font-size:3.5rem;margin-bottom:1rem}
  h1{font-size:1.5rem;margin-bottom:0.75rem;color:${color}}
  p{color:#94a3b8;line-height:1.7;margin-bottom:1.5rem}
  a{display:inline-block;background:#0f172a;border:1px solid rgba(255,255,255,0.1);color:#f1f5f9;padding:0.75rem 2rem;border-radius:8px;text-decoration:none;font-weight:600;font-size:0.9rem}
</style>
</head>
<body>
<div class="card">
  ${body}
  <a href="https://gcc-playbook.pithonix.ai">Back to GCC Playbook</a>
</div>
</body>
</html>`;
}

function buildApprovedEmail(name, company, category, id) {
  return `
  <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:0 auto;background:#f8fafc;padding:24px">
    <div style="background:#0f172a;padding:22px 28px;border-radius:12px 12px 0 0">
      <p style="margin:0;color:#94a3b8;font-size:11px;letter-spacing:2px;text-transform:uppercase">Pithonix GCC Platform</p>
      <h2 style="margin:8px 0 0;color:#fff;font-size:22px">Welcome to the Partner Network</h2>
    </div>
    <div style="background:#fff;padding:28px;border-radius:0 0 12px 12px;border:1px solid #e2e8f0;border-top:none">
      <p style="color:#374151;font-size:14px">Hi ${name},</p>
      <p style="color:#374151;font-size:14px;line-height:1.6">We are pleased to welcome <strong>${company}</strong> to the Pithonix GCC Co-Delivery Partner Network as a verified <strong>${category || 'Partner'}</strong>.</p>
      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:16px 20px;margin:20px 0;text-align:center">
        <p style="margin:0;color:#166534;font-size:14px;font-weight:600">Your profile is now live on the GCC Playbook platform.</p>
      </div>
      <p style="color:#374151;font-size:14px;line-height:1.6">You are now part of India's first AI-native GCC intelligence platform. Our team will be in touch with project details and lead introductions as GCC setup opportunities come in for your domain.</p>
      <p style="color:#374151;font-size:14px;line-height:1.6">You can track your status anytime at:</p>
      <div style="text-align:center;margin-top:12px">
        <a href="https://gcc-playbook.pithonix.ai/partner-portal" style="display:inline-block;background:#22c55e;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:700">View Your Partner Profile</a>
      </div>
      <p style="color:#94a3b8;font-size:11px;margin-top:28px;border-top:1px solid #f1f5f9;padding-top:16px">PITHONIX AI INDIA PRIVATE LIMITED | CIN: U62090TS2026PTC213220 | Hyderabad, Telangana | pithonix.ai</p>
    </div>
  </div>`;
}

function buildRemovedEmail(name, company) {
  return `
  <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:0 auto;background:#f8fafc;padding:24px">
    <div style="background:#0f172a;padding:22px 28px;border-radius:12px 12px 0 0">
      <p style="margin:0;color:#94a3b8;font-size:11px;letter-spacing:2px;text-transform:uppercase">Pithonix GCC Platform</p>
      <h2 style="margin:8px 0 0;color:#fff;font-size:22px">Partnership Status Update</h2>
    </div>
    <div style="background:#fff;padding:28px;border-radius:0 0 12px 12px;border:1px solid #e2e8f0;border-top:none">
      <p style="color:#374151;font-size:14px">Hi ${name},</p>
      <p style="color:#374151;font-size:14px;line-height:1.6">We are writing to let you know that <strong>${company}</strong> has been removed from the active Pithonix GCC Ecosystem listing. This may be due to a category restructure, renewal lapse, or a mutual decision.</p>
      <p style="color:#374151;font-size:14px;line-height:1.6">If you believe this was done in error or would like to discuss reinstatement, please reach out to us directly at <a href="mailto:partnerships@pithonix.ai" style="color:#3b82f6">partnerships@pithonix.ai</a>.</p>
      <p style="color:#94a3b8;font-size:11px;margin-top:28px;border-top:1px solid #f1f5f9;padding-top:16px">PITHONIX AI INDIA PRIVATE LIMITED | CIN: U62090TS2026PTC213220 | Hyderabad, Telangana | pithonix.ai</p>
    </div>
  </div>`;
}

function buildRejectedEmail(name, company) {
  return `
  <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:0 auto;background:#f8fafc;padding:24px">
    <div style="background:#0f172a;padding:22px 28px;border-radius:12px 12px 0 0">
      <p style="margin:0;color:#94a3b8;font-size:11px;letter-spacing:2px;text-transform:uppercase">Pithonix GCC Platform</p>
      <h2 style="margin:8px 0 0;color:#fff;font-size:22px">Partnership Application Update</h2>
    </div>
    <div style="background:#fff;padding:28px;border-radius:0 0 12px 12px;border:1px solid #e2e8f0;border-top:none">
      <p style="color:#374151;font-size:14px">Hi ${name},</p>
      <p style="color:#374151;font-size:14px;line-height:1.6">Thank you for your interest in joining the Pithonix GCC Partner Network. After reviewing your application from <strong>${company}</strong>, we are unable to move forward at this time.</p>
      <p style="color:#374151;font-size:14px;line-height:1.6">This may be because the category is already filled in your region, or because we need more information. You are welcome to reapply in the future or reach out to us directly at <a href="mailto:info@pithonix.ai" style="color:#3b82f6">info@pithonix.ai</a> for more details.</p>
      <p style="color:#94a3b8;font-size:11px;margin-top:28px;border-top:1px solid #f1f5f9;padding-top:16px">PITHONIX AI INDIA PRIVATE LIMITED | Hyderabad, Telangana | pithonix.ai</p>
    </div>
  </div>`;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') { res.status(405).end(); return; }

  const { id, token, action } = req.query || {};

  if (!id || !token || !['approve', 'reject', 'remove'].includes(action)) {
    res.setHeader('Content-Type', 'text/html');
    res.status(400).send(page('Invalid Link', 'Invalid Link',
      '<div class="icon">⚠️</div><h1>Invalid Link</h1><p>This approval link is invalid or has expired. Please check your email for the correct link.</p>',
      '#f87171'));
    return;
  }

  if (!process.env.DATABASE_URL) {
    res.setHeader('Content-Type', 'text/html');
    res.status(500).send(page('Error', 'Server Error',
      '<div class="icon">❌</div><h1>Server Error</h1><p>Database not configured. Please contact your developer.</p>',
      '#f87171'));
    return;
  }

  let partner;
  try {
    const client = await getPool().connect();
    try {
      const check = await client.query(
        'SELECT id, company_name, contact_name, email, backup_email, partner_category, status FROM gcc_partner_applications WHERE id = $1 AND approval_token = $2',
        [parseInt(id), token]
      );
      if (check.rows.length === 0) {
        res.setHeader('Content-Type', 'text/html');
        res.status(404).send(page('Invalid Link', 'Not Found',
          '<div class="icon">🔍</div><h1>Link Not Found</h1><p>This approval link is invalid or has already been used. Check the Neon database for the current status.</p>',
          '#fbbf24'));
        return;
      }
      partner = check.rows[0];

      // Allow remove action on already-approved partners
      if (action === 'remove') {
        if (partner.status === 'Removed') {
          res.setHeader('Content-Type', 'text/html');
          res.status(200).send(page('Already Removed', 'Already Removed',
            `<div class="icon">🗑️</div><h1>Already Removed</h1><p><strong>${partner.company_name}</strong> was already removed from the ecosystem.</p>`,
            '#94a3b8'));
          return;
        }
        await client.query(
          `UPDATE gcc_partner_applications SET status = 'Removed', approved_at = NULL WHERE id = $1`,
          [parseInt(id)]
        );
        // Send delist notification to partner
        if (process.env.RESEND_API_KEY) {
          try {
            const resend = new Resend(process.env.RESEND_API_KEY);
            const toEmails = [partner.email];
            if (partner.backup_email) toEmails.push(partner.backup_email);
            await resend.emails.send({
              from: 'Pithonix GCC Platform <info@pithonix.ai>',
              to: toEmails,
              subject: `Partnership Update — ${partner.company_name}`,
              html: buildRemovedEmail(partner.contact_name, partner.company_name)
            });
          } catch(e) { console.error('Email error:', e.message); }
        }
        res.setHeader('Content-Type', 'text/html');
        res.status(200).send(page('Partner Removed', 'Partner Removed',
          `<div class="icon">🗑️</div><h1>Partner Removed</h1><p><strong>${partner.company_name}</strong> has been delisted from the GCC ecosystem. They have been notified by email.</p>`,
          '#f87171'));
        return;
      }

      if (partner.status === 'Approved' || partner.status === 'Rejected') {
        const editUrl = `https://gcc-playbook.pithonix.ai/api/partner-edit?id=${id}&token=${token}`;
        const removeUrl = `https://gcc-playbook.pithonix.ai/api/partner-approve?id=${id}&token=${token}&action=remove`;
        res.setHeader('Content-Type', 'text/html');
        res.status(200).send(page('Already Processed', 'Already Done',
          `<div class="icon">${partner.status === 'Approved' ? '✅' : '❌'}</div><h1>Already ${partner.status}</h1><p>This application from <strong>${partner.company_name}</strong> was already ${partner.status.toLowerCase()}.</p>
          <a href="${editUrl}" style="margin-top:0.75rem;background:rgba(59,130,246,0.15);border-color:rgba(59,130,246,0.4);color:#93c5fd">Edit Details</a>
          ${partner.status === 'Approved' ? `<a href="${removeUrl}" onclick="return confirm('Remove ${partner.company_name} from the ecosystem?')" style="display:block;margin-top:0.75rem;background:rgba(239,68,68,0.12);border:1px solid rgba(239,68,68,0.35);color:#fca5a5;padding:0.75rem 2rem;border-radius:8px;text-decoration:none;font-weight:600;font-size:0.9rem">Remove from Ecosystem</a>` : ''}`,
          partner.status === 'Approved' ? '#22c55e' : '#f87171'));
        return;
      }

      const newStatus = action === 'approve' ? 'Approved' : 'Rejected';
      await client.query(
        `UPDATE gcc_partner_applications SET status = $1, approved_at = ${action === 'approve' ? 'NOW()' : 'NULL'} WHERE id = $2`,
        [newStatus, parseInt(id)]
      );
    } finally { client.release(); }
  } catch(e) {
    console.error('DB error:', e.message);
    res.setHeader('Content-Type', 'text/html');
    res.status(500).send(page('Error', 'Error',
      '<div class="icon">❌</div><h1>Something Went Wrong</h1><p>Could not update the application. Please try again or update via the Neon console.</p>',
      '#f87171'));
    return;
  }

  // Send confirmation email to partner
  if (process.env.RESEND_API_KEY && partner) {
    try {
      const resend = new Resend(process.env.RESEND_API_KEY);
      const toEmails = [partner.email];
      if (partner.backup_email) toEmails.push(partner.backup_email);

      if (action === 'approve') {
        await resend.emails.send({
          from: 'Pithonix GCC Platform <info@pithonix.ai>',
          to: toEmails,
          subject: `Welcome to the Pithonix Partner Network — ${partner.company_name}`,
          html: buildApprovedEmail(partner.contact_name, partner.company_name, partner.partner_category, id)
        });
      } else {
        await resend.emails.send({
          from: 'Pithonix GCC Platform <info@pithonix.ai>',
          to: toEmails,
          subject: `Partnership Application Update — ${partner.company_name}`,
          html: buildRejectedEmail(partner.contact_name, partner.company_name)
        });
      }
    } catch(e) { console.error('Email error:', e.message); }
  }

  const isApprove = action === 'approve';
  const editUrl = `https://gcc-playbook.pithonix.ai/api/partner-edit?id=${id}&token=${token}`;
  const removeUrl = `https://gcc-playbook.pithonix.ai/api/partner-approve?id=${id}&token=${token}&action=remove`;
  res.setHeader('Content-Type', 'text/html');
  res.status(200).send(page(
    isApprove ? 'Partner Approved' : 'Application Rejected',
    isApprove ? 'Partner Approved' : 'Application Rejected',
    `<div class="icon">${isApprove ? '✅' : '❌'}</div>
    <h1>${isApprove ? 'Partner Approved' : 'Application Rejected'}</h1>
    <p><strong>${partner.company_name}</strong> has been ${isApprove ? 'approved and is now live on the GCC Playbook site' : 'rejected and notified by email'}.</p>
    <a href="${editUrl}" style="background:rgba(59,130,246,0.12);border-color:rgba(59,130,246,0.35);color:#93c5fd">Edit Details</a>
    ${isApprove ? `<a href="${removeUrl}" onclick="return confirm('Remove ${partner.company_name} from the ecosystem? They will be notified by email.')" style="display:block;margin-top:0.75rem;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);color:#fca5a5;padding:0.75rem 2rem;border-radius:8px;text-decoration:none;font-weight:600;font-size:0.9rem;text-align:center">Remove from Ecosystem</a>` : ''}`,
    isApprove ? '#22c55e' : '#f87171'
  ));
}
