import type { Metadata } from 'next';
import View from './view';

export const metadata: Metadata = { title: 'บริการของเรา / Our Services', description: 'ขนส่งสินค้าทางทะเล รับเหมาก่อสร้าง วัสดุก่อสร้าง รถดัมพ์ รถเครน และเครื่องจักรหนัก', alternates: { canonical: '/services/' } };

export default function Page() {
  return <View />;
}
