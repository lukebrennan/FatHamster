/* Enquiry mailer for fathamster.co.uk (Cloudflare Worker + Resend).
   The enquiry form posts JSON here. This emails Phil the details, with the board design
   (a picture, plus the SVG cutting file for Easel) attached when the visitor made one.

   Settings (Cloudflare dashboard > your worker > Settings > Variables and Secrets):
     RESEND_API_KEY   (secret)  the key from resend.com
     TO               (text)    where Phil's enquiries go, e.g. phil@example.com
     FROM             (text)    e.g. The Fat Hamster Website <enquiries@fathamster.co.uk>
     ALLOWED_ORIGINS  (text)    https://fathamster.co.uk,https://www.fathamster.co.uk
*/

const MAX_BODY = 6 * 1024 * 1024;   // 6 MB is plenty for a picture and an SVG

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clean = (s, n) => String(s == null ? '' : s).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').slice(0, n).trim();
const b64 = (str) => { const bytes = new TextEncoder().encode(str); let bin = ''; for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(bin); };

function corsHeaders(req, env) {
  const origin = req.headers.get('Origin') || '';
  const ok = (env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
  const h = { 'Vary': 'Origin' };
  if (origin && ok.includes(origin)) {
    h['Access-Control-Allow-Origin'] = origin;
    h['Access-Control-Allow-Methods'] = 'POST, OPTIONS';
    h['Access-Control-Allow-Headers'] = 'Content-Type';
    h['Access-Control-Max-Age'] = '86400';
  }
  return { h, allowed: !!origin && ok.includes(origin) };
}

const reply = (status, body, headers) => new Response(JSON.stringify(body), { status, headers: Object.assign({ 'Content-Type': 'application/json' }, headers) });

export default {
  async fetch(req, env) {
    const cors = corsHeaders(req, env);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors.h });
    if (req.method !== 'POST') return reply(405, { error: 'POST only' }, cors.h);
    if (!cors.allowed) return reply(403, { error: 'Not allowed from here' }, cors.h);

    const len = Number(req.headers.get('Content-Length') || 0);
    if (len > MAX_BODY) return reply(413, { error: 'Too big' }, cors.h);
    let d;
    try { d = JSON.parse(await req.text()); } catch (e) { return reply(400, { error: 'Bad request' }, cors.h); }

    if (d._gotcha) return reply(200, { ok: true }, cors.h);   // a bot filled the hidden field: pretend it worked

    const name = clean(d.name, 120), email = clean(d.email, 200), interest = clean(d.interest, 120), message = clean(d.message, 4000);
    if (!name || !/^\S+@\S+\.\S+$/.test(email)) return reply(400, { error: 'Name and a valid email are needed' }, cors.h);
    if (!env.RESEND_API_KEY || !env.TO || !env.FROM) return reply(500, { error: 'Mailer is not set up' }, cors.h);

    const design = d.design && typeof d.design === 'object' ? d.design : null;
    const attachments = [];
    let designHtml = '', designText = '';
    if (design) {
      const link = clean(design.url, 4000);
      const summary = clean(design.summary, 600);
      const rows = (Array.isArray(design.details) ? design.details : []).slice(0, 12)
        .map((r) => [clean(r && r[0], 40), clean(r && r[1], 200)]).filter((r) => r[0]);
      let inline = false;
      if (typeof design.jpeg === 'string' && /^[A-Za-z0-9+/=]+$/.test(design.jpeg) && design.jpeg.length < 4000000) {
        attachments.push({ filename: 'board-preview.jpg', content: design.jpeg, content_id: 'board', content_type: 'image/jpeg' });
        inline = true;
      }
      if (typeof design.svg === 'string' && design.svg.startsWith('<?xml') && design.svg.length < 600000) {
        attachments.push({ filename: clean(design.name, 80).replace(/[^\w.-]+/g, '-') || 'fat-hamster-design.svg', content: b64(design.svg) });
      }
      designHtml = '<h3 style="margin:24px 0 8px">Board design</h3>' +
        (inline ? '<p style="margin:0 0 12px"><img src="cid:board" alt="The board design" width="560" style="max-width:100%;height:auto;border-radius:8px"></p>' : '') +
        (rows.length ? '<table style="border-collapse:collapse;font-size:15px">' + rows.map((r) => '<tr><td style="padding:3px 16px 3px 0;color:#666">' + esc(r[0]) + '</td><td style="padding:3px 0"><strong>' + esc(r[1]) + '</strong></td></tr>').join('') + '</table>'
          : (summary ? '<p style="margin:0">' + esc(summary) + '</p>' : '')) +
        (link ? '<p style="margin:12px 0 0"><a href="' + esc(link) + '">Open this design in the designer</a></p>' : '') +
        (attachments.some((a) => /\.svg$/.test(a.filename)) ? '<p style="margin:8px 0 0;color:#666">The SVG is attached. Drag it into Easel.</p>' : '');
      designText = '\n\nBoard design:\n' + (rows.length ? rows.map((r) => r[0] + ': ' + r[1]).join('\n') : summary) + (link ? '\nOpen it: ' + link : '') + (attachments.length ? '\nAttached: ' + attachments.map((a) => a.filename).join(', ') : '');
    }

    const subject = (design ? 'Board design enquiry: ' : 'Website enquiry: ') + (design && design.summary ? clean(design.summary, 70) : (interest || 'Something else')) + ' (' + name + ')';
    const html = '<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.5;color:#222">' +
      '<p style="margin:0 0 4px"><strong>' + esc(name) + '</strong> &lt;' + esc(email) + '&gt;</p>' +
      '<p style="margin:0 0 16px;color:#666">Interested in: ' + esc(interest || 'Something else') + '</p>' +
      (message ? '<div style="white-space:pre-wrap;border-left:3px solid #c9a56a;padding-left:12px">' + esc(message) + '</div>' : '') +
      designHtml +
      '<p style="margin:24px 0 0;color:#888;font-size:13px">Hit reply to answer ' + esc(name) + ' directly.</p></div>';
    const text = name + ' <' + email + '>\nInterested in: ' + (interest || 'Something else') + (message ? '\n\n' + message : '') + designText;

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + env.RESEND_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: env.FROM, to: [env.TO], reply_to: email, subject, html, text, attachments })
    });
    if (!res.ok) return reply(502, { error: 'Could not send' }, cors.h);
    return reply(200, { ok: true }, cors.h);
  }
};
