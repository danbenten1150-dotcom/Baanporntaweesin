import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Providers } from '@/components/layout/Providers';
import { BottomNav, FloatingContact, Footer, Header } from '@/components/layout/SiteChrome';
import { SITE } from '@/lib/config';

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: { default: `${SITE.name_th} | ${SITE.name_en} — ขนส่งทางทะเล วัสดุก่อสร้าง รับเหมาก่อสร้าง`, template: `%s | ${SITE.name_th}` },
  description: 'บ้านพรทวีสิน ผู้ให้บริการขนส่งสินค้าทางทะเล ชุมพร–เกาะเต่า–เกาะพะงัน จำหน่ายวัสดุก่อสร้าง หิน ปูน ทราย ท่อ บ่อ รับเหมาก่อสร้าง บริการรถดัมพ์ รถเครน และเครื่องจักรหนัก',
  keywords: ['ขนส่งสินค้าเกาะเต่า', 'เรือขนส่งชุมพร', 'วัสดุก่อสร้างเกาะพะงัน', 'รถเครนชุมพร', 'Koh Tao cargo', 'Chumphon cargo ship', 'Baan PornTaweesin'],
  openGraph: { type: 'website', locale: 'th_TH', alternateLocale: ['en_US'], siteName: SITE.name_th, images: ['/brand/banner-main.jpg'] },
  icons: { icon: '/brand/logo-sm.png' },
  alternates: { canonical: '/' },
};

const FONTS = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Noto+Sans+Thai:wght@400;500;600;700&family=Prompt:ital,wght@0,500;0,600;0,700;0,800;1,700;1,800&display=swap';

export const viewport: Viewport = { themeColor: '#C00000', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* fonts load without blocking first paint; system Thai fonts show until they arrive */}
        <link rel="preload" as="style" href={FONTS} />
        <script dangerouslySetInnerHTML={{ __html: `(function(){var l=document.createElement('link');l.rel='stylesheet';l.href='${FONTS}';document.head.appendChild(l)})()` }} />
        <noscript><link rel="stylesheet" href={FONTS} /></noscript>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
          '@context': 'https://schema.org', '@type': 'Organization', name: SITE.name_en, alternateName: SITE.name_th, url: SITE.url, logo: `${SITE.url}/brand/logo.png`,
          areaServed: ['Chumphon', 'Koh Tao', 'Koh Phangan'],
        }) }} />
      </head>
      <body>
        <Providers>
          <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-white focus:px-4 focus:py-2">ข้ามไปเนื้อหา / Skip to content</a>
          <Header />
          <main id="main" className="min-h-[60vh]">{children}</main>
          <Footer />
          <FloatingContact />
          <BottomNav />
        </Providers>
      </body>
    </html>
  );
}
