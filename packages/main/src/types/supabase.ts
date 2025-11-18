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
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      agencies: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          subscription_end_date: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          subscription_end_date: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          subscription_end_date?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      properties: {
        Row: {
          agency_id: string | null
          created_at: string
          dong: string | null
          ho: string | null
          id: string
          property_name: string
          updated_at: string
        }
        Insert: {
          agency_id?: string | null
          created_at?: string
          dong?: string | null
          ho?: string | null
          id?: string
          property_name: string
          updated_at?: string
        }
        Update: {
          agency_id?: string | null
          created_at?: string
          dong?: string | null
          ho?: string | null
          id?: string
          property_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "properties_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          }
        ]
      }
      property_verification_info: {
        Row: {
          agency_id: string
          created_at: string
          document_file_path: string
          id: string
          owner_type: string
          power_of_attorney_file_path: string | null
          property_id: string
          register_file_path: string | null
          register_unique_no: string | null
          updated_at: string
        }
        Insert: {
          agency_id: string
          created_at?: string
          document_file_path: string
          id?: string
          owner_type: string
          power_of_attorney_file_path?: string | null
          property_id: string
          register_file_path?: string | null
          register_unique_no?: string | null
          updated_at?: string
        }
        Update: {
          agency_id?: string
          created_at?: string
          document_file_path?: string
          id?: string
          owner_type?: string
          power_of_attorney_file_path?: string | null
          property_id?: string
          register_file_path?: string | null
          register_unique_no?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_verification_info_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_verification_info_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: true
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      user_profiles: {
        Row: {
          agency_id: string
          created_at: string | null
          id: string
          machine_id: string | null
          role: string | null
          updated_at: string | null
        }
        Insert: {
          agency_id: string
          created_at?: string | null
          id: string
          machine_id?: string | null
          role?: string | null
          updated_at?: string | null
        }
        Update: {
          agency_id?: string
          created_at?: string | null
          id?: string
          machine_id?: string | null
          role?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_profiles_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      agency_join_requests: {
        Row: {
          agency_name: string
          created_at: string | null
          id: string
          status: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          agency_name: string
          created_at?: string | null
          id?: string
          status?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          agency_name?: string
          created_at?: string | null
          id?: string
          status?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      machine_id_requests: {
        Row: {
          created_at: string | null
          id: string
          machine_id: string
          status: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          machine_id: string
          status?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          machine_id?: string
          status?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_machine_id: { Args: { input_machine_id: string }; Returns: boolean }
      get_properties_by_keys: {
        Args: { property_keys: Json }
        Returns: {
          document_file_path: string
          dong: string
          ho: string
          id: string
          owner_type: string
          power_of_attorney_file_path: string
          property_created_at: string
          property_name: string
          property_updated_at: string
          register_file_path: string
          register_unique_no: string
          verification_created_at: string
          verification_id: string
          verification_updated_at: string
        }[]
      }
      get_user_agency_id: { Args: never; Returns: string }
      is_agency_active: { Args: never; Returns: boolean }
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

export type PropertyVerificationInfoInsert = Database['public']['Tables']['property_verification_info']['Insert']
export type PropertyVerificationInfoUpdate = Database['public']['Tables']['property_verification_info']['Update']
export type PropertyVerificationInfoRow = Database['public']['Tables']['property_verification_info']['Row']

// Property와 Verification 정보를 합친 타입 (RPC get_properties_by_keys 결과)
export interface PropertyWithVerification {
  id: string;
  property_name: string;
  dong: string | null;
  ho: string | null;
  property_created_at: string;
  property_updated_at: string;
  verification_id: string | null;
  owner_type: string | null;
  document_file_path: string | null;
  register_file_path: string | null;
  power_of_attorney_file_path: string | null;
  register_unique_no: string | null;
  verification_created_at: string | null;
  verification_updated_at: string | null;
}

export interface Property {
  id: string;
  propertyName: string;
  dong: string | null;
  ho: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PropertyInsert {
  property_name: string;
  dong?: string | null;
  ho?: string | null;
  agency_id?: string | null;
}

export interface PropertyVerificationInfo {
  id: string;
  propertyId: string;
  ownerType: string;
  documentFilePath: string;
  registerFilePath: string | null;
  powerOfAttorneyFilePath: string | null;
  registerUniqueNo: string | null;
  createdAt: string;
  updatedAt: string;
}
