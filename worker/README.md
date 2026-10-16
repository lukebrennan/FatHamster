# Emailing Phil the enquiries (Resend + Cloudflare Worker)

The enquiry form posts to a tiny Worker, which uses Resend to email Phil. When the visitor
made a board in the designer, the email carries the design link, a preview picture and the
SVG cutting file for Easel as attachments. Everything here is free at this volume.

You need two free accounts (Resend and Cloudflare) and access to the fathamster.co.uk DNS.

## 1. Resend: verify the domain
1. Sign up at resend.com. Domains > Add Domain. Enter `send.fathamster.co.uk`
   (a subdomain keeps this away from any other email on the domain).
2. Resend lists three DNS records (an MX, an SPF TXT and a DKIM TXT). Add each one exactly as
   shown in the Fasthosts DNS screen, the same place the GitHub Pages records live.
   Leave the existing A and CNAME records alone.
3. Back in Resend press Verify. It can take a few minutes up to a few hours.

## 2. Resend: API key
API Keys > Create API Key. Permission: Sending access. Domain: fathamster.co.uk.
Copy the key (starts `re_`). It is only shown once.

## 3. Cloudflare: the Worker
1. dash.cloudflare.com > Workers & Pages > Create > Start with Hello World. Name it
   `fathamster-enquiries` and Deploy.
2. Edit code. Delete what is there, paste in all of `worker/worker.js`, Deploy.
3. Settings > Variables and Secrets > Add:
   - `RESEND_API_KEY`  type **Secret**  the `re_...` key
   - `TO`              type Text  Phil's real inbox, e.g. phil@example.com
   - `FROM`            type Text  `The Fat Hamster Website <enquiries@send.fathamster.co.uk>`
   - `ALLOWED_ORIGINS` type Text  `https://fathamster.co.uk,https://www.fathamster.co.uk`
   Deploy again so they apply.
4. Copy the Worker address shown at the top (like `https://fathamster-enquiries.YOURNAME.workers.dev`).

## 4. Connect the site
In `index.html` find `data-endpoint=""` on the enquiry form and put the Worker address
between the quotes. Commit and push. The form note then reads "Phil will reply to you by
email" and the form no longer opens the visitor's email app.

## 5. Test
Send an enquiry from the live site, then check Phil's inbox (and spam the first time).
Pressing Reply in that email answers the customer, not the website.

If it fails the form quietly falls back to opening the visitor's email app, so enquiries are
never lost. Cloudflare > your worker > Logs shows what went wrong.

Limits: Resend free is 100 emails a day and 3,000 a month. The Worker rejects other websites,
the hidden "leave this empty" field catches most bots, and bodies over 6 MB are refused.
