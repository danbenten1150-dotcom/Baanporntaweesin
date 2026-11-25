-- ════════════════════════════════════════════════════════════════════
-- Seed data
-- Part 1 (structural, safe for production): ports, routes, product categories.
-- Part 2 (DEMO ONLY, is_demo = true): fictional vessels, schedules, products,
--         machinery. Delete with the statement at the bottom before go-live.
-- No prices, real vessel names, timetables, contacts or bank details are seeded.
-- ════════════════════════════════════════════════════════════════════

insert into ports (id, code, name_th, name_en) values
  ('p-cpn','CPN','ชุมพร','Chumphon'),
  ('p-kto','KTO','เกาะเต่า','Koh Tao'),
  ('p-kpg','KPG','เกาะพะงัน','Koh Phangan')
on conflict do nothing;

insert into routes (id, code, origin_port_id, dest_port_id, name_th, name_en) values
  ('r-cpn-kto','CPN-KTO','p-cpn','p-kto','ชุมพร – เกาะเต่า','Chumphon – Koh Tao'),
  ('r-kto-cpn','KTO-CPN','p-kto','p-cpn','เกาะเต่า – ชุมพร','Koh Tao – Chumphon'),
  ('r-cpn-kpg','CPN-KPG','p-cpn','p-kpg','ชุมพร – เกาะพะงัน','Chumphon – Koh Phangan'),
  ('r-kpg-cpn','KPG-CPN','p-kpg','p-cpn','เกาะพะงัน – ชุมพร','Koh Phangan – Chumphon')
on conflict do nothing;

insert into product_categories (id, slug, name_th, name_en, sort) values
  ('c-sand','sand','ทราย','Sand',0), ('c-gravel','gravel','หินและกรวด','Gravel & stone',1),
  ('c-cement','cement','ปูนซีเมนต์','Cement',2), ('c-pipes','pipes','ท่อคอนกรีต','Concrete pipes',3),
  ('c-rings','rings','บ่อคอนกรีต','Concrete rings',4), ('c-bricks','bricks','อิฐและบล็อก','Bricks & blocks',5),
  ('c-steel','steel','เหล็ก','Steel',6), ('c-other','other','วัสดุอื่น ๆ','Other materials',7)
on conflict do nothing;

-- ───────── DEMO ONLY ─────────
insert into vessels (id, name, vessel_type, cargo_capacity_tons, vehicle_capacity, status, notes, is_demo) values
  ('v-demo-a','DEMO Vessel A (ตัวอย่าง)','Cargo / Ro-Ro',120,8,'active','ข้อมูลตัวอย่าง',true),
  ('v-demo-b','DEMO Vessel B (ตัวอย่าง)','Cargo barge',200,4,'active','ข้อมูลตัวอย่าง',true)
on conflict do nothing;

insert into sailing_schedules (route_id, vessel_id, depart_at, arrive_at, capacity_tons, vehicle_slots, is_demo)
select r.route_id, r.vessel_id,
       (d::date + r.dep) at time zone 'Asia/Bangkok', (d::date + r.arr) at time zone 'Asia/Bangkok',
       v.cargo_capacity_tons, v.vehicle_capacity, true
from generate_series((now() at time zone 'Asia/Bangkok')::date + 1, (now() at time zone 'Asia/Bangkok')::date + 14, interval '1 day') d
cross join (values ('r-cpn-kto','v-demo-a',time '08:00',time '11:00'), ('r-kto-cpn','v-demo-a',time '14:00',time '17:00'),
                   ('r-cpn-kpg','v-demo-b',time '07:00',time '12:00'), ('r-kpg-cpn','v-demo-b',time '14:00',time '19:00')) as r(route_id, vessel_id, dep, arr)
join vessels v on v.id = r.vessel_id;

insert into products (id, category_id, name_th, name_en, desc_th, desc_en, unit_th, unit_en, is_demo) values
  ('pr-sand-fine','c-sand','ทรายละเอียด','Fine sand','สำหรับงานฉาบและงานก่อ','For plastering and masonry','คิว','m³',true),
  ('pr-stone-34','c-gravel','หิน 3/4','Crushed stone 3/4"','สำหรับงานคอนกรีตโครงสร้าง','For structural concrete','คิว','m³',true),
  ('pr-cement-portland','c-cement','ปูนซีเมนต์ปอร์ตแลนด์','Portland cement','ปูนสำหรับงานโครงสร้าง','Structural cement','ถุง','bag',true),
  ('pr-pipe-60','c-pipes','ท่อคอนกรีต ø60 ซม.','Concrete pipe ø60 cm','ท่อระบายน้ำ','Drainage pipe','ท่อน','piece',true),
  ('pr-ring-100','c-rings','บ่อคอนกรีต ø100 ซม.','Concrete ring ø100 cm','บ่อพัก บ่อเกรอะ','Manholes and septic tanks','วง','ring',true),
  ('pr-brick-red','c-bricks','อิฐมอญ','Clay brick','อิฐก่อผนัง','Wall brick','ก้อน','piece',true),
  ('pr-steel-db','c-steel','เหล็กข้ออ้อย','Deformed steel bar','เหล็กเสริมคอนกรีต','Reinforcing bar','เส้น','bar',true)
on conflict do nothing;

insert into machinery (id, machinery_type, name, capacity, is_demo) values
  ('m-demo-1','dump_truck','DEMO รถดัมพ์ 1','ตัวอย่าง',true),
  ('m-demo-2','crane','DEMO รถเครน 1','ตัวอย่าง',true),
  ('m-demo-3','excavator','DEMO รถแบคโฮ 1','ตัวอย่าง',true)
on conflict do nothing;

-- Remove ALL demo data before go-live:
-- delete from sailing_schedules where is_demo; delete from vessels where is_demo;
-- delete from products where is_demo; delete from machinery where is_demo;
