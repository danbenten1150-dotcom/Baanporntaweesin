// Public, build-time configuration. Contact details come ONLY from env vars or from
// admin-managed settings — nothing is hard-coded so no business information is invented.

export const SITE = {
  name_th: 'บ้านพรทวีสิน',
  name_en: 'Baan PornTaweesin',
  url: process.env.NEXT_PUBLIC_SITE_URL || 'https://www.example.com',
};

export const ENV_CONTACT = {
  phone: process.env.NEXT_PUBLIC_CONTACT_PHONE || '',
  email: process.env.NEXT_PUBLIC_CONTACT_EMAIL || '',
  line_id: process.env.NEXT_PUBLIC_LINE_ID || '',
  line_url: process.env.NEXT_PUBLIC_LINE_URL || '',
  address_th: process.env.NEXT_PUBLIC_ADDRESS_TH || '',
  address_en: process.env.NEXT_PUBLIC_ADDRESS_EN || '',
};

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
export const IS_DEMO = !SUPABASE_URL || !SUPABASE_ANON_KEY;

export const UPLOAD_LIMITS = {
  maxFiles: 8,
  maxBytes: 10 * 1024 * 1024,
  accept: 'image/jpeg,image/png,image/webp,application/pdf',
};
