export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      booking_items: {
        Row: { booking_id: string; position: number; service_id: string; service_name: string; price_mzn: number; duration_minutes: number }
        Insert: { booking_id: string; position: number; service_id: string; service_name: string; price_mzn: number; duration_minutes: number }
        Update: { booking_id?: string; position?: number; service_id?: string; service_name?: string; price_mzn?: number; duration_minutes?: number }
        Relationships: [{ foreignKeyName: "booking_items_booking_id_fkey"; columns: ["booking_id"]; isOneToOne: false; referencedRelation: "bookings"; referencedColumns: ["id"] }]
      }

      audit_events: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          details: Json
          entity: string
          id: number
          record_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          details: Json
          entity: string
          id?: never
          record_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          details?: Json
          entity?: string
          id?: never
          record_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          client_id: string | null
          created_at: string
          customer_id: string | null
          ends_at: string
          expires_at: string
          id: string
          price_mzn: number
          professional_id: string
          refund_due: boolean
          service_id: string
          starts_at: string
          status: Database["public"]["Enums"]["booking_status"]
          updated_at: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          customer_id?: string | null
          ends_at: string
          expires_at: string
          id?: string
          price_mzn: number
          professional_id: string
          refund_due?: boolean
          service_id: string
          starts_at: string
          status?: Database["public"]["Enums"]["booking_status"]
          updated_at?: string
        }
        Update: {
          client_id?: string | null
          created_at?: string
          customer_id?: string | null
          ends_at?: string
          expires_at?: string
          id?: string
          price_mzn?: number
          professional_id?: string
          refund_due?: boolean
          service_id?: string
          starts_at?: string
          status?: Database["public"]["Enums"]["booking_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          created_at: string
          email: string | null
          full_name: string
          id: string
          phone: string | null
          profile_id: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          phone?: string | null
          profile_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          phone?: string | null
          profile_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount_mzn: number
          created_by: string
          description: string
          id: string
          occurred_at: string
        }
        Insert: {
          amount_mzn: number
          created_by?: string
          description: string
          id?: string
          occurred_at?: string
        }
        Update: {
          amount_mzn?: number
          created_by?: string
          description?: string
          id?: string
          occurred_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      manual_income: {
        Row: {
          amount_mzn: number
          created_by: string
          description: string
          id: string
          occurred_at: string
        }
        Insert: {
          amount_mzn: number
          created_by?: string
          description: string
          id?: string
          occurred_at?: string
        }
        Update: {
          amount_mzn?: number
          created_by?: string
          description?: string
          id?: string
          occurred_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "manual_income_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount_mzn: number
          booking_id: string
          id: string
          method: Database["public"]["Enums"]["payment_method"]
          received_at: string
          reference: string | null
          refunded_at: string | null
          refunded_by: string | null
          registered_by: string
          validated_at: string | null
          validated_by: string | null
          validation_status: string
        }
        Insert: {
          amount_mzn: number
          booking_id: string
          id?: string
          method: Database["public"]["Enums"]["payment_method"]
          received_at?: string
          reference?: string | null
          refunded_at?: string | null
          refunded_by?: string | null
          registered_by: string
          validated_at?: string | null
          validated_by?: string | null
          validation_status?: string
        }
        Update: {
          amount_mzn?: number
          booking_id?: string
          id?: string
          method?: Database["public"]["Enums"]["payment_method"]
          received_at?: string
          reference?: string | null
          refunded_at?: string | null
          refunded_by?: string | null
          registered_by?: string
          validated_at?: string | null
          validated_by?: string | null
          validation_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_refunded_by_fkey"
            columns: ["refunded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_registered_by_fkey"
            columns: ["registered_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_validated_by_fkey"
            columns: ["validated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          active: boolean
          id: string
          kind: Database["public"]["Enums"]["stock_kind"]
          min_quantity: number
          name: string
          quantity: number
          sale_price_mzn: number | null
        }
        Insert: {
          active?: boolean
          id?: string
          kind: Database["public"]["Enums"]["stock_kind"]
          min_quantity?: number
          name: string
          quantity?: number
          sale_price_mzn?: number | null
        }
        Update: {
          active?: boolean
          id?: string
          kind?: Database["public"]["Enums"]["stock_kind"]
          min_quantity?: number
          name?: string
          quantity?: number
          sale_price_mzn?: number | null
        }
        Relationships: []
      }
      professional_services: {
        Row: {
          professional_id: string
          service_id: string
        }
        Insert: {
          professional_id: string
          service_id: string
        }
        Update: {
          professional_id?: string
          service_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "professional_services_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professional_services_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      professionals: {
        Row: {
          active: boolean
          display_name: string
          id: string
          profile_id: string | null
        }
        Insert: {
          active?: boolean
          display_name: string
          id?: string
          profile_id?: string | null
        }
        Update: {
          active?: boolean
          display_name?: string
          id?: string
          profile_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "professionals_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          birth_date: string | null
          created_at: string
          full_name: string
          id: string
          phone: string | null
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          birth_date?: string | null
          created_at?: string
          full_name?: string
          id: string
          phone?: string | null
          role?: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          birth_date?: string | null
          created_at?: string
          full_name?: string
          id?: string
          phone?: string | null
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: []
      }
      salon_settings: {
        Row: {
          hold_minutes: number
          id: boolean
          policy_approved: boolean
          policy_text: string
        }
        Insert: {
          hold_minutes?: number
          id?: boolean
          policy_approved?: boolean
          policy_text?: string
        }
        Update: {
          hold_minutes?: number
          id?: boolean
          policy_approved?: boolean
          policy_text?: string
        }
        Relationships: []
      }
      services: {
        Row: {
          active: boolean
          description: string | null
          duration_minutes: number
          id: string
          name: string
          price_mzn: number
        }
        Insert: {
          active?: boolean
          description?: string | null
          duration_minutes: number
          id?: string
          name: string
          price_mzn: number
        }
        Update: {
          active?: boolean
          description?: string | null
          duration_minutes?: number
          id?: string
          name?: string
          price_mzn?: number
        }
        Relationships: []
      }
      stock_movements: {
        Row: {
          created_at: string
          created_by: string
          delta: number
          id: string
          product_id: string
          reason: string
        }
        Insert: {
          created_at?: string
          created_by: string
          delta: number
          id?: string
          product_id: string
          reason: string
        }
        Update: {
          created_at?: string
          created_by?: string
          delta?: number
          id?: string
          product_id?: string
          reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      time_off: {
        Row: {
          ends_at: string
          id: string
          professional_id: string
          reason: string
          starts_at: string
        }
        Insert: {
          ends_at: string
          id?: string
          professional_id: string
          reason: string
          starts_at: string
        }
        Update: {
          ends_at?: string
          id?: string
          professional_id?: string
          reason?: string
          starts_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_off_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
        ]
      }
      work_hours: {
        Row: {
          closes: string
          id: string
          opens: string
          professional_id: string
          weekday: number
        }
        Insert: {
          closes: string
          id?: string
          opens: string
          professional_id: string
          weekday: number
        }
        Update: {
          closes?: string
          id?: string
          opens?: string
          professional_id?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "work_hours_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      available_booking_slots: { Args: { p_services: string[]; p_professional: string; p_day: string }; Returns: { slot_start: string }[] }
      available_reschedule_slots: { Args: { p_booking: string; p_professional: string; p_day: string }; Returns: { slot_start: string }[] }
      request_booking_services: { Args: { p_services: string[]; p_professional: string; p_starts_at: string; p_client?: string }; Returns: string }
      reschedule_booking: { Args: { p_booking: string; p_professional: string; p_starts_at: string }; Returns: undefined }

      adjust_stock: {
        Args: { p_delta: number; p_product: string; p_reason: string }
        Returns: number
      }
      available_slots: {
        Args: { p_day: string; p_professional: string; p_service: string }
        Returns: {
          slot_start: string
        }[]
      }
      can_manage: { Args: never; Returns: boolean }
      cancel_booking: { Args: { p_booking: string }; Returns: undefined }
      confirm_booking_payment: {
        Args: {
          p_booking: string
          p_method: Database["public"]["Enums"]["payment_method"]
        }
        Returns: undefined
      }
      create_booking: {
        Args: { p_professional: string; p_service: string; p_starts_at: string }
        Returns: string
      }
      current_role: {
        Args: never
        Returns: Database["public"]["Enums"]["app_role"]
      }
      finance_summary: { Args: { p_from: string; p_to: string }; Returns: Json }
      is_staff: { Args: never; Returns: boolean }
      low_stock: { Args: never; Returns: number }
      refund_payment: {
        Args: { p_payment: string; p_reason: string }
        Returns: undefined
      }
      register_payment: {
        Args: {
          p_amount: number
          p_booking: string
          p_method: Database["public"]["Enums"]["payment_method"]
          p_reference?: string
        }
        Returns: string
      }
      request_booking: {
        Args: {
          p_client?: string
          p_professional: string
          p_service: string
          p_starts_at: string
        }
        Returns: string
      }
      set_booking_status: {
        Args: {
          p_booking: string
          p_status: Database["public"]["Enums"]["booking_status"]
        }
        Returns: undefined
      }
      validate_payment: {
        Args: { p_approve: boolean; p_payment: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "manager" | "reception" | "professional" | "customer"
      booking_status:
        | "pending_payment"
        | "confirmed"
        | "in_progress"
        | "completed"
        | "cancelled"
        | "expired"
      payment_method: "cash" | "mpesa" | "emola" | "bank_transfer" | "pos"
      stock_kind: "sale" | "consumable"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["manager", "reception", "professional", "customer"],
      booking_status: [
        "pending_payment",
        "confirmed",
        "in_progress",
        "completed",
        "cancelled",
        "expired",
      ],
      payment_method: ["cash", "mpesa", "emola", "bank_transfer", "pos"],
      stock_kind: ["sale", "consumable"],
    },
  },
} as const
