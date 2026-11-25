'use client';

// shadcn/ui-style primitives (same API shape: variant/size props, cn() merging),
// kept in one module so the project builds without the shadcn CLI.

import Link from 'next/link';
import { createContext, forwardRef, useCallback, useContext, useEffect, useId, useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock, FileText, Image as ImageIcon, Inbox, Loader2, PackageCheck, Paperclip, Truck, X, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLang } from '@/lib/i18n';
import { ANY_STATUS, statusTone, type StatusTone } from '@/lib/labels';
import { ERR_TEXT } from '@/lib/validation';
import { UPLOAD_LIMITS } from '@/lib/config';

// ───────── Button ─────────
type Variant = 'primary' | 'accent' | 'outline' | 'ghost' | 'dark' | 'white' | 'danger';
type Size = 'sm' | 'md' | 'lg';
const VARIANTS: Record<Variant, string> = {
  primary: 'bg-brand-red text-white hover:bg-brand-dark shadow-sm',
  accent: 'bg-brand-yellow text-brand-ink hover:brightness-95 shadow-sm',
  outline: 'border border-neutral-300 bg-white text-brand-ink hover:border-brand-red hover:text-brand-red',
  ghost: 'text-brand-ink hover:bg-neutral-100',
  dark: 'bg-brand-ink text-white hover:bg-black',
  white: 'bg-white text-brand-red hover:bg-neutral-50 shadow-sm',
  danger: 'border border-red-200 bg-red-50 text-red-700 hover:bg-red-100',
};
const SIZES: Record<Size, string> = {
  sm: 'h-11 px-3.5 text-[15px] gap-1.5',
  md: 'h-12 px-5 text-base gap-2',
  lg: 'h-14 px-7 text-[17px] gap-2',
};
export function buttonClass(variant: Variant = 'primary', size: Size = 'md', className?: string) {
  return cn('inline-flex select-none items-center justify-center rounded-xl font-semibold transition disabled:pointer-events-none disabled:opacity-50 whitespace-nowrap', VARIANTS[variant], SIZES[size], className);
}
interface BtnProps extends React.ButtonHTMLAttributes<HTMLButtonElement> { variant?: Variant; size?: Size; loading?: boolean }
export const Button = forwardRef<HTMLButtonElement, BtnProps>(({ variant, size, loading, className, children, disabled, ...p }, ref) => (
  <button ref={ref} className={buttonClass(variant, size, className)} disabled={disabled || loading} {...p}>
    {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
    {children}
  </button>
));
Button.displayName = 'Button';
export function LinkButton({ href, variant, size, className, children, ...p }: { href: string; variant?: Variant; size?: Size; className?: string; children: React.ReactNode } & React.AnchorHTMLAttributes<HTMLAnchorElement>) {
  return <Link href={href} className={buttonClass(variant, size, className)} {...p}>{children}</Link>;
}

// ───────── Form fields ─────────
export function Field({ label, error, hint, required, children, className }: { label: string; error?: string; hint?: string; required?: boolean; children: React.ReactNode; className?: string }) {
  const { pick } = useLang();
  return (
    <label className={cn('block', className)}>
      <span className="mb-1.5 block text-base font-medium text-neutral-800">
        {label}{required && <span className="text-brand-red">&nbsp;*</span>}
      </span>
      {children}
      {error ? <span className="mt-1 block text-[13px] text-red-600" role="alert">{pick(ERR_TEXT[error]) || error}</span>
        : hint ? <span className="mt-1 block text-[13px] text-neutral-500">{hint}</span> : null}
    </label>
  );
}
const inputBase = 'w-full rounded-xl border border-neutral-300 bg-white px-3.5 text-[16px] text-brand-ink placeholder:text-neutral-400 transition focus:border-brand-red focus:outline-none focus:ring-4 focus:ring-brand-red/10 disabled:bg-neutral-100';
export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }>(({ className, invalid, ...p }, ref) => (
  <input ref={ref} className={cn(inputBase, 'h-12', invalid && 'border-red-500', className)} aria-invalid={invalid || undefined} {...p} />
));
Input.displayName = 'Input';
export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }>(({ className, invalid, ...p }, ref) => (
  <textarea ref={ref} className={cn(inputBase, 'min-h-[110px] py-3', invalid && 'border-red-500', className)} aria-invalid={invalid || undefined} {...p} />
));
Textarea.displayName = 'Textarea';
export const Select = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }>(({ className, invalid, children, ...p }, ref) => (
  <select ref={ref} className={cn(inputBase, 'h-12 appearance-none bg-white bg-no-repeat pr-10', invalid && 'border-red-500', className)}
    style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' fill='none'%3E%3Cpath d='M1 1.5 6 6.5l5-5' stroke='%23737373' stroke-width='1.6'/%3E%3C/svg%3E\")", backgroundPosition: 'right 14px center' }} {...p}>{children}</select>
));
Select.displayName = 'Select';

