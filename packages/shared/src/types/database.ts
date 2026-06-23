// Hand-authored Supabase `Database` type for the Phase 0 schema, so the shared
// client is fully typed before we wire up `supabase gen types`. Keep in sync
// with supabase/migrations. Insert/Update omit DB-managed columns (id, the
// timestamps, created_by, deleted_at) which are filled by defaults/triggers.

import type {
  Asset,
  AssetCategory,
  AssetPhoto,
  Building,
  Floor,
  Location,
  OrgSettings,
  User,
  WorkOrder,
  WorkOrderAttachment,
} from './domain.js';

/** Columns the database fills in itself; optional on insert/update. */
type Managed = 'id' | 'created_at' | 'updated_at' | 'created_by' | 'deleted_at';
/** Nullable columns accept a DB default / null, so they're optional on insert. */
type NullableKeys<T> = { [K in keyof T]-?: null extends T[K] ? K : never }[keyof T];
type OptionalOnInsert<T> = (Managed & keyof T) | NullableKeys<T>;
type Insertable<T> = Omit<T, OptionalOnInsert<T>> & Partial<Pick<T, OptionalOnInsert<T>>>;
type Updatable<T> = Partial<Insertable<T>>;

interface TableShape<T> {
  Row: T;
  Insert: Insertable<T>;
  Update: Updatable<T>;
  Relationships: [];
}

export interface Database {
  public: {
    Tables: {
      org_settings: TableShape<OrgSettings>;
      users: TableShape<User>;
      buildings: TableShape<Building>;
      floors: TableShape<Floor>;
      locations: TableShape<Location>;
      asset_categories: TableShape<AssetCategory>;
      assets: TableShape<Asset>;
      asset_photos: TableShape<AssetPhoto>;
      work_orders: TableShape<WorkOrder>;
      work_order_attachments: TableShape<WorkOrderAttachment>;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      user_role: 'admin' | 'technician' | 'requester' | 'trustee' | 'vendor';
      criticality: 'low' | 'medium' | 'high';
      asset_status: 'active' | 'retired';
      work_order_type: 'reactive' | 'preventive' | 'inspection';
      work_order_priority: 'low' | 'medium' | 'high' | 'urgent';
      work_order_status:
        | 'requested'
        | 'open'
        | 'in_progress'
        | 'on_hold'
        | 'completed'
        | 'closed'
        | 'cancelled';
    };
  };
}
