// api/save-progress.js
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { randomUUID } from 'crypto';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
  const allowedOrigins = [
    'https://www.justice-draft.com',
    'https://justice-draft.webflow.io',
  ];
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight FIRST before any method checks
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let email, formData, currentStep;
  const contentType = req.headers['content-type'] || '';

  if (contentType.includes('application/json')) {
    ({ email, formData, currentStep } = req.body);
  } else if (contentType.includes('application/x-www-form-urlencoded')) {
    email = req.body['Save-Progress-Email'] || req.body['email'] || '';
    formData = {};
    currentStep = 0;
  } else {
    try {
      ({ email, formData, currentStep } = req.body);
    } catch (e) {
      return res.status(400).json({ error: 'Unable to parse request body' });
    }
  }

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Invalid email address' });
  }

  const token = randomUUID();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);

  const { error: dbError } = await supabase
    .from('form_sessions')
    .insert({
      token,
      email: email.toLowerCase().trim(),
      form_data: formData || {},
      current_step: currentStep || 0,
      expires_at: expiresAt.toISOString(),
      created_at: new Date().toISOString(),
    });

  if (dbError) {
    console.error('Supabase insert error:', dbError);
    return res.status(500).json({ error: 'Failed to save progress. Please try again.' });
  }

  const resumeUrl = `https://justice-draft.webflow.io/start-your-statement?resume=${token}`;

  const { error: emailError } = await resend.emails.send({
    from: 'Justice Draft <noreply@resend.dev>',
    to: email,
    subject: "Your statement is saved — continue when you're ready",
    html: `
      <!DOCTYPE html>
      <html>
        <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
        <body style="margin:0;padding:0;background-color:#f9f9f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f9f9f7;padding:40px 20px;">
            <tr><td align="center">
              <table width="560" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
                <tr><td style="padding:36px 40px 28px;border-bottom:1px solid #f0efec;">
                  <p style="margin:0;font-size:18px;font-weight:600;color:#1a1a1a;letter-spacing:-0.3px;">Justice Draft</p>
                </td></tr>
                <tr><td style="padding:36px 40px;">
                  <h1 style="margin:0 0 16px;font-size:22px;font-weight:600;color:#1a1a1a;line-height:1.3;letter-spacing:-0.4px;">Your progress is saved</h1>
                  <p style="margin:0 0 24px;font-size:15px;color:#555;line-height:1.6;">Take all the time you need. When you're ready to continue your victim impact statement, just click the button below — your answers will be right where you left them.</p>
                  <p style="margin:0 0 32px;font-size:15px;color:#555;line-height:1.6;">This link works on any device or browser, and will remain active for <strong>30 days</strong>.</p>
                  <table cellpadding="0" cellspacing="0">
                    <tr><td style="border-radius:8px;background-color:#1a1a1a;">
                      <a href="${resumeUrl}" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">Continue my statement →</a>
                    </td></tr>
                  </table>
                </td></tr>
                <tr><td style="padding:24px 40px;border-top:1px solid #f0efec;background-color:#fafaf8;">
                  <p style="margin:0;font-size:12px;color:#999;line-height:1.6;">If the button doesn't work, copy and paste this link:<br><a href="${resumeUrl}" style="color:#555;word-break:break-all;">${resumeUrl}</a></p>
                  <p style="margin:12px 0 0;font-size:12px;color:#bbb;">This link expires in 30 days.</p>
                </td></tr>
              </table>
            </td></tr>
          </table>
        </body>
      </html>
    `,
  });

  if (emailError) {
    console.error('Resend email error:', emailError);
    return res.status(500).json({ error: 'Progress saved but email failed to send.' });
  }

  if (contentType.includes('application/x-www-form-urlencoded')) {
    return res.redirect(302, 'https://justice-draft.webflow.io/start-your-statement?saved=true');
  }

  return res.status(200).json({ success: true });
}
