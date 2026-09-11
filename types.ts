
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
          parts_needed: string | null
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
          parts_needed?: string | null
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
          parts_needed?: string | null
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
          sms_reminders_enabled?: boolean | null
          version?: number | null
          location_address?: string | null
          cancelled_at?: string | null
          arrived_at?: string | null
          no_show_at?: string | null
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
          sms_reminders_enabled?: boolean | null
          version?: number | null
          location_address?: string | null
          cancelled_at?: string | null
          arrived_at?: string | null
          no_show_at?: string | null
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
          sms_reminders_enabled?: boolean | null
          version?: number | null
          location_address?: string | null
          cancelled_at?: string | null
          arrived_at?: string | null
          no_show_at?: string | null
        }
        Relationships: []
      }
      appointment_sms_jobs: {
        Row: {
          id: string
          appointment_id: string
          customer_id: string | null
          appointment_version: number
          job_type: 'immediate_confirmation' | 'reminder_24h' | 'reminder_2h' | 'missed_appointment'
          scheduled_for: string
          status: 'pending' | 'claimed' | 'sent' | 'failed' | 'skipped' | 'canceled' | 'uncertain'
          skip_reason: string | null
          error_message: string | null
          provider_message_id: string | null
          retry_count: number
          claimed_at: string | null
          sent_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          appointment_id: string
          customer_id?: string | null
          appointment_version?: number
          job_type: 'immediate_confirmation' | 'reminder_24h' | 'reminder_2h' | 'missed_appointment'
          scheduled_for: string
          status?: 'pending' | 'claimed' | 'sent' | 'failed' | 'skipped' | 'canceled' | 'uncertain'
          skip_reason?: string | null
          error_message?: string | null
          provider_message_id?: string | null
          retry_count?: number
          claimed_at?: string | null
          sent_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          appointment_id?: string
          customer_id?: string | null
          appointment_version?: number
          job_type?: 'immediate_confirmation' | 'reminder_24h' | 'reminder_2h' | 'missed_appointment'
          scheduled_for?: string
          status?: 'pending' | 'claimed' | 'sent' | 'failed' | 'skipped' | 'canceled' | 'uncertain'
          skip_reason?: string | null
          error_message?: string | null
          provider_message_id?: string | null
          retry_count?: number
          claimed_at?: string | null
          sent_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      appointment_sms_settings: {
        Row: {
          id: string
          location: string
          dry_run: boolean
          test_phone_number: string | null
          quiet_hours_enabled: boolean
          quiet_hours_start: string
          quiet_hours_end: string
          timezone: string
          enable_immediate_confirmation: boolean
          enable_reminder_24h: boolean
          enable_reminder_2h: boolean
          enable_missed_appointment: boolean
          template_immediate_confirmation: string
          template_reminder_24h: string
          template_reminder_2h: string
          template_missed_appointment: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          location?: string
          dry_run?: boolean
          test_phone_number?: string | null
          quiet_hours_enabled?: boolean
          quiet_hours_start?: string
          quiet_hours_end?: string
          timezone?: string
          enable_immediate_confirmation?: boolean
          enable_reminder_24h?: boolean
          enable_reminder_2h?: boolean
          enable_missed_appointment?: boolean
          template_immediate_confirmation?: string
          template_reminder_24h?: string
          template_reminder_2h?: string
          template_missed_appointment?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          location?: string
          dry_run?: boolean
          test_phone_number?: string | null
          quiet_hours_enabled?: boolean
          quiet_hours_start?: string
          quiet_hours_end?: string
          timezone?: string
          enable_immediate_confirmation?: boolean
          enable_reminder_24h?: boolean
          enable_reminder_2h?: boolean
          enable_missed_appointment?: boolean
          template_immediate_confirmation?: string
          template_reminder_24h?: string
          template_reminder_2h?: string
          template_missed_appointment?: string
          created_at?: string
          updated_at?: string
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
      parts_orders: {
        Row: {
          id: string
          created_at: string
          part_type: string
          status: string
          notes: string | null
          location: string | null
        }
        Insert: {
          id?: string
          created_at?: string
          part_type: string
          status?: string
          notes?: string | null
          location?: string | null
        }
        Update: {
          id?: string
          created_at?: string
          part_type?: string
          status?: string
          notes?: string | null
          location?: string | null
        }
        Relationships: []
      }
      marketing_campaigns: {
        Row: {
          id: string
          created_at: string
          name: string
          location: string
          message_body: string
          total_recipients: number | null
          successful_sends: number | null
        }
        Insert: {
          id?: string
          created_at?: string
          name: string
          location: string
          message_body: string
          total_recipients?: number | null
          successful_sends?: number | null
        }
        Update: {
          id?: string
          created_at?: string
          name?: string
          location?: string
          message_body?: string
          total_recipients?: number | null
          successful_sends?: number | null
        }
        Relationships: []
      }
      scheduled_campaigns: {
        Row: {
          id: string
          created_at: string
          scheduled_for: string
          name: string
          location: string
          message_body: string
          status: string
          total_recipients: number | null
          successful_sends: number | null
        }
        Insert: {
          id?: string
          created_at?: string
          scheduled_for: string
          name: string
          location: string
          message_body: string
          status?: string
          total_recipients?: number | null
          successful_sends?: number | null
        }
        Update: {
          id?: string
          created_at?: string
          scheduled_for?: string
          name?: string
          location?: string
          message_body?: string
          status?: string
          total_recipients?: number | null
          successful_sends?: number | null
        }
        Relationships: []
      }
      sms_messages: {
        Row: {
          id: string
          created_at: string
          customer_id: string | null
          ticket_id: string | null
          campaign_id: string | null
          message_type: string | null
          content: string
          status: string
          provider_message_id: string | null
          error_message: string | null
          direction: string | null
          from_phone: string | null
          to_phone: string | null
        }
        Insert: {
          id?: string
          created_at?: string
          customer_id?: string | null
          ticket_id?: string | null
          campaign_id?: string | null
          message_type?: string | null
          content: string
          status: string
          provider_message_id?: string | null
          error_message?: string | null
          direction?: string | null
          from_phone?: string | null
          to_phone?: string | null
        }
        Update: {
          id?: string
          created_at?: string
          customer_id?: string | null
          ticket_id?: string | null
          campaign_id?: string | null
          message_type?: string | null
          content?: string
          status?: string
          provider_message_id?: string | null
          error_message?: string | null
          direction?: string | null
          from_phone?: string | null
          to_phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sms_messages_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_messages_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "marketing_campaigns"
            referencedColumns: ["id"]
          }
        ]
      }
      repair_prices: {
        Row: {
          id: string
          created_at: string
          brand: string
          model: string
          category: string
          price: string
          lcd_price: string | null
          oled_price: string | null
          oem_price: string | null
        }
        Insert: {
          id?: string
          created_at?: string
          brand: string
          model: string
          category: string
          price: string
          lcd_price?: string | null
          oled_price?: string | null
          oem_price?: string | null
        }
        Update: {
          id?: string
          created_at?: string
          brand?: string
          model?: string
          category?: string
          price?: string
          lcd_price?: string | null
          oled_price?: string | null
          oem_price?: string | null
        }
        Relationships: []
      }
      automations: {
        Row: {
          id: string
          name: string
          status: string
          trigger_type: string
          trigger_config: Record<string, any>
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name?: string
          status?: string
          trigger_type?: string
          trigger_config?: Record<string, any>
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          status?: string
          trigger_type?: string
          trigger_config?: Record<string, any>
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      automation_nodes: {
        Row: {
          id: string
          automation_id: string
          type: string
          config: Record<string, any>
          position_x: number
          position_y: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          automation_id: string
          type: string
          config?: Record<string, any>
          position_x?: number
          position_y?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          automation_id?: string
          type?: string
          config?: Record<string, any>
          position_x?: number
          position_y?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      automation_edges: {
        Row: {
          id: string
          automation_id: string
          source_node_id: string
          target_node_id: string
          source_handle: string
          created_at: string
        }
        Insert: {
          id?: string
          automation_id: string
          source_node_id: string
          target_node_id: string
          source_handle?: string
          created_at?: string
        }
        Update: {
          id?: string
          automation_id?: string
          source_node_id?: string
          target_node_id?: string
          source_handle?: string
          created_at?: string
        }
        Relationships: []
      }
      automation_enrollments: {
        Row: {
          id: string
          automation_id: string
          contact_id: string
          current_node_id: string | null
          status: string
          enrolled_at: string
          next_execution_at: string | null
          completed_at: string | null
          processing_locked_at: string | null
          error_message: string | null
          metadata: Record<string, any>
        }
        Insert: {
          id?: string
          automation_id: string
          contact_id: string
          current_node_id?: string | null
          status?: string
          enrolled_at?: string
          next_execution_at?: string | null
          completed_at?: string | null
          processing_locked_at?: string | null
          error_message?: string | null
          metadata?: Record<string, any>
        }
        Update: {
          id?: string
          automation_id?: string
          contact_id?: string
          current_node_id?: string | null
          status?: string
          enrolled_at?: string
          next_execution_at?: string | null
          completed_at?: string | null
          processing_locked_at?: string | null
          error_message?: string | null
          metadata?: Record<string, any>
        }
        Relationships: []
      }
      automation_execution_log: {
        Row: {
          id: string
          enrollment_id: string
          automation_id: string
          contact_id: string
          node_id: string | null
          node_type: string | null
          action: string
          result: Record<string, any>
          executed_at: string
          error_message: string | null
        }
        Insert: {
          id?: string
          enrollment_id: string
          automation_id: string
          contact_id: string
          node_id?: string | null
          node_type?: string | null
          action: string
          result?: Record<string, any>
          executed_at?: string
          error_message?: string | null
        }
        Update: {
          id?: string
          enrollment_id?: string
          automation_id?: string
          contact_id?: string
          node_id?: string | null
          node_type?: string | null
          action?: string
          result?: Record<string, any>
          executed_at?: string
          error_message?: string | null
        }
        Relationships: []
      }
      customer_tags: {
        Row: {
          id: string
          customer_id: string
          tag: string
          created_at: string
        }
        Insert: {
          id?: string
          customer_id: string
          tag: string
          created_at?: string
        }
        Update: {
          id?: string
          customer_id?: string
          tag?: string
          created_at?: string
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
export type AppointmentSmsJob = Database['public']['Tables']['appointment_sms_jobs']['Row'];
export type AppointmentSmsSettings = Database['public']['Tables']['appointment_sms_settings']['Row'];
export type SmsConsentEvent = Database['public']['Tables']['sms_consent_events']['Row'];
export type PartsOrder = Database['public']['Tables']['parts_orders']['Row'];

export interface ShopSettings {
  businessName: string;
  address: string;
  phone: string;
  warrantyTerms: string;
  kioskPassword: string;
  analyticsPassword?: string;
}

export interface FullRepairTicket extends RepairTicket {
  customer: Customer;
}

export interface MarketingCampaign {
  id: string;
  created_at: string;
  name: string;
  location: string;
  message_body: string;
  total_recipients: number;
  successful_sends: number;
}

export interface ScheduledCampaign {
  id: string;
  created_at: string;
  scheduled_for: string;
  name: string;
  location: string;
  message_body: string;
  status: 'pending' | 'sending' | 'completed' | 'failed';
  total_recipients: number;
  successful_sends: number;
}

export interface SmsLog {
  id: string;
  created_at: string;
  customer_id: string | null;
  ticket_id?: string | null;
  campaign_id?: string | null;
  message_type: string;
  direction?: 'inbound' | 'outbound';
  content: string;
  status: string;
  provider_message_id?: string | null;
  error_message?: string | null;
  from_phone?: string | null;
  to_phone?: string | null;
}

export type View = 'dashboard' | 'add_customer' | 'edit_customer' | 'new_ticket' | 'view_ticket' | 'edit_ticket' | 'kiosk' | 'kiosk_login' | 'kiosk_ticket_view' | 'quotes_dashboard' | 'new_quote' | 'edit_quote' | 'appointments_dashboard' | 'settings' | 'parts_dashboard' | 'quote_widget' | 'campaigns' | 'messages' | 'analytics';

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

// ============================================================
// AUTOMATION TYPES
// ============================================================

export type AutomationStatus = 'draft' | 'active' | 'paused';
export type AutomationTriggerType = 'manual' | 'keyword_reply';
export type AutomationNodeType = 'trigger' | 'send_sms' | 'wait' | 'condition' | 'update_tag' | 'end';
export type AutomationEnrollmentStatus = 'active' | 'completed' | 'failed' | 'paused';

export interface Automation {
  id: string;
  name: string;
  status: AutomationStatus;
  trigger_type: AutomationTriggerType;
  trigger_config: Record<string, any>;
  created_at: string;
  updated_at: string;
  // Computed / joined
  active_enrollments?: number;
  completed_enrollments?: number;
}

export interface AutomationNode {
  id: string;
  automation_id: string;
  type: AutomationNodeType;
  config: AutomationNodeConfig;
  position_x: number;
  position_y: number;
  created_at: string;
  updated_at: string;
}

// Discriminated union config per node type
export type AutomationNodeConfig =
  | TriggerNodeConfig
  | SendSmsNodeConfig
  | WaitNodeConfig
  | ConditionNodeConfig
  | UpdateTagNodeConfig
  | EndNodeConfig;

export interface TriggerNodeConfig {
  trigger_type: AutomationTriggerType;
  keyword?: string;            // for keyword_reply trigger
  label?: string;
}

export interface SendSmsNodeConfig {
  message: string;
  label?: string;
}

export interface WaitNodeConfig {
  duration: number;
  unit: 'minutes' | 'hours' | 'days';
  label?: string;
}

export interface ConditionNodeConfig {
  condition_type: 'has_replied';  // extensible later
  label?: string;
}

export interface UpdateTagNodeConfig {
  action: 'add' | 'remove';
  tag: string;
  label?: string;
}

export interface EndNodeConfig {
  label?: string;
}

export interface AutomationEdge {
  id: string;
  automation_id: string;
  source_node_id: string;
  target_node_id: string;
  source_handle: 'default' | 'yes' | 'no';
  created_at: string;
}

export interface AutomationEnrollment {
  id: string;
  automation_id: string;
  contact_id: string;
  current_node_id: string | null;
  status: AutomationEnrollmentStatus;
  enrolled_at: string;
  next_execution_at: string | null;
  completed_at: string | null;
  error_message: string | null;
  metadata: Record<string, any>;
  // Joined
  contact?: Customer;
  automation?: Automation;
}

export interface AutomationExecutionLogEntry {
  id: string;
  enrollment_id: string;
  automation_id: string;
  contact_id: string;
  node_id: string | null;
  node_type: string | null;
  action: string;
  result: Record<string, any>;
  executed_at: string;
  error_message: string | null;
}

export interface CustomerTag {
  id: string;
  customer_id: string;
  tag: string;
  created_at: string;
}
