
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      customers: {
        Row: {
          alt_phone: string | null
          email: string | null
          id: string
          name: string
          phone: string
          created_at: string
          location: string | null
          transactional_sms_consent: boolean | null
          transactional_sms_consent_at: string | null
          marketing_sms_consent: boolean | null
          marketing_sms_consent_at: string | null
          consent_source: string | null
          consent_method: string | null
          consent_ip: string | null
          consent_form_version: string | null
          revoked_at: string | null
          revoked_reason: string | null
        }
        Insert: {
          alt_phone?: string | null
          email?: string | null
          id?: string
          name: string
          phone: string
          created_at?: string
          location?: string | null
          transactional_sms_consent?: boolean | null
          transactional_sms_consent_at?: string | null
          marketing_sms_consent?: boolean | null
          marketing_sms_consent_at?: string | null
          consent_source?: string | null
          consent_method?: string | null
          consent_ip?: string | null
          consent_form_version?: string | null
          revoked_at?: string | null
          revoked_reason?: string | null
        }
        Update: {
          alt_phone?: string | null
          email?: string | null
          id?: string
          name?: string
          phone?: string
          created_at?: string
          location?: string | null
          transactional_sms_consent?: boolean | null
          transactional_sms_consent_at?: string | null
          marketing_sms_consent?: boolean | null
          marketing_sms_consent_at?: string | null
          consent_source?: string | null
          consent_method?: string | null
          consent_ip?: string | null
          consent_form_version?: string | null
          revoked_at?: string | null
          revoked_reason?: string | null
        }
        Relationships: []
      }
      tickets: {
        Row: {
          created_at: string
          customer_id: string
          device: string
          id: string
          is_paid: boolean | null
          payment_method: string | null
          price: number | null
          problem_description: string
          serial_number: string | null
          location: string | null
          heard_from: string | null
          promo_code: string | null
          status: string | null
          repair_type: string | null
          estimated_cost: string | null
        }
        Insert: {
          created_at?: string
          customer_id: string
          device: string
          id?: string
          is_paid?: boolean | null
          payment_method?: string | null
          price?: number | null
          problem_description: string
          serial_number?: string | null
          location?: string | null
          heard_from?: string | null
          promo_code?: string | null
          status?: string | null
          repair_type?: string | null
          estimated_cost?: string | null
        }
        Update: {
          created_at?: string
          customer_id?: string
          device?: string
          id?: string
          is_paid?: boolean | null
          payment_method?: string | null
          price?: number | null
          problem_description?: string
          serial_number?: string | null
          location?: string | null
          heard_from?: string | null
          promo_code?: string | null
          status?: string | null
          repair_type?: string | null
          estimated_cost?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tickets_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          }
        ]
      }
      quotes: {
        Row: {
          id: string
          created_at: string
          customer_name: string | null
          email: string | null
          phone: string | null
          brand: string | null
          model: string | null
          issue: string | null
          notes: string | null
          price: number | null
          is_manual: boolean
          status: string
          location: string | null
        }
        Insert: {
          id?: string
          created_at?: string
          customer_name?: string | null
          email?: string | null
          phone?: string | null
          brand?: string | null
          model?: string | null
          issue?: string | null
          notes?: string | null
          price?: number | null
          is_manual?: boolean
          status?: string
          location?: string | null
        }
        Update: {
          id?: string
          created_at?: string
          customer_name?: string | null
          email?: string | null
          phone?: string | null
          brand?: string | null
          model?: string | null
          issue?: string | null
          notes?: string | null
          price?: number | null
          is_manual?: boolean
          status?: string
          location?: string | null
        }
        Relationships: []
      }
      appointments: {
        Row: {
          id: string
          created_at: string
          customer_name: string
          phone: string
          brand: string
          model: string
          issue: string
          date: string
          time_window: string
          status: string
          location: string | null
        }
        Insert: {
          id?: string
          created_at?: string
          customer_name: string
          phone: string
          brand: string
          model: string
          issue: string
          date: string
          time_window: string
          status?: string
          location?: string | null
        }
        Update: {
          id?: string
          created_at?: string
          customer_name?: string
          phone?: string
          brand?: string
          model?: string
          issue?: string
          date?: string
          time_window?: string
          status?: string
          location?: string | null
        }
        Relationships: []
      }
      sms_consent_events: {
        Row: {
          id: string
          customer_id: string | null
          phone: string
          consent_type: string
          status: boolean
          event_at: string
          source: string
          message_sid: string | null
          notes: Json | null
        }
        Insert: {
          id?: string
          customer_id?: string | null
          phone: string
          consent_type: string
          status: boolean
          event_at?: string
          source: string
          message_sid?: string | null
          notes?: Json | null
        }
        Update: {
          id?: string
          customer_id?: string | null
          phone?: string
          consent_type?: string
          status?: boolean
          event_at?: string
          source?: string
          message_sid?: string | null
          notes?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "sms_consent_events_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          }
        ]
      }
      integration_settings: {
        Row: {
          id: string
          created_at: string
          provider: string
          access_token: string | null
          merchant_id: string | null
          selected_device_id: string | null
          is_connected: boolean
        }
        Insert: {
          id?: string
          created_at?: string
          provider: string
          access_token?: string | null
          merchant_id?: string | null
          selected_device_id?: string | null
          is_connected?: boolean
        }
        Update: {
          id?: string
          created_at?: string
          provider?: string
          access_token?: string | null
          merchant_id?: string | null
          selected_device_id?: string | null
          is_connected?: boolean
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

export type Customer = Database['public']['Tables']['customers']['Row'];
export type RepairTicket = Database['public']['Tables']['tickets']['Row'];
export type Quote = Database['public']['Tables']['quotes']['Row'];
export type Appointment = Database['public']['Tables']['appointments']['Row'];
export type SmsConsentEvent = Database['public']['Tables']['sms_consent_events']['Row'];

export interface ShopSettings {
  businessName: string;
  address: string;
  phone: string;
  warrantyTerms: string;
  kioskPassword: string;
}

export interface FullRepairTicket extends RepairTicket {
  customer: Customer;
}

export type View = 'dashboard' | 'add_customer' | 'edit_customer' | 'new_ticket' | 'view_ticket' | 'edit_ticket' | 'kiosk' | 'kiosk_login' | 'kiosk_ticket_view' | 'quotes_dashboard' | 'new_quote' | 'edit_quote' | 'appointments_dashboard' | 'settings';

export type ImportedRow = {
  name: string;
  phone: string;
  alt_phone?: string;
  email?: string;
  device?: string;
  problem_description?: string;
  price?: number;
  payment_method?: string;
};
