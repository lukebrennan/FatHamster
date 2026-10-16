/* Enquiry mailer for fathamster.co.uk (Cloudflare Worker + Resend).
   The designer's Send step and the contact form post JSON here. Two branded emails go out:
     1. to Phil: the customer's details, the board picture and details, the SVG for Easel attached
     2. to the customer: a confirmation with the same picture and details, and what happens next

   Settings (Cloudflare dashboard > your worker > Settings > Variables and Secrets):
     RESEND_API_KEY   (secret)  the key from resend.com
     TO               (text)    where Phil's enquiries go, e.g. phil@example.com
     FROM             (text)    e.g. The Fat Hamster Wood Shop <enquiries@send.fathamster.co.uk>
     ALLOWED_ORIGINS  (text)    https://fathamster.co.uk,https://www.fathamster.co.uk
     TURNSTILE_SECRET (secret)  optional: the Turnstile secret key. When set, every submission
                                must pass Cloudflare's bot check.
*/

const MAX_BODY = 6 * 1024 * 1024;        // a picture and an SVG fit easily
const MAX_PER_HOUR = 6;                   // submissions per visitor per hour

const SITE = 'https://fathamster.co.uk';
const LOGO = SITE + '/assets/email-logo.png';
const INSTAGRAM = 'https://www.instagram.com/fathamsterwoodshop/';
const C = { cream: '#f6f0e4', creamDeep: '#ece3d0', paper: '#fff9ec', walnut: '#3b2f20', soft: '#5a4a36', oak: '#b9843f', oakDark: '#86591f', oakLight: '#d9a85f' };
const HEAD = "'Alfa Slab One',Georgia,'Times New Roman',serif";
const BODY = "Bitter,Georgia,'Times New Roman',serif";

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clean = (s, n) => String(s == null ? '' : s).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').slice(0, n).trim();
const b64 = (str) => { const bytes = new TextEncoder().encode(str); let bin = ''; for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(bin); };

/* ---------- email building blocks (tables and inline styles, so they hold up in Gmail, Outlook and Apple Mail) ---------- */

function shell({ preheader, label, heading, body, footer }) {
  return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<meta name="color-scheme" content="light only"><meta name="supported-color-schemes" content="light only">' +
    '<link href="https://fonts.googleapis.com/css2?family=Alfa+Slab+One&family=Bitter:wght@400;600&display=swap" rel="stylesheet">' +
    '<title>' + esc(heading) + '</title></head>' +
    '<body style="margin:0;padding:0;background:' + C.cream + ';">' +
    '<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">' + esc(preheader) + '</div>' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="' + C.cream + '" style="background:' + C.cream + ';"><tr><td align="center" style="padding:24px 12px;">' +
    '<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;">' +
      // brand header
      '<tr><td bgcolor="' + C.walnut + '" style="background:' + C.walnut + ';border-radius:16px 16px 0 0;padding:22px 28px 20px;">' +
        '<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>' +
          '<td valign="middle" style="padding-right:16px;"><a href="' + SITE + '"><img src="' + LOGO + '" width="64" height="64" alt="The Fat Hamster Wood Shop" style="display:block;width:64px;height:64px;border-radius:50%;border:0;background:#ffffff;"></a></td>' +
          '<td valign="middle"><div style="font-family:' + HEAD + ';font-size:22px;line-height:1.1;color:' + C.cream + ';">The Fat Hamster</div>' +
          '<div style="font-family:' + HEAD + ';font-size:13px;letter-spacing:3px;color:' + C.oakLight + ';padding-top:4px;">WOOD SHOP</div></td>' +
        '</tr></table>' +
      '</td></tr>' +
      '<tr><td height="4" bgcolor="' + C.oak + '" style="background:' + C.oak + ';font-size:0;line-height:0;">&nbsp;</td></tr>' +
      // card
      '<tr><td bgcolor="' + C.paper + '" style="background:' + C.paper + ';padding:32px 28px 28px;font-family:' + BODY + ';font-size:16px;line-height:1.6;color:' + C.walnut + ';">' +
        (label ? '<div style="font-family:' + BODY + ';font-size:12px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:' + C.oakDark + ';padding-bottom:8px;">' + esc(label) + '</div>' : '') +
        '<h1 style="margin:0 0 16px;font-family:' + HEAD + ';font-weight:normal;font-size:28px;line-height:1.2;color:' + C.walnut + ';">' + esc(heading) + '</h1>' +
        body +
      '</td></tr>' +
      // footer
      '<tr><td bgcolor="' + C.creamDeep + '" style="background:' + C.creamDeep + ';border-radius:0 0 16px 16px;padding:20px 28px;font-family:' + BODY + ';font-size:13px;line-height:1.6;color:' + C.soft + ';text-align:center;">' +
        (footer ? '<div style="padding-bottom:8px;">' + footer + '</div>' : '') +
        '<div><strong style="color:' + C.walnut + ';">The Fat Hamster Wood Shop</strong> &middot; Handmade in Prescot</div>' +
        '<div><a href="' + SITE + '" style="color:' + C.oakDark + ';">fathamster.co.uk</a> &middot; <a href="' + INSTAGRAM + '" style="color:' + C.oakDark + ';">Instagram</a></div>' +
      '</td></tr>' +
    '</table></td></tr></table></body></html>';
}

