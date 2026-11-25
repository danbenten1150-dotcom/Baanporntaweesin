import { z } from 'zod';

// Shared validation schemas. They run in the browser for instant feedback AND inside the
// data layer before any write. In production the same rules are enforced again in
// Postgres (CHECK constraints + SECURITY DEFINER functions in supabase/migrations).

const phone = z.string().transform((s) => s.replace(/[\s-]/g, '')).pipe(z.string().regex(/^(\+?66|0)\d{8,9}$/, 'phone'));
const optStr = z.string().trim().max(500).optional().or(z.literal(''));

export const contactSchema = z.object({
  type: z.enum(['individual', 'company']),
  full_name: z.string().trim().min(2, 'required').max(120),
  company_name: optStr,
  phone,
  email: z.string().trim().email('email').optional().or(z.literal('')),
  line_id: optStr,
  tax_id: z.string().trim().regex(/^\d{13}$/, 'tax').optional().or(z.literal('')),
}).transform((v) => ({ ...v, type: v.company_name ? 'company' as const : v.type }));
// company name and tax ID are optional for customers (a tax ID, if given, must be 13 digits)

export const cargoItemSchema = z.object({
  category: z.enum(['general', 'construction_materials', 'sand_stone', 'cement', 'car', 'motorcycle', 'truck', 'heavy_machinery', 'other']),
  description: z.string().trim().min(2, 'required').max(500),
  quantity: z.coerce.number().int().min(1, 'min1').max(100000),
  weight: z.preprocess((x) => (x === '' || x == null ? null : Number(x)), z.number().positive('positive').max(1_000_000).nullable()),
  weight_unit: z.enum(['kg', 'ton']),
  weight_unknown: z.boolean().optional(),
  size_unknown: z.boolean().optional(),
  length_m: z.coerce.number().min(0).max(100).nullable().optional(),
  width_m: z.coerce.number().min(0).max(100).nullable().optional(),
  height_m: z.coerce.number().min(0).max(100).nullable().optional(),
  vehicle_reg: optStr,
  special: optStr,
}).superRefine((v, ctx) => {
  if (!v.weight_unknown && v.weight == null) ctx.addIssue({ code: 'custom', path: ['weight'], message: 'weight' });
});

export const cargoBookingSchema = z.object({
  route_id: z.string().min(1, 'required'),
  schedule_id: z.string().nullable().optional(), // optional: staff can assign a sailing
  ship_date: z.string().min(1, 'date'),
  notes: optStr,
  transport_mode: z.enum(['port_to_port', 'door_to_port', 'port_to_door', 'door_to_door']),
  items: z.array(cargoItemSchema).min(1),
  contact: contactSchema,
  pickup_location: optStr,
  delivery_location: optStr,
  files: z.array(z.string()).max(16),
  accept_terms: z.literal(true, { errorMap: () => ({ message: 'terms' }) }),
}).superRefine((v, ctx) => {
  if ((v.transport_mode === 'door_to_port' || v.transport_mode === 'door_to_door') && !v.pickup_location)
    ctx.addIssue({ code: 'custom', path: ['pickup_location'], message: 'required' });
  if ((v.transport_mode === 'port_to_door' || v.transport_mode === 'door_to_door') && !v.delivery_location)
    ctx.addIssue({ code: 'custom', path: ['delivery_location'], message: 'required' });
});

export const constructionSchema = z.object({
  project_type: z.enum(['residential', 'commercial', 'renovation', 'land_preparation', 'excavation', 'foundation', 'concrete', 'demolition', 'general']),
  location: z.string().trim().min(3, 'required').max(300),
  project_size: optStr, land_size: optStr, budget: optStr,
  start_date: optStr, end_date: optStr, inspection_date: optStr,
  description: z.string().trim().min(10, 'min10').max(4000),
  files: z.array(z.string()).max(16),
  contact: contactSchema,
  accept_terms: z.literal(true, { errorMap: () => ({ message: 'terms' }) }),
});

