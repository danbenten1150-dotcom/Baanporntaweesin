import type { Metadata } from 'next';
import View from './view';

export const metadata: Metadata = { title: 'จองเรือขนส่งสินค้า / Ship Booking', description: 'จองเรือขนส่งสินค้าออนไลน์ ชุมพร–เกาะเต่า ชุมพร–เกาะพะงัน', alternates: { canonical: '/booking/' } };

export default function Page() {
  return <View />;
}