const button = (href, text) =>
  '<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:22px 0 4px;"><tr><td bgcolor="' + C.walnut + '" style="background:' + C.walnut + ';border-radius:999px;">' +
  '<a href="' + esc(href) + '" style="display:inline-block;padding:14px 28px;font-family:' + BODY + ';font-size:16px;font-weight:600;color:' + C.cream + ';text-decoration:none;border-radius:999px;">' + esc(text) + '</a></td></tr></table>';

const boardPicture = (inline) => inline
  ? '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:6px 0 18px;"><tr><td bgcolor="' + C.cream + '" align="center" style="background:' + C.cream + ';border-radius:14px;padding:14px;">' +
    '<img src="cid:board" alt="Your board design" width="500" style="display:block;width:100%;max-width:500px;height:auto;border-radius:10px;border:0;"></td></tr></table>'
  : '';

function detailsTable(rows) {
  if (!rows.length) return '';
  return '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 6px;">' +
    rows.map((r) => '<tr><td valign="top" style="padding:9px 12px 9px 0;border-bottom:1px dashed ' + C.creamDeep + ';font-size:14px;color:' + C.soft + ';width:34%;">' + esc(r[0]) + '</td>' +
      '<td valign="top" style="padding:9px 0;border-bottom:1px dashed ' + C.creamDeep + ';font-size:15px;font-weight:600;color:' + C.walnut + ';">' + esc(r[1]) + '</td></tr>').join('') +
    '</table>';
}

const noteBlock = (label, text) => text
  ? '<div style="margin:18px 0 0;"><div style="font-size:12px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:' + C.oakDark + ';padding-bottom:6px;">' + esc(label) + '</div>' +
    '<div style="white-space:pre-wrap;background:' + C.cream + ';border-left:4px solid ' + C.oak + ';border-radius:0 8px 8px 0;padding:12px 14px;font-size:15px;color:' + C.walnut + ';">' + esc(text) + '</div></div>'
  : '';

const sectionTitle = (t) => '<h2 style="margin:26px 0 8px;font-family:' + HEAD + ';font-weight:normal;font-size:19px;color:' + C.walnut + ';">' + esc(t) + '</h2>';

/* ---------- the two emails ---------- */

function philEmail(o) {
  const { name, email, interest, message, design, rows, inline, hasSvg } = o;
  let body =
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 4px;"><tr><td bgcolor="' + C.cream + '" style="background:' + C.cream + ';border-radius:12px;padding:14px 16px;">' +
      '<div style="font-size:17px;font-weight:600;">' + esc(name) + '</div>' +
      '<div style="font-size:15px;"><a href="mailto:' + esc(email) + '" style="color:' + C.oakDark + ';">' + esc(email) + '</a></div>' +
      '<div style="font-size:14px;color:' + C.soft + ';padding-top:4px;">Interested in: ' + esc(interest) + '</div>' +
    '</td></tr></table>' +
    noteBlock('Their message', message);
  if (design) {
    body += sectionTitle('The board') + boardPicture(inline) + detailsTable(rows);
    if (design.url) body += button(design.url, 'Open this design');
    if (hasSvg) body += '<p style="margin:14px 0 0;font-size:14px;color:' + C.soft + ';">The cutting file is attached as an SVG. Drag it into Easel: red is the cut-out, black is engraving, blue is the border line and green is the resin pocket.</p>';
  }
  body += '<p style="margin:22px 0 0;font-size:14px;color:' + C.soft + ';">Hit reply to answer ' + esc(name) + ' directly.</p>';
  return shell({
    preheader: design ? name + ' sent a board design: ' + (design.summary || '') : name + ' sent an enquiry',
    label: design ? 'New board design' : 'New enquiry',
    heading: design ? name + ' designed a board' : 'Enquiry from ' + name,
    body, footer: ''
  });
}

