import type {
  BookingStatus, CargoCategory, ConstructionService, ConstructionStatus, MachineryBookingStatus,
  MachineryType, OrderStatus, PaymentStatus, TransportMode,
} from './types';

type L = { th: string; en: string };

export const BOOKING_STATUS: Record<BookingStatus, L> = {
  pending_review: { th: 'รอตรวจสอบ', en: 'Pending review' },
  awaiting_quotation: { th: 'รอใบเสนอราคา', en: 'Awaiting quotation' },
  awaiting_payment: { th: 'รอชำระเงิน', en: 'Awaiting payment' },
  confirmed: { th: 'ยืนยันแล้ว', en: 'Confirmed' },
  cargo_received: { th: 'รับสินค้าแล้ว', en: 'Cargo received' },
  loading: { th: 'กำลังขึ้นเรือ', en: 'Loading' },
  in_transit: { th: 'กำลังขนส่ง', en: 'In transit' },
  arrived: { th: 'ถึงท่าปลายทาง', en: 'Arrived' },
  delivered: { th: 'ส่งมอบแล้ว', en: 'Delivered' },
  cancelled: { th: 'ยกเลิก', en: 'Cancelled' },
};
export const BOOKING_FLOW: BookingStatus[] = [
  'pending_review', 'confirmed', 'cargo_received', 'loading', 'in_transit', 'arrived', 'delivered',
];

export const PAYMENT_STATUS: Record<PaymentStatus, L> = {
  unpaid: { th: 'ยังไม่ชำระ', en: 'Unpaid' },
  pending_verification: { th: 'รอตรวจสอบสลิป', en: 'Slip under review' },
  deposit_paid: { th: 'ชำระมัดจำแล้ว', en: 'Deposit paid' },
  paid: { th: 'ชำระครบแล้ว', en: 'Paid in full' },
  refunded: { th: 'คืนเงินแล้ว', en: 'Refunded' },
};

export const CARGO_CATEGORY: Record<CargoCategory, L> = {
  general: { th: 'สินค้าทั่วไป', en: 'General cargo' },
  construction_materials: { th: 'วัสดุก่อสร้าง', en: 'Construction materials' },
  sand_stone: { th: 'หินและทราย', en: 'Sand and stone' },
  cement: { th: 'ปูนซีเมนต์', en: 'Cement' },
  car: { th: 'รถยนต์', en: 'Car' },
  motorcycle: { th: 'รถจักรยานยนต์', en: 'Motorcycle' },
  truck: { th: 'รถบรรทุก', en: 'Truck' },
  heavy_machinery: { th: 'เครื่องจักรหนัก', en: 'Heavy machinery' },
  other: { th: 'อื่น ๆ', en: 'Other cargo' },
};
export const VEHICLE_CATEGORIES: CargoCategory[] = ['car', 'motorcycle', 'truck', 'heavy_machinery'];

export const TRANSPORT_MODE: Record<TransportMode, L & { dth: string; den: string }> = {
  port_to_port: { th: 'ท่าเรือ → ท่าเรือ', en: 'Port to port', dth: 'นำสินค้ามาส่งที่ท่าเรือต้นทาง รับที่ท่าเรือปลายทาง', den: 'Drop off at origin port, collect at destination port' },
  door_to_port: { th: 'รับถึงที่ → ท่าเรือ', en: 'Door to port', dth: 'รถเข้ารับสินค้า ส่งถึงท่าเรือปลายทาง', den: 'We pick up, you collect at destination port' },
  port_to_door: { th: 'ท่าเรือ → ส่งถึงที่', en: 'Port to door', dth: 'นำมาส่งที่ท่าเรือ เราจัดส่งถึงปลายทาง', den: 'Drop off at port, we deliver to your site' },
  door_to_door: { th: 'รับถึงที่ → ส่งถึงที่', en: 'Door to door', dth: 'รับและส่งถึงหน้างาน', den: 'Pick-up and delivery to your site' },
};

export const CONSTRUCTION_SERVICE: Record<ConstructionService, L> = {
  residential: { th: 'ก่อสร้างที่พักอาศัย', en: 'Residential construction' },
  commercial: { th: 'ก่อสร้างอาคารพาณิชย์', en: 'Commercial construction' },
  renovation: { th: 'ปรับปรุง/รีโนเวทอาคาร', en: 'Building renovation' },
  land_preparation: { th: 'ปรับพื้นที่/ถมดิน', en: 'Land preparation' },
  excavation: { th: 'งานขุด', en: 'Excavation' },
  foundation: { th: 'งานฐานราก', en: 'Foundation work' },
  concrete: { th: 'งานคอนกรีต', en: 'Concrete work' },
  demolition: { th: 'งานรื้อถอน', en: 'Demolition' },
  general: { th: 'งานก่อสร้างทั่วไป', en: 'General construction' },
};

