import type { Metadata } from 'next';
import View from './view';

export const metadata: Metadata = { title: 'ตารางเดินเรือ / Shipping Schedule', description: 'ตารางเดินเรือขนส่งสินค้า ชุมพร เกาะเต่า เกาะพะงัน', alternates: { canonical: '/schedule/' } };

export default function Page() {
  return <View />;
}
