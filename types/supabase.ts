// Database types for the BenchPass schema (supabase/migrations/0001_init.sql).
// Regenerate against a live project with:
//   supabase gen types typescript --project-id <ref> > types/supabase.ts

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      shops: {
        Row: {
          id: string;
          name: string;
          logo_url: string | null;
          phone: string | null;
          address: string | null;
          sms_from: string | null;
          plan: string;
          subscription_status: string;
          trial_ends_at: string | null;
          stripe_customer_id: string | null;
          stripe_subscription_id: string | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          logo_url?: string | null;
          phone?: string | null;
          address?: string | null;
          sms_from?: string | null;
          plan?: string;
          subscription_status?: string;
          trial_ends_at?: string | null;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          name?: string;
          logo_url?: string | null;
          phone?: string | null;
          address?: string | null;
          sms_from?: string | null;
          plan?: string;
          subscription_status?: string;
          trial_ends_at?: string | null;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          created_at?: string | null;
        };
        Relationships: [];
      };
      users: {
        Row: {
          id: string;
          shop_id: string;
          email: string;
          role: string;
        };
        Insert: {
          id: string;
          shop_id: string;
          email: string;
          role?: string;
        };
        Update: {
          id?: string;
          shop_id?: string;
          email?: string;
          role?: string;
        };
        Relationships: [
          {
            foreignKeyName: "users_shop_id_fkey";
            columns: ["shop_id"];
            isOneToOne: false;
            referencedRelation: "shops";
            referencedColumns: ["id"];
          },
        ];
      };
      customers: {
        Row: {
          id: string;
          shop_id: string;
          name: string;
          phone: string | null;
          email: string | null;
          notes: string | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          shop_id: string;
          name: string;
          phone?: string | null;
          email?: string | null;
          notes?: string | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          shop_id?: string;
          name?: string;
          phone?: string | null;
          email?: string | null;
          notes?: string | null;
          created_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "customers_shop_id_fkey";
            columns: ["shop_id"];
            isOneToOne: false;
            referencedRelation: "shops";
            referencedColumns: ["id"];
          },
        ];
      };
      instruments: {
        Row: {
          id: string;
          shop_id: string;
          customer_id: string | null;
          type: string | null;
          make: string | null;
          model: string | null;
          serial: string | null;
          photo_urls: string[] | null;
          notes: string | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          shop_id: string;
          customer_id?: string | null;
          type?: string | null;
          make?: string | null;
          model?: string | null;
          serial?: string | null;
          photo_urls?: string[] | null;
          notes?: string | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          shop_id?: string;
          customer_id?: string | null;
          type?: string | null;
          make?: string | null;
          model?: string | null;
          serial?: string | null;
          photo_urls?: string[] | null;
          notes?: string | null;
          created_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "instruments_shop_id_fkey";
            columns: ["shop_id"];
            isOneToOne: false;
            referencedRelation: "shops";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "instruments_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
        ];
      };
      tickets: {
        Row: {
          id: string;
          shop_id: string;
          customer_id: string;
          instrument_id: string | null;
          public_token: string;
          status: string;
          problem: string;
          internal_notes: string | null;
          customer_summary: string | null;
          quote_cents: number | null;
          deposit_cents: number | null;
          parts_status: string | null;
          intake_at: string | null;
          ready_at: string | null;
          picked_up_at: string | null;
          updated_at: string;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          shop_id: string;
          customer_id: string;
          instrument_id?: string | null;
          public_token?: string;
          status?: string;
          problem: string;
          internal_notes?: string | null;
          customer_summary?: string | null;
          quote_cents?: number | null;
          deposit_cents?: number | null;
          parts_status?: string | null;
          intake_at?: string | null;
          ready_at?: string | null;
          picked_up_at?: string | null;
          updated_at?: string;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          shop_id?: string;
          customer_id?: string;
          instrument_id?: string | null;
          public_token?: string;
          status?: string;
          problem?: string;
          internal_notes?: string | null;
          customer_summary?: string | null;
          quote_cents?: number | null;
          deposit_cents?: number | null;
          parts_status?: string | null;
          intake_at?: string | null;
          ready_at?: string | null;
          picked_up_at?: string | null;
          updated_at?: string;
          created_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "tickets_shop_id_fkey";
            columns: ["shop_id"];
            isOneToOne: false;
            referencedRelation: "shops";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tickets_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tickets_instrument_id_fkey";
            columns: ["instrument_id"];
            isOneToOne: false;
            referencedRelation: "instruments";
            referencedColumns: ["id"];
          },
        ];
      };
      messages: {
        Row: {
          id: string;
          ticket_id: string;
          channel: string;
          body: string;
          sent_at: string | null;
          twilio_sid: string | null;
        };
        Insert: {
          id?: string;
          ticket_id: string;
          channel: string;
          body: string;
          sent_at?: string | null;
          twilio_sid?: string | null;
        };
        Update: {
          id?: string;
          ticket_id?: string;
          channel?: string;
          body?: string;
          sent_at?: string | null;
          twilio_sid?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "messages_ticket_id_fkey";
            columns: ["ticket_id"];
            isOneToOne: false;
            referencedRelation: "tickets";
            referencedColumns: ["id"];
          },
        ];
      };
      templates: {
        Row: {
          id: string;
          shop_id: string;
          key: string;
          body: string;
        };
        Insert: {
          id?: string;
          shop_id: string;
          key: string;
          body: string;
        };
        Update: {
          id?: string;
          shop_id?: string;
          key?: string;
          body?: string;
        };
        Relationships: [
          {
            foreignKeyName: "templates_shop_id_fkey";
            columns: ["shop_id"];
            isOneToOne: false;
            referencedRelation: "shops";
            referencedColumns: ["id"];
          },
        ];
      };
      price_presets: {
        Row: {
          id: string;
          shop_id: string;
          label: string;
          amount_cents: number;
        };
        Insert: {
          id?: string;
          shop_id: string;
          label: string;
          amount_cents: number;
        };
        Update: {
          id?: string;
          shop_id?: string;
          label?: string;
          amount_cents?: number;
        };
        Relationships: [
          {
            foreignKeyName: "price_presets_shop_id_fkey";
            columns: ["shop_id"];
            isOneToOne: false;
            referencedRelation: "shops";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      current_shop_id: { Args: Record<string, never>; Returns: string };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];
export type TablesInsert<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"];
