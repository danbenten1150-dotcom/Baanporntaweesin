import type { Metadata } from 'next';
import View from './view';

export const metadata: Metadata = { title: 'เกี่ยวกับเรา / About Us', description: 'บ้านพรทวีสิน ผู้ให้บริการขนส่งทางทะเล วัสดุก่อสร้าง รับเหมาก่อสร้าง และเครื่องจักร ชุมพร เกาะเต่า เกาะพะงัน', alternates: { canonical: '/about/' } };

export default function Page() {
  return <View />;
}
