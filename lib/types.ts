// Domain types shared by the UI, the demo adapter and the Supabase adapter.
// Field names are snake_case so they map 1:1 onto the SQL schema in supabase/migrations.

export type Lang = 'th' | 'en';
export type ID = string;

export type BookingStatus =
  | 'pending_review'
  | 'awaiting_quotation'
  | 'awaiting_payment'
  | 'confirmed'
  | 'cargo_received'
  | 'loading'
  | 'in_transit'
  | 'arrived'
  | 'delivered'
  | 'cancelled';

export type PaymentStatus = 'unpaid' | 'pending_verification' | 'deposit_paid' | 'paid' | 'refunded';

export type TransportMode = 'port_to_port' | 'door_to_port' | 'port_to_door' | 'door_to_door';

export type CargoCategory =
  | 'general' | 'construction_materials' | 'sand_stone' | 'cement' | 'car'
  | 'motorcycle' | 'truck' | 'heavy_machinery' | 'other';

export type ConstructionService =
  | 'residential' | 'commercial' | 'renovation' | 'land_preparation' | 'excavation'
  | 'foundation' | 'concrete' | 'demolition' | 'general';

export type MachineryType = 'dump_truck' | 'crane' | 'excavator' | 'heavy' | 'transport';

export interface StatusEvent { status: string; at: string; note?: string; by?: string }

export interface ContactInfo {
  type: 'individual' | 'company';
  full_name: string;
  company_name?: string;
  phone: string;
  email?: string;
  line_id?: string;
  tax_id?: string;
}

export interface Port { id: ID; code: string; name_th: string; name_en: string }

export interface Route {
  id: ID; code: string; origin_port_id: ID; dest_port_id: ID;
  name_th: string; name_en: string; duration_min: number | null;
  rate_per_ton: number | null; // null = price confirmed by staff
  active: boolean;
}

export interface Vessel {
  id: ID; name: string; vessel_type: string;
  cargo_capacity_tons: number; vehicle_capacity: number;
  status: 'active' | 'maintenance' | 'inactive';
  photo_url?: string | null; notes?: string; is_demo?: boolean;
}

export interface Schedule {
  id: ID; route_id: ID; vessel_id: ID;
  depart_at: string; arrive_at: string;
  capacity_tons: number; booked_tons: number;
  vehicle_slots: number; booked_vehicles: number;
  status: 'open' | 'full' | 'closed' | 'cancelled';
  is_demo?: boolean;
}

export interface CargoItem {
  category: CargoCategory; description: string; quantity: number;
  weight: number | null; weight_unit: 'kg' | 'ton';
  /** customer ticked "ไม่ทราบน้ำหนัก" / "ไม่ทราบขนาด" — staff must fill in before confirming */
  weight_unknown?: boolean; size_unknown?: boolean;
  length_m?: number | null; width_m?: number | null; height_m?: number | null;
  vehicle_reg?: string; special?: string;
}

export interface CargoBooking {
  id: ID; ref: string; customer_id?: ID | null;
  schedule_id: ID | null; route_id: ID; ship_date: string;
  transport_mode: TransportMode;
  items: CargoItem[];
  contact: ContactInfo;
  pickup_location?: string; delivery_location?: string;
  files: string[];
  status: BookingStatus; payment_status: PaymentStatus;
  price: number | null; estimated_price: number | null;
  internal_notes?: string; customer_notes?: string;
  /** true when weight/size unknown or no sailing chosen — staff review required before confirmation */
  needs_review?: boolean;
  history: StatusEvent[];
  created_at: string; is_demo?: boolean;
}

export type ConstructionStatus =
  | 'submitted' | 'contacted' | 'inspection_scheduled' | 'quotation_sent'
  | 'accepted' | 'rejected' | 'in_progress' | 'completed' | 'cancelled';

export interface ConstructionRequest {
  id: ID; ref: string; customer_id?: ID | null;
  project_type: ConstructionService; location: string;
  project_size?: string; land_size?: string; budget?: string;
  start_date?: string; end_date?: string; inspection_date?: string;
  description: string; files: string[]; contact: ContactInfo;
  status: ConstructionStatus; assigned_to?: string; progress: number;
  history: StatusEvent[]; created_at: string; is_demo?: boolean;
}

export interface Machinery {
  id: ID; machinery_type: MachineryType; name: string; capacity: string;
  status: 'available' | 'maintenance' | 'inactive';
  rate_hour: number | null; rate_day: number | null; is_demo?: boolean;
}

export type MachineryBookingStatus =
  | 'pending_review' | 'awaiting_quotation' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'rejected';

