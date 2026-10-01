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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      bets: {
        Row: {
          amount_paise: number
          created_at: string
          id: string
          lane: number
          multiplier: number
          payout_paise: number
          round_id: number
          settled_at: string | null
          status: string
          user_id: string
          winner_lane: number | null
        }
        Insert: {
          amount_paise: number
          created_at?: string
          id?: string
          lane: number
          multiplier: number
          payout_paise?: number
          round_id: number
          settled_at?: string | null
          status?: string
          user_id: string
          winner_lane?: number | null
        }
        Update: {
          amount_paise?: number
          created_at?: string
          id?: string
          lane?: number
          multiplier?: number
          payout_paise?: number
          round_id?: number
          settled_at?: string | null
          status?: string
          user_id?: string
          winner_lane?: number | null
        }
        Relationships: []
      }
      deposits: {
        Row: {
          amount_paise: number
          created_at: string
          id: string
          paid_at: string | null
          payment_id: string | null
          provider: string
          qr_id: string | null
          qr_image_url: string | null
          status: string
          user_id: string
        }
        Insert: {
          amount_paise: number
          created_at?: string
          id?: string
          paid_at?: string | null
          payment_id?: string | null
          provider?: string
          qr_id?: string | null
          qr_image_url?: string | null
          status?: string
          user_id: string
        }
        Update: {
          amount_paise?: number
          created_at?: string
          id?: string
          paid_at?: string | null
          payment_id?: string | null
          provider?: string
          qr_id?: string | null
          qr_image_url?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          balance_paise: number
          created_at: string
          id: string
          phone: string
          updated_at: string
        }
        Insert: {
          balance_paise?: number
          created_at?: string
          id: string
          phone: string
          updated_at?: string
        }
        Update: {
          balance_paise?: number
          created_at?: string
          id?: string
          phone?: string
          updated_at?: string
        }
        Relationships: []
      }
      rounds: {
        Row: {
          commit_hash: string | null
          created_at: string
          finish_order: number[]
          reveal: string | null
          round_id: number
          winner_lane: number
        }
        Insert: {
          commit_hash?: string | null
          created_at?: string
          finish_order: number[]
          reveal?: string | null
          round_id: number
          winner_lane: number
        }
        Update: {
          commit_hash?: string | null
          created_at?: string
          finish_order?: number[]
          reveal?: string | null
          round_id?: number
          winner_lane?: number
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount_paise: number
          balance_after_paise: number
          created_at: string
          id: string
          kind: string
          reference: string | null
          user_id: string
        }
        Insert: {
          amount_paise: number
          balance_after_paise: number
          created_at?: string
          id?: string
          kind: string
          reference?: string | null
          user_id: string
        }
        Update: {
          amount_paise?: number
          balance_after_paise?: number
          created_at?: string
          id?: string
          kind?: string
          reference?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      withdrawals: {
        Row: {
          admin_note: string | null
          amount_paise: number
          created_at: string
          id: string
          processed_at: string | null
          status: string
          updated_at: string
          upi_id: string
          user_id: string
        }
        Insert: {
          admin_note?: string | null
          amount_paise: number
          created_at?: string
          id?: string
          processed_at?: string | null
          status?: string
          updated_at?: string
          upi_id: string
          user_id: string
        }
        Update: {
          admin_note?: string | null
          amount_paise?: number
          created_at?: string
          id?: string
          processed_at?: string | null
          status?: string
          updated_at?: string
          upi_id?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      credit_deposit: {
        Args: {
          p_amount_paise: number
          p_deposit_id: string
          p_payment_id: string
        }
        Returns: {
          out_balance_paise: number
          out_credited: boolean
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      place_bet: {
        Args: {
          p_amount_paise: number
          p_lane: number
          p_multiplier: number
          p_round_id: number
          p_user_id: string
        }
        Returns: {
          out_balance_paise: number
          out_bet_id: string
        }[]
      }
      process_withdrawal: {
        Args: { p_action: string; p_note?: string; p_withdrawal_id: string }
        Returns: {
          out_balance_paise: number
          out_status: string
        }[]
      }
      public_stats: {
        Args: never
        Returns: {
          bets_today: number
          players: number
          staked_paise: number
        }[]
      }
      settle_bet: {
        Args: { p_round_id: number; p_user_id: string; p_winner_lane: number }
        Returns: {
          out_balance_paise: number
          out_payout_paise: number
          out_status: string
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "user"
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
      app_role: ["admin", "user"],
    },
  },
} as const