export const CONSTRUCTION_STATUS: Record<ConstructionStatus, L> = {
  submitted: { th: 'ส่งคำขอแล้ว', en: 'Submitted' },
  contacted: { th: 'เจ้าหน้าที่ติดต่อแล้ว', en: 'Contacted' },
  inspection_scheduled: { th: 'นัดสำรวจหน้างาน', en: 'Site inspection scheduled' },
  quotation_sent: { th: 'ส่งใบเสนอราคาแล้ว', en: 'Quotation sent' },
  accepted: { th: 'ลูกค้ายอมรับ', en: 'Accepted' },
  rejected: { th: 'ลูกค้าปฏิเสธ', en: 'Rejected' },
  in_progress: { th: 'กำลังดำเนินงาน', en: 'In progress' },
  completed: { th: 'แล้วเสร็จ', en: 'Completed' },
  cancelled: { th: 'ยกเลิก', en: 'Cancelled' },
};

export const MACHINERY_TYPE: Record<MachineryType, L> = {
  dump_truck: { th: 'รถดัมพ์', en: 'Dump truck' },
  crane: { th: 'รถเครน', en: 'Crane truck' },
  excavator: { th: 'รถแบคโฮ / รถขุด', en: 'Excavator' },
  heavy: { th: 'เครื่องจักรหนักอื่น ๆ', en: 'Other heavy machinery' },
  transport: { th: 'รถขนส่งทั่วไป', en: 'General transport vehicle' },
};

export const MACHINERY_STATUS: Record<MachineryBookingStatus, L> = {
  pending_review: { th: 'รอตรวจสอบ', en: 'Pending review' },
  awaiting_quotation: { th: 'รอใบเสนอราคา', en: 'Awaiting quotation' },
  confirmed: { th: 'ยืนยันแล้ว', en: 'Confirmed' },
  in_progress: { th: 'กำลังปฏิบัติงาน', en: 'In progress' },
  completed: { th: 'เสร็จสิ้น', en: 'Completed' },
  cancelled: { th: 'ยกเลิก', en: 'Cancelled' },
  rejected: { th: 'ไม่สามารถให้บริการ', en: 'Rejected' },
};

export const ORDER_STATUS: Record<OrderStatus, L> = {
  quotation_requested: { th: 'ขอใบเสนอราคา', en: 'Quotation requested' },
  quoted: { th: 'เสนอราคาแล้ว', en: 'Quoted' },
  awaiting_payment: { th: 'รอชำระเงิน', en: 'Awaiting payment' },
  confirmed: { th: 'ยืนยันคำสั่งซื้อ', en: 'Confirmed' },
  delivering: { th: 'กำลังจัดส่ง', en: 'Delivering' },
  delivered: { th: 'จัดส่งแล้ว', en: 'Delivered' },
  cancelled: { th: 'ยกเลิก', en: 'Cancelled' },
};

export const QUOTATION_STATUS: Record<string, L> = {
  draft: { th: 'ฉบับร่าง', en: 'Draft' },
  sent: { th: 'รอลูกค้าตอบรับ', en: 'Awaiting response' },
  accepted: { th: 'ยอมรับแล้ว', en: 'Accepted' },
  rejected: { th: 'ปฏิเสธ', en: 'Rejected' },
  expired: { th: 'หมดอายุ', en: 'Expired' },
};

export const ANY_STATUS: Record<string, L> = {
  ...ORDER_STATUS, ...MACHINERY_STATUS, ...CONSTRUCTION_STATUS, ...BOOKING_STATUS,
  pending: { th: 'รอตรวจสอบ', en: 'Pending' },
  verified: { th: 'ตรวจสอบแล้ว', en: 'Verified' },
  open: { th: 'เปิดรับจอง', en: 'Open' },
  full: { th: 'เต็ม', en: 'Full' },
  closed: { th: 'ปิดรับจอง', en: 'Closed' },
};

/** One colour system everywhere: yellow pending · blue confirmed · purple in transit · green completed · red cancelled · grey draft. */
export type StatusTone = 'pending' | 'confirmed' | 'transit' | 'done' | 'cancelled' | 'draft';
export function statusTone(s: string): StatusTone {
  if (['cancelled', 'rejected', 'expired'].includes(s)) return 'cancelled';
  if (['delivered', 'completed', 'paid'].includes(s)) return 'done';
  if (['cargo_received', 'loading', 'in_transit', 'arrived', 'in_progress', 'delivering'].includes(s)) return 'transit';
  if (['confirmed', 'accepted', 'verified', 'open', 'deposit_paid'].includes(s)) return 'confirmed';
  if (['pending_review', 'awaiting_quotation', 'awaiting_payment', 'pending', 'pending_verification', 'submitted', 'contacted',
    'inspection_scheduled', 'quotation_sent', 'quotation_requested', 'quoted', 'sent'].includes(s)) return 'pending';
  return 'draft';
}