export function Checkbox({ checked, onChange, children, className }: { checked: boolean; onChange: (v: boolean) => void; children: React.ReactNode; className?: string }) {
  return (
    <label className={cn('flex cursor-pointer items-start gap-3 text-sm leading-relaxed', className)}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-[#C00000]" />
      <span>{children}</span>
    </label>
  );
}

export function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[] }) {
  return (
    <div className="inline-flex rounded-xl bg-neutral-100 p-1" role="radiogroup">
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={value === o.value} onClick={() => onChange(o.value)}
          className={cn('h-10 rounded-lg px-4 text-[15px] font-medium transition', value === o.value ? 'bg-white text-brand-red shadow-sm' : 'text-neutral-600 hover:text-brand-ink')}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** File picker. Returns File objects; the page uploads them through api.uploadFiles(). */
export function FilePicker({ label, files, onChange, accept = UPLOAD_LIMITS.accept, hint }: { label: string; files: File[]; onChange: (f: File[]) => void; accept?: string; hint?: string }) {
  const id = useId();
  const { t } = useLang();
  const [err, setErr] = useState('');
  return (
    <div>
      <span className="mb-1.5 block text-sm font-medium text-neutral-800">{label}</span>
      <label htmlFor={id} className="flex cursor-pointer items-center gap-3 rounded-xl border-2 border-dashed border-neutral-300 bg-neutral-50 px-4 py-4 text-sm text-neutral-600 transition hover:border-brand-red hover:bg-red-50/40">
        <Paperclip className="h-5 w-5 text-brand-red" aria-hidden />
        <span>{t('แตะเพื่อเลือกไฟล์ (JPG, PNG, PDF ไม่เกิน 10MB)', 'Tap to choose files (JPG, PNG, PDF up to 10MB)')}</span>
      </label>
      <input id={id} type="file" multiple accept={accept} className="sr-only" onChange={(e) => {
        const picked = Array.from(e.target.files || []);
        const ok = picked.filter((f) => f.size <= UPLOAD_LIMITS.maxBytes);
        setErr(ok.length < picked.length ? t('บางไฟล์ใหญ่เกิน 10MB จึงไม่ได้แนบ', 'Some files exceed 10MB and were skipped') : '');
        onChange([...files, ...ok].slice(0, UPLOAD_LIMITS.maxFiles));
        e.target.value = '';
      }} />
      {hint && <p className="mt-1 text-[13px] text-neutral-500">{hint}</p>}
      {err && <p className="mt-1 text-[13px] text-red-600">{err}</p>}
      {files.length > 0 && (
        <ul className="mt-2 space-y-1.5">
          {files.map((f, i) => (
            <li key={i} className="flex items-center justify-between gap-2 rounded-lg bg-white px-3 py-2 text-sm ring-1 ring-neutral-200">
              <span className="truncate">{f.name}</span>
              <button type="button" aria-label={t('ลบไฟล์', 'Remove file')} onClick={() => onChange(files.filter((_, j) => j !== i))} className="rounded p-1 text-neutral-500 hover:bg-neutral-100"><X className="h-4 w-4" /></button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ───────── Display ─────────
type Tone = 'neutral' | 'warn' | 'ok' | 'info' | 'bad' | 'demo' | StatusTone;
const TONES: Record<Tone, string> = {
  neutral: 'bg-neutral-100 text-neutral-700 ring-neutral-200', draft: 'bg-neutral-100 text-neutral-700 ring-neutral-200',
  warn: 'bg-amber-50 text-amber-900 ring-amber-300', pending: 'bg-amber-50 text-amber-900 ring-amber-300',
  info: 'bg-blue-50 text-blue-800 ring-blue-200', confirmed: 'bg-blue-50 text-blue-800 ring-blue-200',
  transit: 'bg-violet-50 text-violet-800 ring-violet-200',
  ok: 'bg-emerald-50 text-emerald-800 ring-emerald-200', done: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  bad: 'bg-red-50 text-red-700 ring-red-200', cancelled: 'bg-red-50 text-red-700 ring-red-200',
  demo: 'bg-brand-yellow text-brand-ink ring-brand-yellow',
};
export const TONE_ICON: Record<StatusTone, React.ComponentType<{ className?: string }>> = {
  pending: Clock, confirmed: CheckCircle2, transit: Truck, done: PackageCheck, cancelled: XCircle, draft: FileText,
};
export function Badge({ tone = 'neutral', children, className }: { tone?: Tone; children: React.ReactNode; className?: string }) {
  return <span className={cn('inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ring-1', TONES[tone], className)}>{children}</span>;
}
/** Colour + icon + text, never colour alone. */
export function StatusBadge({ status }: { status: string }) {
  const { pick } = useLang();
  const tone = statusTone(status);
  const Icon = TONE_ICON[tone];
  return <Badge tone={tone}><Icon className="h-3.5 w-3.5" aria-hidden />{pick(ANY_STATUS[status]) || status}</Badge>;
}
export function DemoTag({ className }: { className?: string }) {
  const { t } = useLang();
  return <Badge tone="demo" className={className}>{t('ข้อมูลตัวอย่าง', 'DEMO data')}</Badge>;
}

export function Spinner({ label }: { label?: string }) {
  return <div className="flex items-center justify-center gap-2 py-12 text-neutral-500" role="status"><Loader2 className="h-5 w-5 animate-spin text-brand-red" />{label && <span className="text-sm">{label}</span>}</div>;
}
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-xl bg-neutral-200/70', className)} />;
}
export function EmptyState({ title, body, action }: { title: string; body?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 px-6 py-12 text-center">
      <Inbox className="h-9 w-9 text-neutral-500" aria-hidden />
      <p className="mt-3 font-semibold">{title}</p>
      {body && <p className="mt-1 max-w-md text-sm text-neutral-500">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
export function Alert({ tone = 'warn', children, className }: { tone?: 'warn' | 'ok' | 'bad' | 'info'; children: React.ReactNode; className?: string }) {
  const s = { warn: 'bg-amber-50 text-amber-900 ring-amber-200', ok: 'bg-emerald-50 text-emerald-900 ring-emerald-200', bad: 'bg-red-50 text-red-800 ring-red-200', info: 'bg-sky-50 text-sky-900 ring-sky-200' }[tone];
  const Icon = tone === 'ok' ? CheckCircle2 : AlertTriangle;
  return <div className={cn('flex gap-3 rounded-xl p-4 text-sm ring-1', s, className)} role={tone === 'bad' ? 'alert' : 'status'}><Icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden /><div className="min-w-0">{children}</div></div>;
}

/** Replaceable photo slot — used until real company photographs are uploaded. */
export function PhotoSlot({ src, alt, label, className, icon: Icon = ImageIcon }: { src?: string | null; alt: string; label?: string; className?: string; icon?: React.ComponentType<{ className?: string }> }) {
  const { t } = useLang();
  if (src) return <img src={src} alt={alt} className={cn('h-full w-full object-cover', className)} loading="lazy" />;
  return (
    <div className={cn('relative flex h-full w-full flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-neutral-800 to-neutral-950 text-white', className)} role="img" aria-label={alt}>
      <div className="absolute inset-0 opacity-[0.07] [background-image:linear-gradient(#fff_1px,transparent_1px),linear-gradient(90deg,#fff_1px,transparent_1px)] [background-size:22px_22px]" />
      <Icon className="relative h-10 w-10 text-brand-yellow" />
      {label && <span className="relative mt-2 px-4 text-center text-sm font-semibold">{label}</span>}
      <span className="relative mt-1 px-3 text-center text-[13px] text-white/75">{t('พื้นที่รูปภาพ — แทนที่ด้วยรูปจริงของบริษัท', 'Photo slot — replace with a real company photo')}</span>
    </div>
  );
}

// ───────── Modal ─────────
export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', k); document.body.style.overflow = ''; };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/50 p-0 backdrop-blur-[2px] sm:items-center sm:p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-label={title} className={cn('max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl', wide ? 'sm:max-w-3xl' : 'sm:max-w-lg')}>
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-neutral-100 bg-white px-5 py-4">
          <h2 className="font-display text-lg font-bold">{title}</h2>
          <button onClick={onClose} className="rounded-lg p-2 hover:bg-neutral-100" aria-label="Close"><X className="h-5 w-5" /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

// ───────── Toasts ─────────
type Toast = { id: number; tone: 'ok' | 'bad' | 'info'; text: string };
const ToastCtx = createContext<(text: string, tone?: Toast['tone']) => void>(() => {});
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const push = useCallback((text: string, tone: Toast['tone'] = 'ok') => {
    const id = Date.now() + Math.random();
    setItems((x) => [...x, { id, tone, text }]);
    setTimeout(() => setItems((x) => x.filter((t) => t.id !== id)), 4200);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-20 z-[90] flex flex-col items-center gap-2 px-4" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={cn('pointer-events-auto flex max-w-md items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium shadow-lg', t.tone === 'bad' ? 'bg-red-600 text-white' : t.tone === 'info' ? 'bg-brand-ink text-white' : 'bg-emerald-600 text-white')}>
            {t.tone === 'bad' ? <AlertTriangle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}{t.text}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
export const useToast = () => useContext(ToastCtx);

export function Tabs<T extends string>({ value, onChange, items, className }: { value: T; onChange: (v: T) => void; items: { value: T; label: string; count?: number }[]; className?: string }) {
  return (
    <div className={cn('no-scrollbar -mx-4 flex gap-1 overflow-x-auto px-4 md:mx-0 md:px-0', className)} role="tablist">
      {items.map((i) => (
        <button key={i.value} role="tab" aria-selected={value === i.value} onClick={() => onChange(i.value)}
          className={cn('flex h-11 shrink-0 items-center gap-2 rounded-xl px-4 text-[15px] font-medium transition', value === i.value ? 'bg-brand-ink text-white' : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200')}>
          {i.label}{i.count != null && <span className={cn('rounded-full px-1.5 text-xs', value === i.value ? 'bg-brand-yellow text-brand-ink' : 'bg-white text-neutral-600')}>{i.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function PageHeader({ eyebrow, title, lead, children }: { eyebrow?: string; title: string; lead?: string; children?: React.ReactNode }) {
  // Banner-style header: deep red field, yellow swoosh, heavy italic title
  return (
    <section className="hero-field relative overflow-hidden text-white">
      <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 1440 300" preserveAspectRatio="none" aria-hidden>
        <path d="M-10 40 C 260 -10, 520 10, 760 -10 L -10 -10Z" fill="#FFD600" />
        <path d="M820 330 C 1050 230, 1220 250, 1450 120" stroke="#FFD600" strokeWidth="14" fill="none" />
        <path d="M860 330 C 1080 250, 1240 270, 1450 160" stroke="#ffffff" strokeOpacity=".18" strokeWidth="5" fill="none" />
      </svg>
      <div className="container relative py-9 md:py-14">
        {eyebrow && <p className="inline-flex rounded-full bg-black/20 px-3.5 py-1 text-[15px] font-semibold text-brand-yellow">{eyebrow}</p>}
        <h1 className="banner-type mt-3 max-w-3xl text-[30px] leading-[1.15] md:text-[44px]">{title}</h1>
        {lead && <p className="mt-3 max-w-2xl text-base text-white/95 md:text-lg">{lead}</p>}
        {children}
      </div>
    </section>
  );
}

// ───────── Confirmation dialog (before cancelling, rejecting or deleting) ─────────
type ConfirmOpts = { title: string; body?: string; confirm: string; danger?: boolean };
const ConfirmCtx = createContext<(o: ConfirmOpts) => Promise<boolean>>(async () => true);
export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<(ConfirmOpts & { resolve: (v: boolean) => void }) | null>(null);
  const ask = useCallback((o: ConfirmOpts) => new Promise<boolean>((resolve) => setState({ ...o, resolve })), []);
  const done = (v: boolean) => { state?.resolve(v); setState(null); };
  const { t } = useLang();
  return (
    <ConfirmCtx.Provider value={ask}>
      {children}
      {state && (
        <div className="fixed inset-0 z-[95] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4" role="alertdialog" aria-modal="true" aria-label={state.title}>
          <div className="w-full rounded-t-3xl bg-white p-6 shadow-2xl sm:max-w-md sm:rounded-3xl">
            <div className={cn('grid h-12 w-12 place-items-center rounded-full', state.danger ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-700')}><AlertTriangle className="h-6 w-6" /></div>
            <h2 className="mt-4 font-display text-xl font-bold">{state.title}</h2>
            {state.body && <p className="mt-2 text-neutral-600">{state.body}</p>}
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="outline" onClick={() => done(false)} autoFocus>{t('ยกเลิก', 'Cancel')}</Button>
              <Button variant={state.danger ? 'primary' : 'dark'} className={state.danger ? 'bg-red-600 hover:bg-red-700' : ''} onClick={() => done(true)}>{state.confirm}</Button>
            </div>
          </div>
        </div>
      )}
    </ConfirmCtx.Provider>
  );
}
export const useConfirm = () => useContext(ConfirmCtx);
