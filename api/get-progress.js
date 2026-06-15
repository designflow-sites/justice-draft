// api/get-progress.js
// Vercel serverless function — looks up a resume token and returns saved form data

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // CORS
  const allowedOrigins = [
    'https://www.justice-draft.com',
    'https://justice-draft.webflow.io',
  ];
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { token } = req.query;

  if (!token) {
    return res.status(400).json({ error: 'Missing token parameter' });
  }

  // Look up the session
  const { data, error } = await supabase
    .from('form_sessions')
    .select('form_data, current_step, expires_at, created_at')
    .eq('token', token)
    .single();

  if (error || !data) {
    return res.status(404).json({ error: 'Session not found. The link may have expired or been used already.' });
  }

  // Check expiry
  if (new Date(data.expires_at) < new Date()) {
    return res.status(410).json({ error: 'This resume link has expired (links are valid for 30 days).' });
  }

  return res.status(200).json({
    success: true,
    formData: data.form_data,
    currentStep: data.current_step,
    savedAt: data.created_at,
  });
}