function customerEmail(o) {
  const { name, message, design, rows, inline } = o;
  const first = name.split(/\s+/)[0] || name;
  let body =
    '<p style="margin:0 0 12px;">Hi ' + esc(first) + ',</p>' +
    (design
      ? '<p style="margin:0 0 12px;">Thank you for sending your design. Phil has it now and will be in touch by email soon to go through the timber, size and lettering with you.</p>' +
        sectionTitle('Your design') + boardPicture(inline) + detailsTable(rows) + noteBlock('Your note to Phil', message)
      : '<p style="margin:0 0 12px;">Thank you for getting in touch. Phil has your message and will reply by email soon.</p>' + noteBlock('Your message', message)) +
    sectionTitle('What happens next') +
    '<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 4px;">' +
      [['1', design ? 'Phil looks over your design.' : 'Phil reads your message.'], ['2', 'He emails you to talk through the details and agree a price.'], ['3', 'Once you are happy, he makes it by hand in Prescot.']].map((s) =>
        '<tr><td valign="top" style="padding:5px 12px 5px 0;"><div style="width:28px;height:28px;line-height:28px;border-radius:50%;background:' + C.walnut + ';color:' + C.cream + ';text-align:center;font-weight:600;font-size:14px;">' + s[0] + '</div></td>' +
        '<td valign="middle" style="padding:5px 0;font-size:15px;">' + esc(s[1]) + '</td></tr>').join('') +
    '</table>' +
    (design && design.url ? button(design.url, 'View your design') : button(SITE, 'Visit the workshop site')) +
    '<p style="margin:18px 0 0;font-size:14px;color:' + C.soft + ';">Nothing is cut until you and Phil have agreed everything. Just reply to this email if you want to add anything.</p>';
  return shell({
    preheader: design ? 'Phil has your board design and will be in touch soon.' : 'Phil has your message and will be in touch soon.',
    label: design ? 'Design received' : 'Message received',
    heading: design ? 'We have your design' : 'Thanks for getting in touch',
    body,
    footer: 'You are getting this because you sent an enquiry through fathamster.co.uk.'
  });
}

const plainRows = (rows) => rows.map((r) => r[0] + ': ' + r[1]).join('\n');

/* ---------- plumbing ---------- */

