// ⚠️ DEMONSTRATION DATA ONLY.
// Every vessel, schedule, machine and record below is fictional and flagged is_demo.
// No real prices, vessel names, timetables, bank details or contacts are included.
// Administrators replace all of this with real data from the admin dashboard.

import type { Settings, Store } from '../types';
import { ENV_CONTACT } from '../config';

const ALL_TRUE = <K extends string>(keys: K[]) => Object.fromEntries(keys.map((k) => [k, true])) as Record<K, boolean>;

export function defaultSettings(): Settings {
  return {
    phone: ENV_CONTACT.phone, email: ENV_CONTACT.email,
    line_id: ENV_CONTACT.line_id, line_url: ENV_CONTACT.line_url,
    address_th: ENV_CONTACT.address_th, address_en: ENV_CONTACT.address_en,
    bank_name: '', bank_account_name: '', bank_account_no: '', promptpay_id: '',
    announcement_th: '', announcement_en: '',
    hero_title_th: 'เชื่อมทุกการขนส่ง สร้างทุกความเป็นไปได้',
    hero_title_en: 'Connecting Every Destination. Building Every Possibility.',
    hero_sub_th: 'บ้านพรทวีสิน ผู้ให้บริการขนส่งทางทะเล วัสดุก่อสร้าง รับเหมาก่อสร้าง และเครื่องจักรแบบครบวงจร เชื่อมต่อชุมพร เกาะเต่า และเกาะพะงัน',
    hero_sub_en: 'Baan PornTaweesin provides integrated marine cargo transport, construction materials, contracting and heavy machinery — connecting Chumphon, Koh Tao and Koh Phangan.',
    hero_image_url: '',
    map_url: '',
    service_images: {},
    gallery: [],
    deposit_percent: null,
    transport_modes: ALL_TRUE(['port_to_port', 'door_to_port', 'port_to_door', 'door_to_door']),
    construction_services: ALL_TRUE(['residential', 'commercial', 'renovation', 'land_preparation', 'excavation', 'foundation', 'concrete', 'demolition', 'general']),
  };
}

function bkkISO(dayOffset: number, hh: number, mm = 0) {
  // Build an ISO timestamp for Asia/Bangkok (UTC+7, no DST).
  const now = new Date();
  const bkkNow = new Date(now.getTime() + 7 * 3600_000);
  const y = bkkNow.getUTCFullYear(), m = bkkNow.getUTCMonth(), d = bkkNow.getUTCDate() + dayOffset;
  return new Date(Date.UTC(y, m, d, hh - 7, mm)).toISOString();
}

