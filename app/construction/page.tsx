import type { Metadata } from 'next';
import View from './view';

export const metadata: Metadata = { title: 'รับเหมาก่อสร้าง / Construction Services', description: 'ขอใบเสนอราคางานก่อสร้าง นัดสำรวจหน้างาน', alternates: { canonical: '/construction/' } };

export default function Page() {
  return <View />;
}
