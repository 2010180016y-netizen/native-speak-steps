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
      activity_events: {
        Row: {
          created_at: string
          id: string
          idempotency_key: string
          kind: string
          local_date: string
          units: number
          user_id: string
          xp: number
        }
        Insert: {
          created_at?: string
          id?: string
          idempotency_key: string
          kind: string
          local_date: string
          units: number
          user_id: string
          xp: number
        }
        Update: {
          created_at?: string
          id?: string
          idempotency_key?: string
          kind?: string
          local_date?: string
          units?: number
          user_id?: string
          xp?: number
        }
        Relationships: []
      }
      ai_feedback: {
        Row: {
          created_at: string
          error_message: string | null
          error_type: string | null
          feature: string
          id: string
          metadata: Json | null
          rating: number | null
          response_time_ms: number | null
          user_id: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          error_type?: string | null
          feature?: string
          id?: string
          metadata?: Json | null
          rating?: number | null
          response_time_ms?: number | null
          user_id: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          error_type?: string | null
          feature?: string
          id?: string
          metadata?: Json | null
          rating?: number | null
          response_time_ms?: number | null
          user_id?: string
        }
        Relationships: []
      }
      ai_usage_daily: {
        Row: {
          feature: string
          requests: number
          usage_date: string
          user_id: string
        }
        Insert: {
          feature: string
          requests?: number
          usage_date?: string
          user_id: string
        }
        Update: {
          feature?: string
          requests?: number
          usage_date?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_usage_log: {
        Row: {
          completion_tokens: number | null
          created_at: string
          feature: string
          id: number
          latency_ms: number | null
          model: string
          prompt_tokens: number | null
          status: number
          total_tokens: number | null
          user_id: string
        }
        Insert: {
          completion_tokens?: number | null
          created_at?: string
          feature: string
          id?: never
          latency_ms?: number | null
          model: string
          prompt_tokens?: number | null
          status: number
          total_tokens?: number | null
          user_id: string
        }
        Update: {
          completion_tokens?: number | null
          created_at?: string
          feature?: string
          id?: never
          latency_ms?: number | null
          model?: string
          prompt_tokens?: number | null
          status?: number
          total_tokens?: number | null
          user_id?: string
        }
        Relationships: []
      }
      analytics_events: {
        Row: {
          created_at: string
          event: string
          event_date: string
          user_id: string
        }
        Insert: {
          created_at?: string
          event: string
          event_date?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          event?: string
          event_date?: string
          user_id?: string
        }
        Relationships: []
      }
      card_reviews: {
        Row: {
          card_id: string
          id: number
          interval_after: number
          interval_before: number
          quality: number
          review_number: number
          reviewed_at: string
          user_id: string
        }
        Insert: {
          card_id: string
          id?: never
          interval_after: number
          interval_before: number
          quality: number
          review_number: number
          reviewed_at?: string
          user_id?: string
        }
        Update: {
          card_id?: string
          id?: never
          interval_after?: number
          interval_before?: number
          quality?: number
          review_number?: number
          reviewed_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "card_reviews_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "srs_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_feedback_results: {
        Row: {
          avg_words_per_message: number
          created_at: string
          feedback_data: Json
          good_expressions_count: number
          id: string
          improvement_areas_count: number
          overall_score: number
          persona_gender: string | null
          persona_occupation: string | null
          scenario_label: string | null
          session_id: string
          total_user_messages: number
          total_user_words: number
          user_id: string
          vocabulary_richness: number
        }
        Insert: {
          avg_words_per_message?: number
          created_at?: string
          feedback_data?: Json
          good_expressions_count?: number
          id?: string
          improvement_areas_count?: number
          overall_score?: number
          persona_gender?: string | null
          persona_occupation?: string | null
          scenario_label?: string | null
          session_id: string
          total_user_messages?: number
          total_user_words?: number
          user_id: string
          vocabulary_richness?: number
        }
        Update: {
          avg_words_per_message?: number
          created_at?: string
          feedback_data?: Json
          good_expressions_count?: number
          id?: string
          improvement_areas_count?: number
          overall_score?: number
          persona_gender?: string | null
          persona_occupation?: string | null
          scenario_label?: string | null
          session_id?: string
          total_user_messages?: number
          total_user_words?: number
          user_id?: string
          vocabulary_richness?: number
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          role: string
          session_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          role: string
          session_id?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          role?: string
          session_id?: string
          user_id?: string
        }
        Relationships: []
      }
      client_errors: {
        Row: {
          created_at: string
          id: string
          message: string
          stack: string | null
          url: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          stack?: string | null
          url?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          stack?: string | null
          url?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      language_imports: {
        Row: {
          analysis_result: Json | null
          created_at: string
          id: string
          source_type: string
          unique_words: number
          user_id: string
          word_count: number
        }
        Insert: {
          analysis_result?: Json | null
          created_at?: string
          id?: string
          source_type?: string
          unique_words?: number
          user_id: string
          word_count?: number
        }
        Update: {
          analysis_result?: Json | null
          created_at?: string
          id?: string
          source_type?: string
          unique_words?: number
          user_id?: string
          word_count?: number
        }
        Relationships: []
      }
      learning_goals: {
        Row: {
          created_at: string
          goal_type: string
          id: string
          is_active: boolean
          target_value: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          goal_type?: string
          id?: string
          is_active?: boolean
          target_value?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          goal_type?: string
          id?: string
          is_active?: boolean
          target_value?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      learning_stats: {
        Row: {
          cards_reviewed: number
          chat_messages_sent: number
          created_at: string
          date: string
          id: string
          native_words_analyzed: number
          target_words_learned: number
          user_id: string
          xp_earned: number
        }
        Insert: {
          cards_reviewed?: number
          chat_messages_sent?: number
          created_at?: string
          date?: string
          id?: string
          native_words_analyzed?: number
          target_words_learned?: number
          user_id: string
          xp_earned?: number
        }
        Update: {
          cards_reviewed?: number
          chat_messages_sent?: number
          created_at?: string
          date?: string
          id?: string
          native_words_analyzed?: number
          target_words_learned?: number
          user_id?: string
          xp_earned?: number
        }
        Relationships: []
      }
      lesson_completions: {
        Row: {
          completed_at: string
          duration_seconds: number | null
          id: string
          lesson_type: string
          metadata: Json | null
          score: number | null
          user_id: string
        }
        Insert: {
          completed_at?: string
          duration_seconds?: number | null
          id?: string
          lesson_type: string
          metadata?: Json | null
          score?: number | null
          user_id: string
        }
        Update: {
          completed_at?: string
          duration_seconds?: number | null
          id?: string
          lesson_type?: string
          metadata?: Json | null
          score?: number | null
          user_id?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          order_id: string
          paid_at: string | null
          payment_key: string | null
          product: string
          status: string
          user_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          order_id?: string
          paid_at?: string | null
          payment_key?: string | null
          product: string
          status?: string
          user_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          order_id?: string
          paid_at?: string | null
          payment_key?: string | null
          product?: string
          status?: string
          user_id?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          ai_processing_consent_at: string | null
          avatar_url: string | null
          created_at: string
          current_level: string
          display_name: string | null
          id: string
          last_active_date: string | null
          last_reminded_on: string | null
          native_language: string
          onboarding_completed: boolean
          pro_until: string | null
          reminder_enabled: boolean
          reminder_time: string
          streak_days: number
          target_language: string
          target_variety: string | null
          timezone: string
          total_xp: number
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_processing_consent_at?: string | null
          avatar_url?: string | null
          created_at?: string
          current_level?: string
          display_name?: string | null
          id?: string
          last_active_date?: string | null
          last_reminded_on?: string | null
          native_language?: string
          onboarding_completed?: boolean
          pro_until?: string | null
          reminder_enabled?: boolean
          reminder_time?: string
          streak_days?: number
          target_language?: string
          target_variety?: string | null
          timezone?: string
          total_xp?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_processing_consent_at?: string | null
          avatar_url?: string | null
          created_at?: string
          current_level?: string
          display_name?: string | null
          id?: string
          last_active_date?: string | null
          last_reminded_on?: string | null
          native_language?: string
          onboarding_completed?: boolean
          pro_until?: string | null
          reminder_enabled?: boolean
          reminder_time?: string
          streak_days?: number
          target_language?: string
          target_variety?: string | null
          timezone?: string
          total_xp?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          p256dh: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          p256dh: string
          user_id?: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          p256dh?: string
          user_id?: string
        }
        Relationships: []
      }
      srs_cards: {
        Row: {
          context: string | null
          created_at: string
          difficulty: number
          ease_factor: number
          id: string
          interval_days: number
          native_text: string
          next_review_at: string
          review_count: number
          source: string
          target_text: string
          updated_at: string
          user_id: string
        }
        Insert: {
          context?: string | null
          created_at?: string
          difficulty?: number
          ease_factor?: number
          id?: string
          interval_days?: number
          native_text: string
          next_review_at?: string
          review_count?: number
          source?: string
          target_text: string
          updated_at?: string
          user_id: string
        }
        Update: {
          context?: string | null
          created_at?: string
          difficulty?: number
          ease_factor?: number
          id?: string
          interval_days?: number
          native_text?: string
          next_review_at?: string
          review_count?: number
          source?: string
          target_text?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_sessions: {
        Row: {
          activity_type: string
          created_at: string
          duration_seconds: number | null
          ended_at: string | null
          id: string
          metadata: Json | null
          started_at: string
          user_id: string
        }
        Insert: {
          activity_type?: string
          created_at?: string
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          metadata?: Json | null
          started_at?: string
          user_id: string
        }
        Update: {
          activity_type?: string
          created_at?: string
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          metadata?: Json | null
          started_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      analytics_cohorts: {
        Row: {
          activated: number | null
          activation_rate: number | null
          cohort_week: string | null
          d1_retention: number | null
          d7_retention: number | null
          imported: number | null
          onboarded: number | null
          signups: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      current_user_id: { Args: never; Returns: string }
      ensure_profile: { Args: never; Returns: Database["public"]["Tables"]["profiles"]["Row"] }
      is_valid_timezone: { Args: { tz: string }; Returns: boolean }
      record_activity: {
        Args: {
          p_idempotency_key: string
          p_kind: string
          p_timezone?: string
          p_units?: number
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
