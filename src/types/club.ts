export type UserRole = "none" | "admin" | "coach";

export type Player = {
  id: string;
  full_name: string;
  age_group: string;
  birth_date: string | null;
  position: string | null;
  jersey_number: number | null;
  parent_phone: string | null;
  player_code: string | null;
  player_pin: string | null;
  pin_changed?: boolean;
  is_representative?: boolean;
  license_no?: string | null;
  bound_device_id?: string | null;
  photo_url?: string | null;
  card_theme?: string | null;
  card_badge?: string | null;
  card_motto?: string | null;
};

export type MatchPrediction = {
  id: string;
  player_id: string;
  age_group: string;
  match_title: string;
  home_score: number;
  away_score: number;
  first_scorer_name?: string | null;
  created_at?: string;
};

export type Due = {
  id: string;
  player_id: string;
  month_label: string;
  amount: number;
  status: string;
  paid_at?: string | null;
};

export type TaskAssignment = {
  id: string;
  title: string;
  task_type: string;
  age_group: string;
  event_date: string;
  match_time?: string | null;
  has_shuttle?: boolean | null;
  squad_player_ids?: string[] | null;
  location: string;
  notes: string | null;
};

export type PrayerSession = {
  id: string;
  title: string;
  qr_token: string;
  session_date: string;
  is_active: boolean;
};

export type PrayerAttendance = {
  id: string;
  session_id: string;
  player_id: string;
  checked_in_at: string;
};

export type Coach = {
  id: string;
  full_name: string;
  coach_code: string;
  pin: string;
  phone: string | null;
  assigned_groups: string[];
  is_active: boolean;
};

export type Training = {
  id: string;
  title: string;
  training_type: "duzenli" | "ekstra";
  age_groups: string[];
  day_of_week: string | null;
  training_date: string | null;
  start_time: string;
  end_time: string | null;
  location: string | null;
  coach_id?: string | null;
  coach_name?: string | null;
  extra_player_ids: string[];
  notes: string | null;
  created_by: string | null;
};

export type MembershipRequest = {
  id: string;
  full_name: string;
  birth_date: string | null;
  age_group: string;
  parent_phone: string;
  position: string | null;
  license_no?: string | null;
  notes: string | null;
  status: string;
  created_at: string;
};

export type ActivityLog = {
  id: string;
  actor: string;
  action: string;
  details: string;
  created_at: string;
};

export const POSITIONS = ["Kaleci", "Defans", "Orta Saha", "Forvet"] as const;

export const AGE_GROUPS = [
  "U11",
  "U12",
  "U13",
  "U14",
  "U15",
  "U16",
  "U17",
  "U19",
  "Çorum Süper Amatör Ligi",
] as const;

export const DAYS_OF_WEEK = [
  "Pazartesi",
  "Salı",
  "Çarşamba",
  "Perşembe",
  "Cuma",
  "Cumartesi",
  "Pazar",
] as const;

export const MATCH_FIELDS = [
  "Nazmi Avluca Spor Tesisi",
  "İtfaiye Sahası",
  "Devane Sahası",
  "Mimarsinan Sahası",
  "Diğer",
] as const;

export const TR_MONTHS = [
  "Ocak",
  "Şubat",
  "Mart",
  "Nisan",
  "Mayıs",
  "Haziran",
  "Temmuz",
  "Ağustos",
  "Eylül",
  "Ekim",
  "Kasım",
  "Aralık",
] as const;

export const NAZMI_AVLUCA =
  "Nazmi Avluca Spor Tesisi — Ulukavak Mah., Çiftlik Çayırı 2. Cad. (Çiftlik Çayırı - Küçük Evler Yolu civarı), Merkez / Çorum";

export type EquipmentLog = {
  id: string;
  player_id: string;
  jersey_set_id: string | null;
  item_name: string;
  item_size: string | null;
  jersey_number_given: number | null;
  category: string | null;
  given_date: string;
  status: "teslim_edildi" | "iade_edildi" | "kayip_eksik";
};

export type JerseySetMini = {
  id: string;
  set_name: string;
  kit_type: string;
  photo_url: string | null;
};

export type StockItemMini = {
  id: string;
  product_name: string;
  category: string;
  photo_url: string | null;
};

export interface JerseyPiece {
  id: string;
  number: number;
  size: string;
  is_goalkeeper: boolean;
}

export interface JerseySet {
  id: string;
  set_name: string;
  kit_type: "Ev" | "Deplasman" | "Alternatif" | "Özel";
  photo_url: string | null;
  total_quantity: number;
  items?: JerseyPiece[] | null;
}

export interface StockItem {
  id: string;
  product_name: string;
  category: string;
  stock_count: number;
  photo_url?: string | null;
  size_info?: string | null;
}

export const SIZE_OPTIONS = ["XS", "S", "M", "L", "XL", "2XL", "3XL"] as const;