export interface MachineryBooking {
  id: ID; ref: string; customer_id?: ID | null;
  machinery_type: MachineryType; machinery_id?: ID | null;
  capacity?: string; location: string; start_date: string;
  duration: number; rate_unit: 'hour' | 'day'; operator: boolean;
  description: string; files: string[]; contact: ContactInfo;
  status: MachineryBookingStatus; history: StatusEvent[];
  created_at: string; is_demo?: boolean;
}

export interface ProductCategory { id: ID; slug: string; name_th: string; name_en: string; sort: number }

export interface Product {
  id: ID; category_id: ID; name_th: string; name_en: string;
  desc_th: string; desc_en: string; spec: string;
  unit_th: string; unit_en: string;
  price: number | null; // null → request quotation
  stock: number | null; // null → ask staff
  delivery: ('pickup' | 'truck' | 'ship')[];
  image_url?: string | null; active: boolean; is_demo?: boolean;
}

export interface CartLine { product_id: ID; qty: number }

export type OrderStatus =
  | 'quotation_requested' | 'quoted' | 'awaiting_payment' | 'confirmed' | 'delivering' | 'delivered' | 'cancelled';

export interface Order {
  id: ID; ref: string; customer_id?: ID | null;
  items: { product_id: ID; name: string; unit: string; qty: number; unit_price: number | null }[];
  delivery_location: string; with_transport: boolean; route_id?: ID | null; notes?: string;
  contact: ContactInfo; status: OrderStatus; payment_status: PaymentStatus;
  subtotal: number | null; history: StatusEvent[]; created_at: string; is_demo?: boolean;
}

export type QuotationKind = 'cargo' | 'construction' | 'machinery' | 'order';
export interface QuotationItem { description: string; qty: number; unit: string; unit_price: number }
export interface Quotation {
  id: ID; ref: string; kind: QuotationKind; target_ref: string; customer_phone: string;
  items: QuotationItem[]; vat_rate: number; deposit_percent: number | null;
  notes?: string; valid_until?: string;
  status: 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired';
  created_at: string; is_demo?: boolean;
}

export interface Payment {
  id: ID; ref: string; target_kind: QuotationKind; target_ref: string; customer_phone: string;
  amount: number; payment_type: 'deposit' | 'full' | 'balance';
  method: 'bank_transfer' | 'promptpay'; slip_name: string;
  status: 'pending' | 'verified' | 'rejected'; note?: string;
  created_at: string; verified_at?: string | null; is_demo?: boolean;
}

export interface AppNotification {
  id: ID; audience: 'admin' | 'customer'; customer_phone?: string;
  title_th: string; title_en: string; body: string; link?: string;
  created_at: string; read: boolean;
}

export interface AuditLog { id: ID; actor: string; action: string; entity: string; entity_ref: string; at: string }

export interface Settings {
  phone: string; email: string; line_id: string; line_url: string;
  address_th: string; address_en: string;
  bank_name: string; bank_account_name: string; bank_account_no: string; promptpay_id: string;
  announcement_th: string; announcement_en: string;
  hero_title_th: string; hero_title_en: string; hero_sub_th: string; hero_sub_en: string;
  hero_image_url: string;
  /** Google Maps link for “ดูตำแหน่งบริษัท” */
  map_url: string;
  /** Photo per homepage service card, keyed by service id (marine, contractor, materials, truck, crane, machinery). */
  service_images: Record<string, string>;
  /** Admin-managed project gallery. */
  gallery: GalleryItem[];
  deposit_percent: number | null;
  transport_modes: Record<TransportMode, boolean>;
  construction_services: Record<ConstructionService, boolean>;
}

export type GalleryCategory = 'cargo' | 'fleet' | 'machinery' | 'projects' | 'delivery';
export interface GalleryItem { id: ID; category: GalleryCategory; url: string; caption_th: string; caption_en: string }

export interface UserProfile {
  id: ID; role: 'customer' | 'staff' | 'admin';
  full_name: string; phone: string; email?: string;
  account_type: 'individual' | 'company'; company_name?: string; tax_id?: string;
  addresses: string[];
}

export interface Store {
  settings: Settings;
  ports: Port[]; routes: Route[]; vessels: Vessel[]; schedules: Schedule[];
  cargo: CargoBooking[]; construction: ConstructionRequest[];
  machinery: Machinery[]; machineryBookings: MachineryBooking[];
  categories: ProductCategory[]; products: Product[]; orders: Order[];
  quotations: Quotation[]; payments: Payment[];
  notifications: AppNotification[]; audit: AuditLog[]; users: UserProfile[];
}

export type Collection = Exclude<keyof Store, 'settings'>;

export interface TrackResult {
  kind: QuotationKind; ref: string; status: string; payment_status?: PaymentStatus;
  route?: string; service_label_th: string; service_label_en: string;
  eta?: string | null; history: StatusEvent[]; created_at: string;
}