export function demoSeed(): Store {
  const ports = [
    { id: 'p-cpn', code: 'CPN', name_th: 'ชุมพร', name_en: 'Chumphon' },
    { id: 'p-kto', code: 'KTO', name_th: 'เกาะเต่า', name_en: 'Koh Tao' },
    { id: 'p-kpg', code: 'KPG', name_th: 'เกาะพะงัน', name_en: 'Koh Phangan' },
  ];
  const routes = [
    { id: 'r-cpn-kto', code: 'CPN-KTO', origin_port_id: 'p-cpn', dest_port_id: 'p-kto', name_th: 'ชุมพร – เกาะเต่า', name_en: 'Chumphon – Koh Tao', duration_min: null, rate_per_ton: null, active: true },
    { id: 'r-kto-cpn', code: 'KTO-CPN', origin_port_id: 'p-kto', dest_port_id: 'p-cpn', name_th: 'เกาะเต่า – ชุมพร', name_en: 'Koh Tao – Chumphon', duration_min: null, rate_per_ton: null, active: true },
    { id: 'r-cpn-kpg', code: 'CPN-KPG', origin_port_id: 'p-cpn', dest_port_id: 'p-kpg', name_th: 'ชุมพร – เกาะพะงัน', name_en: 'Chumphon – Koh Phangan', duration_min: null, rate_per_ton: null, active: true },
    { id: 'r-kpg-cpn', code: 'KPG-CPN', origin_port_id: 'p-kpg', dest_port_id: 'p-cpn', name_th: 'เกาะพะงัน – ชุมพร', name_en: 'Koh Phangan – Chumphon', duration_min: null, rate_per_ton: null, active: true },
  ];
  const vessels = [
    { id: 'v-demo-a', name: 'DEMO Vessel A (ตัวอย่าง)', vessel_type: 'Cargo / Ro-Ro', cargo_capacity_tons: 120, vehicle_capacity: 8, status: 'active' as const, notes: 'ข้อมูลตัวอย่าง — แทนที่ด้วยข้อมูลเรือจริง', is_demo: true },
    { id: 'v-demo-b', name: 'DEMO Vessel B (ตัวอย่าง)', vessel_type: 'Cargo barge', cargo_capacity_tons: 200, vehicle_capacity: 4, status: 'active' as const, notes: 'ข้อมูลตัวอย่าง', is_demo: true },
    { id: 'v-demo-c', name: 'DEMO Vessel C (ตัวอย่าง)', vessel_type: 'Cargo', cargo_capacity_tons: 80, vehicle_capacity: 0, status: 'maintenance' as const, notes: 'ข้อมูลตัวอย่าง', is_demo: true },
  ];

  const schedules: Store['schedules'] = [];
  for (let day = 0; day < 21; day++) {
    const pairs: [string, string, number, number][] = [
      ['r-cpn-kto', 'v-demo-a', 8, 11], ['r-kto-cpn', 'v-demo-a', 14, 17],
    ];
    if (day % 2 === 0) pairs.push(['r-cpn-kpg', 'v-demo-b', 7, 12], ['r-kpg-cpn', 'v-demo-b', 14, 19]);
    for (const [route_id, vessel_id, dep, arr] of pairs) {
      const v = vessels.find((x) => x.id === vessel_id)!;
      const booked = day === 1 && route_id === 'r-cpn-kto' ? v.cargo_capacity_tons : day < 4 ? Math.round(v.cargo_capacity_tons * 0.35) : 0;
      schedules.push({
        id: `s-${route_id}-${day}`, route_id, vessel_id,
        depart_at: bkkISO(day, dep), arrive_at: bkkISO(day, arr),
        capacity_tons: v.cargo_capacity_tons, booked_tons: booked,
        vehicle_slots: v.vehicle_capacity, booked_vehicles: day < 3 ? Math.min(2, v.vehicle_capacity) : 0,
        status: booked >= v.cargo_capacity_tons ? 'full' : 'open', is_demo: true,
      });
    }
  }

  const categories = [
    ['sand', 'ทราย', 'Sand'], ['gravel', 'หินและกรวด', 'Gravel & stone'], ['cement', 'ปูนซีเมนต์', 'Cement'],
    ['pipes', 'ท่อคอนกรีต', 'Concrete pipes'], ['rings', 'บ่อคอนกรีต', 'Concrete rings'],
    ['bricks', 'อิฐและบล็อก', 'Bricks & blocks'], ['steel', 'เหล็ก', 'Steel'], ['other', 'วัสดุอื่น ๆ', 'Other materials'],
  ].map(([slug, th, en], i) => ({ id: `c-${slug}`, slug, name_th: th, name_en: en, sort: i }));

  const P = (id: string, cat: string, th: string, en: string, dth: string, den: string, spec: string, uth: string, uen: string, delivery: ('pickup' | 'truck' | 'ship')[] = ['pickup', 'truck', 'ship']) => ({
    id, category_id: `c-${cat}`, name_th: th, name_en: en, desc_th: dth, desc_en: den, spec,
    unit_th: uth, unit_en: uen, price: null, stock: null, delivery, image_url: null, active: true, is_demo: true,
  });
  const products = [
    P('pr-sand-fine', 'sand', 'ทรายละเอียด', 'Fine sand', 'สำหรับงานฉาบและงานก่อ', 'For plastering and masonry', 'ระบุสเปกจริงโดยผู้ดูแล', 'คิว', 'm³'),
    P('pr-sand-coarse', 'sand', 'ทรายหยาบ', 'Coarse sand', 'สำหรับงานผสมคอนกรีต', 'For concrete mixing', 'ระบุสเปกจริงโดยผู้ดูแล', 'คิว', 'm³'),
    P('pr-sand-fill', 'sand', 'ทรายถม', 'Fill sand', 'สำหรับงานถมและปรับระดับ', 'For filling and levelling', 'ระบุสเปกจริงโดยผู้ดูแล', 'คิว', 'm³'),
    P('pr-stone-34', 'gravel', 'หิน 3/4', 'Crushed stone 3/4"', 'สำหรับงานคอนกรีตโครงสร้าง', 'For structural concrete', 'ขนาด 3/4 นิ้ว', 'คิว', 'm³'),
    P('pr-stone-12', 'gravel', 'หิน 1/2 (หินเกล็ด)', 'Crushed stone 1/2"', 'สำหรับงานพื้นและงานหล่อ', 'For slabs and casting', 'ขนาด 1/2 นิ้ว', 'คิว', 'm³'),
    P('pr-stone-dust', 'gravel', 'หินฝุ่น', 'Stone dust', 'สำหรับงานรองพื้นและบดอัด', 'For sub-base and compaction', '—', 'คิว', 'm³'),
    P('pr-cement-portland', 'cement', 'ปูนซีเมนต์ปอร์ตแลนด์', 'Portland cement', 'ปูนสำหรับงานโครงสร้าง', 'Structural cement', 'ระบุยี่ห้อ/น้ำหนักต่อถุงโดยผู้ดูแล', 'ถุง', 'bag'),
    P('pr-cement-mortar', 'cement', 'ปูนก่อ / ปูนฉาบ', 'Masonry / plaster cement', 'สำหรับงานก่อและฉาบ', 'For masonry and plastering', 'ระบุยี่ห้อโดยผู้ดูแล', 'ถุง', 'bag'),
    P('pr-pipe-30', 'pipes', 'ท่อคอนกรีต ø30 ซม.', 'Concrete pipe ø30 cm', 'ท่อระบายน้ำ', 'Drainage pipe', 'ระบุความยาว/ชั้นคุณภาพโดยผู้ดูแล', 'ท่อน', 'piece'),
    P('pr-pipe-60', 'pipes', 'ท่อคอนกรีต ø60 ซม.', 'Concrete pipe ø60 cm', 'ท่อระบายน้ำ', 'Drainage pipe', 'ระบุความยาว/ชั้นคุณภาพโดยผู้ดูแล', 'ท่อน', 'piece'),
    P('pr-ring-80', 'rings', 'บ่อคอนกรีต ø80 ซม.', 'Concrete ring ø80 cm', 'บ่อพัก บ่อเกรอะ', 'Manholes and septic tanks', 'ระบุความสูงโดยผู้ดูแล', 'วง', 'ring'),
    P('pr-ring-100', 'rings', 'บ่อคอนกรีต ø100 ซม.', 'Concrete ring ø100 cm', 'บ่อพัก บ่อเกรอะ', 'Manholes and septic tanks', 'ระบุความสูงโดยผู้ดูแล', 'วง', 'ring'),
    P('pr-brick-red', 'bricks', 'อิฐมอญ', 'Clay brick', 'อิฐก่อผนัง', 'Wall brick', '—', 'ก้อน', 'piece'),
    P('pr-block-light', 'bricks', 'อิฐมวลเบา', 'Lightweight block', 'บล็อกก่อผนังน้ำหนักเบา', 'Lightweight wall block', 'ระบุขนาดโดยผู้ดูแล', 'ก้อน', 'piece'),
    P('pr-steel-db', 'steel', 'เหล็กข้ออ้อย', 'Deformed steel bar', 'เหล็กเสริมคอนกรีต', 'Reinforcing bar', 'ระบุขนาด/มาตรฐาน มอก. โดยผู้ดูแล', 'เส้น', 'bar'),
    P('pr-steel-rb', 'steel', 'เหล็กเส้นกลม', 'Round steel bar', 'เหล็กเสริมงานทั่วไป', 'General reinforcement', 'ระบุขนาดโดยผู้ดูแล', 'เส้น', 'bar'),
    P('pr-other', 'other', 'วัสดุก่อสร้างอื่น ๆ (สั่งพิเศษ)', 'Other materials (special order)', 'แจ้งรายการที่ต้องการ เจ้าหน้าที่จะติดต่อกลับ', 'Tell us what you need and our team will reply', '—', 'รายการ', 'item'),
  ];

  const machinery = [
    { id: 'm-demo-1', machinery_type: 'dump_truck' as const, name: 'DEMO รถดัมพ์ 1', capacity: 'ตัวอย่าง', status: 'available' as const, rate_hour: null, rate_day: null, is_demo: true },
    { id: 'm-demo-2', machinery_type: 'crane' as const, name: 'DEMO รถเครน 1', capacity: 'ตัวอย่าง', status: 'available' as const, rate_hour: null, rate_day: null, is_demo: true },
    { id: 'm-demo-3', machinery_type: 'excavator' as const, name: 'DEMO รถแบคโฮ 1', capacity: 'ตัวอย่าง', status: 'available' as const, rate_hour: null, rate_day: null, is_demo: true },
  ];

  const demoContact = { type: 'individual' as const, full_name: 'ลูกค้าตัวอย่าง (DEMO)', phone: '0800000000', email: 'demo@example.com', line_id: '' };
  const now = new Date().toISOString();
  const s0 = schedules[0];

  return {
    settings: defaultSettings(),
    ports, routes, vessels, schedules,
    cargo: [{
      id: 'cb-demo-1', ref: 'BPT-C-DEMO-0001', schedule_id: s0.id, route_id: s0.route_id, ship_date: s0.depart_at.slice(0, 10),
      transport_mode: 'port_to_door',
      items: [{ category: 'construction_materials', description: 'ปูนซีเมนต์และเหล็กเส้น (ตัวอย่าง)', quantity: 1, weight: 3, weight_unit: 'ton' }],
      contact: demoContact, delivery_location: 'เกาะเต่า (ตัวอย่าง)', files: [],
      status: 'in_transit', payment_status: 'unpaid', price: null, estimated_price: null,
      history: [
        { status: 'pending_review', at: bkkISO(-2, 10), note: 'DEMO' },
        { status: 'confirmed', at: bkkISO(-1, 9), note: 'DEMO' },
        { status: 'cargo_received', at: bkkISO(0, 7), note: 'DEMO' },
        { status: 'loading', at: bkkISO(0, 7, 30), note: 'DEMO' },
        { status: 'in_transit', at: bkkISO(0, 8), note: 'DEMO' },
      ],
      created_at: bkkISO(-2, 10), is_demo: true,
    }],
    construction: [{
      id: 'cr-demo-1', ref: 'BPT-K-DEMO-0001', project_type: 'foundation', location: 'เกาะพะงัน (ตัวอย่าง)',
      description: 'คำขอตัวอย่างสำหรับสาธิตระบบ', files: [], contact: demoContact,
      status: 'inspection_scheduled', progress: 0, inspection_date: bkkISO(3, 10).slice(0, 10),
      history: [{ status: 'submitted', at: bkkISO(-3, 9) }, { status: 'contacted', at: bkkISO(-2, 14) }, { status: 'inspection_scheduled', at: bkkISO(-1, 11) }],
      created_at: bkkISO(-3, 9), is_demo: true,
    }],
    machinery,
    machineryBookings: [{
      id: 'mb-demo-1', ref: 'BPT-M-DEMO-0001', machinery_type: 'excavator', location: 'ชุมพร (ตัวอย่าง)',
      start_date: bkkISO(5, 8).slice(0, 10), duration: 2, rate_unit: 'day', operator: true,
      description: 'คำขอตัวอย่าง', files: [], contact: demoContact, status: 'pending_review',
      history: [{ status: 'pending_review', at: bkkISO(-1, 16) }], created_at: bkkISO(-1, 16), is_demo: true,
    }],
    categories, products,
    orders: [],
    quotations: [],
    payments: [],
    notifications: [{ id: 'n-demo-1', audience: 'admin', title_th: 'มีคำขอจองเรือใหม่ (DEMO)', title_en: 'New cargo booking (DEMO)', body: 'BPT-C-DEMO-0001', created_at: now, read: false }],
    audit: [],
    users: [
      { id: 'u-demo-customer', role: 'customer', full_name: 'ลูกค้าตัวอย่าง (DEMO)', phone: '0800000000', email: 'demo@example.com', account_type: 'individual', addresses: ['เกาะเต่า (ตัวอย่าง)'] },
      { id: 'u-demo-admin', role: 'admin', full_name: 'ผู้ดูแลระบบ (DEMO)', phone: '0899999999', email: 'admin@example.com', account_type: 'individual', addresses: [] },
    ],
  };
}