export const machinerySchema = z.object({
  machinery_type: z.enum(['dump_truck', 'crane', 'excavator', 'heavy', 'transport']),
  capacity: optStr,
  location: z.string().trim().min(3, 'required').max(300),
  start_date: z.string().min(1, 'required'),
  duration: z.coerce.number().int().min(1, 'min1').max(365),
  rate_unit: z.enum(['hour', 'day']),
  operator: z.boolean(),
  description: z.string().trim().min(5, 'min5').max(4000),
  files: z.array(z.string()).max(16),
  contact: contactSchema,
  accept_terms: z.literal(true, { errorMap: () => ({ message: 'terms' }) }),
});

export const sleeperSchema = z.object({
  direction: z.enum(['cpn_tao', 'tao_cpn']),
  travel_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date'),
  passengers: z.array(z.object({
    full_name: z.string().trim().min(2, 'required').max(120),
    nationality: optStr,
  })).min(1, 'min1').max(30),
  contact: contactSchema,
  notes: optStr,
  accept_terms: z.literal(true, { errorMap: () => ({ message: 'terms' }) }),
});

export const orderSchema = z.object({
  lines: z.array(z.object({ product_id: z.string(), qty: z.coerce.number().positive() })).min(1, 'empty'),
  delivery_location: z.string().trim().min(3, 'required').max(300),
  with_transport: z.boolean(),
  route_id: z.string().optional().nullable(),
  notes: optStr,
  contact: contactSchema,
  accept_terms: z.literal(true, { errorMap: () => ({ message: 'terms' }) }),
});

export const quoteRequestSchema = z.object({
  service: z.string().min(1, 'required'),
  message: z.string().trim().min(5, 'min5').max(4000),
  contact: contactSchema,
});

export const ERR_TEXT: Record<string, { th: string; en: string }> = {
  required: { th: 'กรุณากรอกช่องนี้', en: 'Please fill this in' },
  phone: { th: 'เบอร์โทรไม่ถูกต้อง ลองพิมพ์ใหม่ เช่น 081 234 5678', en: 'Phone number looks wrong, e.g. 081 234 5678' },
  email: { th: 'อีเมลไม่ถูกต้อง', en: 'Invalid email' },
  tax: { th: 'เลขประจำตัวผู้เสียภาษี 13 หลัก', en: '13-digit tax ID required' },
  min1: { th: 'อย่างน้อย 1', en: 'At least 1' },
  min5: { th: 'กรุณาระบุรายละเอียดเพิ่มเติม', en: 'Please add more detail' },
  min10: { th: 'กรุณาอธิบายอย่างน้อย 10 ตัวอักษร', en: 'At least 10 characters' },
  positive: { th: 'ต้องมากกว่า 0', en: 'Must be greater than 0' },
  terms: { th: 'กรุณากดยอมรับเงื่อนไขก่อนส่ง', en: 'Please accept the terms' },
  weight: { th: 'กรุณาใส่น้ำหนัก หรือเลือก “ไม่ทราบน้ำหนัก”', en: 'Enter a weight or tick “weight unknown”' },
  date: { th: 'กรุณาเลือกวันที่', en: 'Please choose a date' },
  empty: { th: 'ไม่มีสินค้าในตะกร้า', en: 'Cart is empty' },
};

/** Flatten zod errors into { 'contact.phone': 'phone' } */
export function flattenErrors(err: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of err.issues) {
    const k = i.path.join('.');
    if (!out[k]) out[k] = i.message;
  }
  return out;
}

export class ValidationError extends Error {
  fields: Record<string, string>;
  constructor(fields: Record<string, string>) {
    super('validation');
    this.fields = fields;
  }
}
export class BusinessError extends Error {
  code: string;
  th: string;
  en: string;
  constructor(code: string, th: string, en: string) {
    super(en);
    this.code = code; this.th = th; this.en = en;
  }
}
