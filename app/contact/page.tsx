import type { Metadata } from 'next';
import View from './view';

export const metadata: Metadata = { title: 'ติดต่อเรา / Contact Us', description: 'ติดต่อบ้านพรทวีสิน สอบถามการขนส่งสินค้า วัสดุก่อสร้าง และงานก่อสร้าง', alternates: { canonical: '/contact/' } };

export default function Page() {
  return <View />;
}
