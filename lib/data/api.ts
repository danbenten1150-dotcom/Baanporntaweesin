import type {
  AppNotification, BookingStatus, CargoBooking, Collection, ConstructionRequest, ConstructionStatus,
  MachineryBooking, MachineryBookingStatus, Order, OrderStatus, Payment, Quotation, Settings, Store, TrackResult,
  UserProfile,
} from '../types';

export type CargoBookingInput = Omit<CargoBooking, 'id' | 'ref' | 'status' | 'payment_status' | 'price' | 'estimated_price' | 'history' | 'created_at' | 'needs_review'> & { accept_terms: true; notes?: string };
export type ConstructionInput = Omit<ConstructionRequest, 'id' | 'ref' | 'status' | 'progress' | 'history' | 'created_at'> & { accept_terms: true };
export type MachineryInput = Omit<MachineryBooking, 'id' | 'ref' | 'status' | 'history' | 'created_at' | 'machinery_id'> & { accept_terms: true };
export interface OrderInput {
  lines: { product_id: string; qty: number }[];
  delivery_location: string; with_transport: boolean; route_id?: string | null; notes?: string;
  contact: Order['contact']; accept_terms: true;
}
export interface PaymentInput {
  target_kind: Payment['target_kind']; target_ref: string; customer_phone: string;
  amount: number; payment_type: Payment['payment_type']; method: Payment['method']; slip_name: string;
}

export interface CustomerBundle {
  cargo: CargoBooking[]; construction: ConstructionRequest[]; machinery: MachineryBooking[];
  orders: Order[]; quotations: Quotation[]; payments: Payment[]; notifications: AppNotification[];
}

/**
 * The single data-access contract used by every page.
 * - DemoApi (lib/data/demo.ts): in-browser store, clearly labelled demonstration data.
 * - SupabaseApi (lib/data/supabase.ts): production adapter backed by Postgres + RLS + RPCs.
 */
export interface DataApi {
  readonly mode: 'demo' | 'supabase';

  /** Upload customer files. Demo: keeps file names only. Supabase: private Storage bucket, returns object paths. */
  uploadFiles(files: File[], folder: 'cargo' | 'construction' | 'machinery' | 'payments' | 'vessels' | 'products' | 'site'): Promise<string[]>;

  // Public reads
  getStore(): Promise<Store>; // demo: full store; supabase: public subset (+ admin data when authorised)
  getSettings(): Promise<Settings>;

  // Public writes (customer journeys)
  createCargoBooking(input: CargoBookingInput): Promise<CargoBooking>;
  createConstructionRequest(input: ConstructionInput): Promise<ConstructionRequest>;
  createMachineryBooking(input: MachineryInput): Promise<MachineryBooking>;
  createOrder(input: OrderInput): Promise<Order>;
  createQuoteRequest(input: { service: string; message: string; contact: Order['contact'] }): Promise<{ ref: string }>;
  track(ref: string, phone: string): Promise<TrackResult | null>;

  // Customer
  customerBundle(phone: string): Promise<CustomerBundle>;
  respondQuotation(id: string, accept: boolean, phone: string): Promise<void>;
  submitPayment(input: PaymentInput): Promise<Payment>;
  saveProfile(p: UserProfile): Promise<void>;
  markNotificationsRead(phone: string | null, audience: 'admin' | 'customer'): Promise<void>;

  // Admin
  upsert<C extends Collection>(collection: C, record: Store[C][number]): Promise<void>;
  remove(collection: Collection, id: string): Promise<void>;
  saveSettings(s: Settings): Promise<void>;
  confirmCargoBooking(id: string, actor: string): Promise<void>;
  setCargoStatus(id: string, status: BookingStatus, note: string, actor: string): Promise<void>;
  setCargoPrice(id: string, price: number | null, actor: string): Promise<void>;
  /** Staff edit / reschedule. Moves reserved capacity atomically when the booking is already confirmed. */
  updateCargoBooking(id: string, patch: Partial<Pick<CargoBooking, 'items' | 'schedule_id' | 'ship_date' | 'transport_mode' | 'pickup_location' | 'delivery_location'>>, actor: string): Promise<void>;
  updateConstruction(id: string, patch: Partial<ConstructionRequest>, status: ConstructionStatus | null, note: string, actor: string): Promise<void>;
  setMachineryStatus(id: string, status: MachineryBookingStatus, machinery_id: string | null, note: string, actor: string): Promise<void>;
  setOrderStatus(id: string, status: OrderStatus, note: string, actor: string): Promise<void>;
  createQuotation(q: Omit<Quotation, 'id' | 'ref' | 'created_at' | 'status'>, actor: string): Promise<Quotation>;
  verifyPayment(id: string, ok: boolean, note: string, actor: string): Promise<void>;
  resetDemo(): Promise<void>;
}

export const DATA_EVENT = 'bpt:data-changed';
export function emitChange() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(DATA_EVENT));
}

export function quotationTotal(q: Pick<Quotation, 'items' | 'vat_rate'>) {
  const sub = q.items.reduce((s, i) => s + i.qty * i.unit_price, 0);
  const vat = Math.round(sub * q.vat_rate) / 100;
  return { sub, vat, total: sub + vat };
}
