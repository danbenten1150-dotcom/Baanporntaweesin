import type { Metadata } from 'next';
import View from './view';

export const metadata: Metadata = { title: 'ตะกร้าสินค้า / Cart', description: 'ตะกร้าสินค้าวัสดุก่อสร้าง', alternates: { canonical: '/cart/' }, robots: { index: false } };

export default function Page() {
  return <View />;
}
