import type { Metadata } from 'next';
import View from './view';

export const metadata: Metadata = { title: 'ขอใบเสนอราคา / Request a Quotation', description: 'ขอใบเสนอราคาขนส่งสินค้า วัสดุก่อสร้าง งานก่อสร้าง และเช่าเครื่องจักร', alternates: { canonical: '/quote/' } };

export default function Page() {
  return <View />;
}
