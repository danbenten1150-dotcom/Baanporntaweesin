'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { LogIn, ShieldCheck, UserPlus } from 'lucide-react';
import { useLang } from '@/lib/i18n';
import { useAuth } from '@/lib/auth';
import { IS_DEMO } from '@/lib/config';
import { Alert, Button, Checkbox, Field, Input, PageHeader, Tabs } from '@/components/ui';

export default function View() {
  const { t } = useLang();
  const auth = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<'in' | 'up'>('in');
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: 'bad' | 'ok'; text: string } | null>(null);

  const run = async (fn: () => Promise<void>, to = '/account/') => {
    setBusy(true); setMsg(null);
    try { await fn(); router.push(to); } catch (e) { setMsg({ tone: 'bad', text: (e as Error).message === 'phone' ? t('เบอร์โทรไม่ถูกต้อง', 'Invalid phone number') : t('เข้าสู่ระบบไม่สำเร็จ กรุณาตรวจสอบข้อมูล', 'Sign-in failed, please check your details') }); } finally { setBusy(false); }
  };

  return (
    <>
      <PageHeader eyebrow={t('บัญชีลูกค้า', 'Customer account')} title={t('เข้าสู่ระบบ', 'Log in')} lead={t('ดูการจอง ใบเสนอราคา การชำระเงิน และเอกสารของคุณ', 'See your bookings, quotations, payments and documents.')} />
      <div className="container max-w-lg py-10">
        <div className="card space-y-5 p-5 md:p-8">
          {IS_DEMO ? (
            <>
              <Alert tone="info">{t('โหมดสาธิต: เข้าสู่ระบบด้วยเบอร์โทรศัพท์ (ไม่มีรหัสผ่าน ไม่ส่ง SMS) ข้อมูลเก็บในเบราว์เซอร์นี้เท่านั้น', 'Demo mode: sign in with a phone number (no password or SMS). Data stays in this browser only.')}</Alert>
              <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); run(() => auth.demoCustomerLogin(phone, name)); }}>
                <Field label={t('เบอร์โทรศัพท์', 'Phone number')} required hint={t('ใช้เบอร์เดียวกับที่จอง เพื่อดูรายการของคุณ', 'Use the phone you booked with to see your records')}><Input type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} required /></Field>
                <Field label={t('ชื่อ (สำหรับบัญชีใหม่)', 'Name (for new account)')}><Input value={name} onChange={(e) => setName(e.target.value)} /></Field>
                <Button type="submit" size="lg" className="w-full" loading={busy}><LogIn className="h-4 w-4" />{t('เข้าสู่ระบบ', 'Log in')}</Button>
              </form>
              <div className="grid gap-2 border-t pt-5 sm:grid-cols-2">
                <Button variant="outline" onClick={() => run(() => auth.demoCustomerLogin('0800000000'))}>{t('ลูกค้าตัวอย่าง', 'Demo customer')}</Button>
                <Button variant="dark" onClick={() => run(() => auth.demoAdminLogin(), '/admin/')}><ShieldCheck className="h-4 w-4" />{t('ผู้ดูแลตัวอย่าง', 'Demo admin')}</Button>
              </div>
            </>
          ) : (
            <>
              <Tabs value={tab} onChange={setTab} items={[{ value: 'in', label: t('เข้าสู่ระบบ', 'Log in') }, { value: 'up', label: t('สมัครสมาชิก', 'Sign up') }]} />
              <form className="space-y-4" onSubmit={(e) => {
                e.preventDefault();
                if (tab === 'in') run(() => auth.signIn(email, password));
                else { if (!consent) { setMsg({ tone: 'bad', text: t('กรุณายินยอมนโยบายความเป็นส่วนตัว', 'Please accept the privacy policy') }); return; }
                  setBusy(true); auth.signUp(email, password, { full_name: name, phone, pdpa_consent: consent }).then(() => setMsg({ tone: 'ok', text: t('สมัครสำเร็จ กรุณายืนยันอีเมลก่อนเข้าสู่ระบบ', 'Account created — confirm your email, then log in.') })).catch(() => setMsg({ tone: 'bad', text: t('สมัครไม่สำเร็จ', 'Sign-up failed') })).finally(() => setBusy(false)); }
              }}>
                {tab === 'up' && <><Field label={t('ชื่อ-นามสกุล', 'Full name')} required><Input value={name} onChange={(e) => setName(e.target.value)} required /></Field>
                  <Field label={t('เบอร์โทรศัพท์', 'Phone')} required><Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} required /></Field></>}
                <Field label={t('อีเมล', 'Email')} required><Input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></Field>
                <Field label={t('รหัสผ่าน', 'Password')} required><Input type="password" autoComplete={tab === 'in' ? 'current-password' : 'new-password'} minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} required /></Field>
                {tab === 'up' && <Checkbox checked={consent} onChange={setConsent}>{t('ยินยอมให้เก็บและใช้ข้อมูลตามนโยบายความเป็นส่วนตัว (PDPA)', 'I consent to data processing under the privacy policy (PDPA)')}</Checkbox>}
                <Button type="submit" size="lg" className="w-full" loading={busy}>{tab === 'in' ? <><LogIn className="h-4 w-4" />{t('เข้าสู่ระบบ', 'Log in')}</> : <><UserPlus className="h-4 w-4" />{t('สมัครสมาชิก', 'Create account')}</>}</Button>
              </form>
            </>
          )}
          {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
        </div>
      </div>
    </>
  );
}
