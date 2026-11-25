import type { Metadata } from 'next';
import View from './view';

export const metadata: Metadata = { title: 'วัสดุก่อสร้าง / Construction Materials', description: 'หิน ปูน ทราย ท่อคอนกรีต บ่อคอนกรีต อิฐ เหล็ก พร้อมจัดส่ง', alternates: { canonical: '/materials/' } };

export default function Page() {
  return <View />;
}
