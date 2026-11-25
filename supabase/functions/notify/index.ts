// Supabase Edge Function: delivers rows inserted into public.notifications to
// LINE Official Account, email (Resend) and SMS. Each channel is OPTIONAL and is
// skipped automatically when its environment variables are not set.
//
// Wire it up: Supabase Dashboard → Database → Webhooks → "notifications" table,
// event INSERT → HTTP request to this function (supabase functions deploy notify).
// Secrets: supabase secrets set LINE_CHANNEL_ACCESS_TOKEN=... etc. (see .env.example)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const env = (k: string) => Deno.env.get(k) ?? '';

type Row = {
  id: string; audience: 'admin' | 'customer'; customer_id: string | null; customer_phone: string | null;
  title_th: string; title_en: string; body: string; link: string | null;
};

async function sendLine(to: string, text: string) {
  const token = env('LINE_CHANNEL_ACCESS_TOKEN');
  if (!token || !to) return 'skipped';
  const r = await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ to, messages: [{ type: 'text', text }] }),
  });
  return r.ok ? 'sent' : `error:${r.status}`;
}

async function sendEmail(to: string, subject: string, text: string) {
  const key = env('RESEND_API_KEY'); const from = env('NOTIFY_EMAIL_FROM');
  if (!key || !from || !to) return 'skipped';
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({ from, to, subject, text }),
  });
  return r.ok ? 'sent' : `error:${r.status}`;
}

async function sendSms(to: string, text: string) {
  // Generic JSON SMS gateway — adapt the payload to your Thai SMS provider's API.
  const url = env('SMS_PROVIDER_URL'); const key = env('SMS_PROVIDER_API_KEY');
  if (!url || !key || !to) return 'skipped';
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({ sender: env('SMS_SENDER_NAME'), to, message: text }),
  });
  return r.ok ? 'sent' : `error:${r.status}`;
}

Deno.serve(async (req) => {
  const payload = await req.json().catch(() => null);
  const row: Row | undefined = payload?.record;
  if (!row) return new Response('no record', { status: 400 });

  const db = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'));
  const text = `${row.title_th} / ${row.title_en}\n${row.body}`;
  const status: Record<string, string> = {};

  if (row.audience === 'admin') {
    status.line = await sendLine(env('LINE_ADMIN_TARGET_ID'), text);
    status.email = await sendEmail(env('NOTIFY_ADMIN_EMAIL'), row.title_en, text);
  } else {
    let email = '';
    if (row.customer_id) {
      const { data } = await db.from('profiles').select('email').eq('id', row.customer_id).maybeSingle();
      email = data?.email ?? '';
    }
    status.email = await sendEmail(email, row.title_en, text);
    status.sms = await sendSms(row.customer_phone ?? '', `${row.title_th} ${row.body}`);
    // LINE push to customers requires their LINE userId (via LINE Login / OA follow) — not collected by default.
    status.line = 'skipped';
  }

  await db.from('notifications').update({ channel_status: status }).eq('id', row.id);
  return Response.json({ ok: true, status });
});
