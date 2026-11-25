import { ContactSupport, HeroSection, HowToAndRates, QuickBookingSection, QuickServices, WhyUsSplit } from '@/components/home/Home';
import { Gallery, RouteMap } from '@/components/home/Sections';

// hero → quick booking → services → why us → how to book + rates → routes → gallery → support
export default function HomePage() {
  return (
    <>
      <link rel="preload" as="image" href="/images/banner-truck-crane-480.webp" imageSrcSet="/images/banner-truck-crane-480.webp 480w, /images/banner-truck-crane.webp 610w" imageSizes="(max-width: 640px) 92vw, 580px" fetchPriority="high" />
      <HeroSection />
      <QuickBookingSection />
      <QuickServices />
      <WhyUsSplit />
      <HowToAndRates />
      <RouteMap />
      <Gallery />
      <ContactSupport />
    </>
  );
}
