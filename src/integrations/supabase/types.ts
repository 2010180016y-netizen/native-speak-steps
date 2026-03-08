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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
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
      language_imports: {
        Row: {
          analysis_result: Json | null
          content: string
          created_at: string
          id: string
          source_type: string
          unique_words: number
          user_id: string
          word_count: number
        }
        Insert: {
          analysis_result?: Json | null
          content: string
          created_at?: string
          id?: string
          source_type?: string
          unique_words?: number
          user_id: string
          word_count?: number
        }
        Update: {
          analysis_result?: Json | null
          content?: string
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
      pet_diaries: {
        Row: {
          content: string
          created_at: string
          diary_date: string
          id: string
          mood: string
          pet_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          diary_date?: string
          id?: string
          mood?: string
          pet_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          diary_date?: string
          id?: string
          mood?: string
          pet_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pet_diaries_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "user_pets"
            referencedColumns: ["id"]
          },
        ]
      }
      pet_feeding_log: {
        Row: {
          created_at: string
          id: string
          item_id: string
          pet_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          item_id: string
          pet_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          item_id?: string
          pet_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pet_feeding_log_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "pet_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pet_feeding_log_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "user_pets"
            referencedColumns: ["id"]
          },
        ]
      }
      pet_items: {
        Row: {
          category: string
          created_at: string
          description: string | null
          emoji: string
          exp_reward: number
          id: string
          name: string
          price: number
        }
        Insert: {
          category?: string
          created_at?: string
          description?: string | null
          emoji?: string
          exp_reward?: number
          id?: string
          name: string
          price?: number
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          emoji?: string
          exp_reward?: number
          id?: string
          name?: string
          price?: number
        }
        Relationships: []
      }
      pet_types: {
        Row: {
          base_image_url: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          species: string
          unlock_cost: number
        }
        Insert: {
          base_image_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          species?: string
          unlock_cost?: number
        }
        Update: {
          base_image_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          species?: string
          unlock_cost?: number
        }
        Relationships: []
      }
      point_transactions: {
        Row: {
          amount: number
          created_at: string
          description: string | null
          id: string
          type: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          description?: string | null
          id?: string
          type?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string | null
          id?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          current_level: string
          display_name: string | null
          id: string
          native_language: string
          onboarding_completed: boolean
          reminder_enabled: boolean
          reminder_time: string
          streak_days: number
          target_language: string
          total_xp: number
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          current_level?: string
          display_name?: string | null
          id?: string
          native_language?: string
          onboarding_completed?: boolean
          reminder_enabled?: boolean
          reminder_time?: string
          streak_days?: number
          target_language?: string
          total_xp?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          current_level?: string
          display_name?: string | null
          id?: string
          native_language?: string
          onboarding_completed?: boolean
          reminder_enabled?: boolean
          reminder_time?: string
          streak_days?: number
          target_language?: string
          total_xp?: number
          updated_at?: string
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
          target_text?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_pets: {
        Row: {
          created_at: string
          exp_to_next_level: number
          experience: number
          id: string
          image_url: string | null
          is_active: boolean
          level: number
          name: string
          pet_type_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          exp_to_next_level?: number
          experience?: number
          id?: string
          image_url?: string | null
          is_active?: boolean
          level?: number
          name?: string
          pet_type_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          exp_to_next_level?: number
          experience?: number
          id?: string
          image_url?: string | null
          is_active?: boolean
          level?: number
          name?: string
          pet_type_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_pets_pet_type_id_fkey"
            columns: ["pet_type_id"]
            isOneToOne: false
            referencedRelation: "pet_types"
            referencedColumns: ["id"]
          },
        ]
      }
      user_points: {
        Row: {
          balance: number
          created_at: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          created_at?: string
          id?: string
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
      [_ in never]: never
    }
    Functions: {
      get_leaderboard: {
        Args: { limit_count?: number }
        Returns: {
          avatar_url: string
          current_level: string
          display_name: string
          streak_days: number
          total_xp: number
          user_id: string
        }[]
      }
      get_user_rank: { Args: { target_user_id: string }; Returns: number }
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
