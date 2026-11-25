'use client';

import { useLang } from '@/lib/i18n';
import { Alert, PageHeader } from '@/components/ui';

export default function View() {
  const { t } = useLang();
  const sections = [
    [t('ข้อมูลที่เราเก็บ', 'Data we collect'), t('ชื่อ เบอร์โทรศัพท์ อีเมล LINE ID ที่อยู่รับ-ส่งสินค้า ข้อมูลบริษัทและเลขประจำตัวผู้เสียภาษี (สำหรับลูกค้านิติบุคคล) รายละเอียดสินค้า ทะเบียนรถ และไฟล์ที่ท่านอัปโหลด', 'Name, phone, email, LINE ID, pickup/delivery addresses, company and tax ID (business customers), cargo details, vehicle registration and files you upload.')],
    [t('วัตถุประสงค์', 'Purpose'), t('เพื่อดำเนินการจอง เสนอราคา ขนส่ง ออกเอกสาร ตรวจสอบการชำระเงิน และติดต่อท่านเกี่ยวกับบริการ (ฐานสัญญา)', 'To process bookings, quotations, transport, documents, payment verification and service communication (contractual basis).')],
    [t('การเก็บรักษา', 'Retention'), t('[ผู้ดูแลระบบระบุระยะเวลาเก็บรักษาตามกฎหมายบัญชี/ภาษี]', '[Administrator to specify retention periods per accounting/tax law]')],
    [t('การเปิดเผย', 'Disclosure'), t('เปิดเผยเฉพาะผู้ให้บริการที่จำเป็น เช่น ผู้ให้บริการระบบคลาวด์และการแจ้งเตือน ภายใต้สัญญาคุ้มครองข้อมูล', 'Only to necessary processors such as cloud and notification providers under data-protection agreements.')],
    [t('สิทธิของเจ้าของข้อมูล', 'Your rights'), t('ขอเข้าถึง แก้ไข ลบ ระงับ คัดค้าน โอนย้ายข้อมูล และถอนความยินยอม ติดต่อผ่านหน้าติดต่อเรา', 'Access, rectify, erase, restrict, object, port and withdraw consent — via the contact page.')],
    [t('ความปลอดภัย', 'Security'), t('เข้ารหัสการรับส่งข้อมูล จำกัดสิทธิ์การเข้าถึงตามบทบาท ไฟล์เก็บในพื้นที่ส่วนตัว และบันทึกการเข้าถึงของเจ้าหน้าที่', 'Encrypted transport, role-based access, private file storage and staff access audit logs.')],
    [t('ผู้ควบคุมข้อมูล', 'Data controller'), t('[ชื่อนิติบุคคล ที่อยู่ และช่องทางติดต่อเจ้าหน้าที่คุ้มครองข้อมูล — รอผู้ดูแลระบบระบุ]', '[Legal entity, address and DPO contact — to be completed by the administrator]')],
  ];
  return (
    <>
      <PageHeader eyebrow="PDPA" title={t('นโยบายความเป็นส่วนตัว', 'Privacy Policy')} />
      <div className="container max-w-3xl space-y-8 py-12">
        <Alert>{t('เอกสารนี้เป็นแม่แบบเบื้องต้น กรุณาให้ที่ปรึกษากฎหมายตรวจสอบก่อนเผยแพร่จริง', 'This is a starting template. Have it reviewed by legal counsel before publishing.')}</Alert>
        {sections.map(([h, b]) => <section key={h}><h2 className="font-display text-xl font-bold">{h}</h2><p className="mt-2 leading-relaxed text-neutral-700">{b}</p></section>)}
      </div>
    </>
  );
}