function corsHeaders(req, env) {
  const origin = req.headers.get('Origin') || '';
  const ok = (env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
  const h = { 'Vary': 'Origin' };
  const allowed = !!origin && ok.includes(origin);
  if (allowed) {
    h['Access-Control-Allow-Origin'] = origin;
    h['Access-Control-Allow-Methods'] = 'POST, OPTIONS';
    h['Access-Control-Allow-Headers'] = 'Content-Type';
    h['Access-Control-Max-Age'] = '86400';
  }
  return { h, allowed };
}

const reply = (status, body, headers) => new Response(JSON.stringify(body), { status, headers: Object.assign({ 'Content-Type': 'application/json' }, headers) });

/* a gentle per-visitor limit, so the form cannot be used to flood anyone's inbox */
async function overLimit(req) {
  if (typeof caches === 'undefined' || !caches.default) return false;
  try {
    const ip = req.headers.get('CF-Connecting-IP') || 'unknown';
    const key = new Request('https://limit.fathamster.invalid/' + encodeURIComponent(ip));
    const hit = await caches.default.match(key);
    const n = hit ? Number(await hit.text()) || 0 : 0;
    if (n >= MAX_PER_HOUR) return true;
    await caches.default.put(key, new Response(String(n + 1), { headers: { 'Cache-Control': 'max-age=3600' } }));
  } catch (e) { /* never block a real enquiry because of this */ }
  return false;
}

const send = (env, payload) => fetch('https://api.resend.com/emails', {
  method: 'POST',
  headers: { 'Authorization': 'Bearer ' + env.RESEND_API_KEY, 'Content-Type': 'application/json' },
  body: JSON.stringify(payload)
});

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

    const name = clean(d.name, 120), email = clean(d.email, 200), interest = clean(d.interest, 120) || 'Something else', message = clean(d.message, 4000);
    if (!name || !/^\S+@\S+\.\S+$/.test(email)) return reply(400, { error: 'Name and a valid email are needed' }, cors.h);
    if (!env.RESEND_API_KEY || !env.TO || !env.FROM) return reply(500, { error: 'Mailer is not set up' }, cors.h);
    if (env.TURNSTILE_SECRET) {
      const token = clean(d.turnstileToken, 2048);
      if (!token) return reply(400, { error: 'Please complete the check' }, cors.h);
      const form = new URLSearchParams({ secret: env.TURNSTILE_SECRET, response: token });
      const ip = req.headers.get('CF-Connecting-IP'); if (ip) form.set('remoteip', ip);
      let ok = false;
      try { const v = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: form }); ok = !!(await v.json()).success; } catch (e) { ok = false; }
      if (!ok) return reply(403, { error: 'The check did not pass' }, cors.h);
    }
    if (await overLimit(req)) return reply(429, { error: 'Too many messages, please try again later' }, cors.h);

    const design = d.design && typeof d.design === 'object' ? d.design : null;
    let rows = [], inline = false, hasSvg = false, jpeg = null, svgFile = null;
    if (design) {
      design.url = /^https?:\/\//.test(design.url || '') ? clean(design.url, 4000) : '';
      design.summary = clean(design.summary, 600);
      rows = (Array.isArray(design.details) ? design.details : []).slice(0, 12).map((r) => [clean(r && r[0], 40), clean(r && r[1], 200)]).filter((r) => r[0]);
      if (!rows.length && design.summary) rows = [['Design', design.summary]];
      if (typeof design.jpeg === 'string' && /^[A-Za-z0-9+/=]+$/.test(design.jpeg) && design.jpeg.length < 4000000) { jpeg = design.jpeg; inline = true; }
      if (typeof design.svg === 'string' && design.svg.startsWith('<?xml') && design.svg.length < 600000) {
        hasSvg = true;
        svgFile = { filename: clean(design.name, 80).replace(/[^\w.-]+/g, '-') || 'fat-hamster-design.svg', content: b64(design.svg) };
      }
    }
    const pic = jpeg ? { filename: 'board-preview.jpg', content: jpeg, content_id: 'board', content_type: 'image/jpeg' } : null;

    const o = { name, email, interest, message, design, rows, inline, hasSvg };
    const text = name + ' <' + email + '>\nInterested in: ' + interest + (message ? '\n\n' + message : '') +
      (design ? '\n\nBoard design:\n' + plainRows(rows) + (design.url ? '\nOpen it: ' + design.url : '') : '');

    // 1. to Phil
    const toPhil = await send(env, {
      from: env.FROM, to: [env.TO], reply_to: email,
      subject: (design ? 'Board design: ' : 'Enquiry: ') + (design && design.summary ? clean(design.summary, 70) : interest) + ' (' + name + ')',
      html: philEmail(o), text,
      attachments: [pic, svgFile].filter(Boolean)
    });
    if (!toPhil.ok) return reply(502, { error: 'Could not send' }, cors.h);

    // 2. confirmation to the customer (best effort: Phil already has the enquiry)
    try {
      await send(env, {
        from: env.FROM, to: [email], reply_to: env.TO,
        subject: design ? 'We have your board design' : 'We have your message',
        html: customerEmail(o),
        text: 'Hi ' + (name.split(/\s+/)[0] || name) + ',\n\n' + (design ? 'Thank you for sending your design. Phil has it now and will be in touch by email soon.\n\n' + plainRows(rows) + (design.url ? '\n\nView your design: ' + design.url : '') : 'Thank you for getting in touch. Phil will reply by email soon.') +
          '\n\nThe Fat Hamster Wood Shop, Prescot\n' + SITE,
        attachments: [pic].filter(Boolean)
      });
    } catch (e) { /* ignore */ }

    return reply(200, { ok: true }, cors.h);
  }
};
