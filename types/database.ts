export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      blocks: {
        Row: {
          blocked_id: string;
          blocker_id: string;
          created_at: string;
        };
        ComputedFields: never;
        Insert: {
          blocked_id: string;
          blocker_id?: string;
          created_at?: string;
        };
        Update: {
          blocked_id?: string;
          blocker_id?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "blocks_blocked_id_fkey";
            columns: ["blocked_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "blocks_blocker_id_fkey";
            columns: ["blocker_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      books: {
        Row: {
          author: string | null;
          cover_url: string | null;
          created_at: string;
          genres: string[];
          id: string;
          pages_adjust: number;
          status: string;
          title: string;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          author?: string | null;
          cover_url?: string | null;
          created_at?: string;
          genres?: string[];
          id?: string;
          pages_adjust?: number;
          status?: string;
          title: string;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          author?: string | null;
          cover_url?: string | null;
          created_at?: string;
          genres?: string[];
          id?: string;
          pages_adjust?: number;
          status?: string;
          title?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "books_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      chat_room_prefs: {
        Row: {
          kind: string;
          last_read_at: string | null;
          left_at: string | null;
          muted: boolean;
          pinned_at: string | null;
          room_id: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          kind: string;
          last_read_at?: string | null;
          left_at?: string | null;
          muted?: boolean;
          pinned_at?: string | null;
          room_id: string;
          user_id?: string;
        };
        Update: {
          kind?: string;
          last_read_at?: string | null;
          left_at?: string | null;
          muted?: boolean;
          pinned_at?: string | null;
          room_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "chat_room_prefs_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      dm_messages: {
        Row: {
          body: string;
          client_id: string;
          created_at: string;
          id: string;
          sender_id: string;
          thread_id: string;
        };
        ComputedFields: never;
        Insert: {
          body: string;
          client_id: string;
          created_at?: string;
          id?: string;
          sender_id?: string;
          thread_id: string;
        };
        Update: {
          body?: string;
          client_id?: string;
          created_at?: string;
          id?: string;
          sender_id?: string;
          thread_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "dm_messages_sender_id_fkey";
            columns: ["sender_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "dm_messages_thread_id_fkey";
            columns: ["thread_id"];
            isOneToOne: false;
            referencedRelation: "dm_threads";
            referencedColumns: ["id"];
          },
        ];
      };
      dm_threads: {
        Row: {
          created_at: string;
          id: string;
          user_a: string;
          user_b: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          id?: string;
          user_a: string;
          user_b: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          user_a?: string;
          user_b?: string;
        };
        Relationships: [
          {
            foreignKeyName: "dm_threads_user_a_fkey";
            columns: ["user_a"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "dm_threads_user_b_fkey";
            columns: ["user_b"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      events: {
        Row: {
          created_at: string;
          device: string | null;
          id: number;
          name: string;
          props: NonNullable<Json>;
          user_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          device?: string | null;
          id?: never;
          name: string;
          props?: NonNullable<Json>;
          user_id?: string | null;
        };
        Update: {
          created_at?: string;
          device?: string | null;
          id?: never;
          name?: string;
          props?: NonNullable<Json>;
          user_id?: string | null;
        };
        Relationships: [];
      };
      group_bans: {
        Row: {
          banned_by: string | null;
          created_at: string;
          group_id: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          banned_by?: string | null;
          created_at?: string;
          group_id: string;
          user_id: string;
        };
        Update: {
          banned_by?: string | null;
          created_at?: string;
          group_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "group_bans_banned_by_fkey";
            columns: ["banned_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "group_bans_group_id_fkey";
            columns: ["group_id"];
            isOneToOne: false;
            referencedRelation: "groups";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "group_bans_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      group_members: {
        Row: {
          group_id: string;
          joined_at: string;
          role: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          group_id: string;
          joined_at?: string;
          role?: string;
          user_id: string;
        };
        Update: {
          group_id?: string;
          joined_at?: string;
          role?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "group_members_group_id_fkey";
            columns: ["group_id"];
            isOneToOne: false;
            referencedRelation: "groups";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "group_members_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      group_messages: {
        Row: {
          body: string;
          client_id: string;
          created_at: string;
          deleted_at: string | null;
          deleted_by: string | null;
          group_id: string;
          id: string;
          sender_id: string;
        };
        ComputedFields: never;
        Insert: {
          body: string;
          client_id: string;
          created_at?: string;
          deleted_at?: string | null;
          deleted_by?: string | null;
          group_id: string;
          id?: string;
          sender_id?: string;
        };
        Update: {
          body?: string;
          client_id?: string;
          created_at?: string;
          deleted_at?: string | null;
          deleted_by?: string | null;
          group_id?: string;
          id?: string;
          sender_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "group_messages_deleted_by_fkey";
            columns: ["deleted_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "group_messages_group_id_fkey";
            columns: ["group_id"];
            isOneToOne: false;
            referencedRelation: "groups";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "group_messages_sender_id_fkey";
            columns: ["sender_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      group_mutes: {
        Row: {
          created_at: string;
          group_id: string;
          muted_by: string | null;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          group_id: string;
          muted_by?: string | null;
          user_id: string;
        };
        Update: {
          created_at?: string;
          group_id?: string;
          muted_by?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "group_mutes_group_id_fkey";
            columns: ["group_id"];
            isOneToOne: false;
            referencedRelation: "groups";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "group_mutes_muted_by_fkey";
            columns: ["muted_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "group_mutes_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      groups: {
        Row: {
          created_at: string;
          description: string;
          id: string;
          name: string;
          owner_id: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          description?: string;
          id?: string;
          name: string;
          owner_id?: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          description?: string;
          id?: string;
          name?: string;
          owner_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "groups_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      post_comments: {
        Row: {
          author_id: string;
          body: string;
          created_at: string;
          id: string;
          post_id: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          author_id?: string;
          body: string;
          created_at?: string;
          id?: string;
          post_id: string;
          updated_at?: string;
        };
        Update: {
          author_id?: string;
          body?: string;
          created_at?: string;
          id?: string;
          post_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "post_comments_author_id_fkey";
            columns: ["author_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "post_comments_post_id_fkey";
            columns: ["post_id"];
            isOneToOne: false;
            referencedRelation: "posts";
            referencedColumns: ["id"];
          },
        ];
      };
      post_likes: {
        Row: {
          created_at: string;
          post_id: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          post_id: string;
          user_id?: string;
        };
        Update: {
          created_at?: string;
          post_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "post_likes_post_id_fkey";
            columns: ["post_id"];
            isOneToOne: false;
            referencedRelation: "posts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "post_likes_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      post_views: {
        Row: {
          day: string;
          post_id: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          day: string;
          post_id: string;
          user_id: string;
        };
        Update: {
          day?: string;
          post_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "post_views_post_id_fkey";
            columns: ["post_id"];
            isOneToOne: false;
            referencedRelation: "posts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "post_views_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      posts: {
        Row: {
          author_id: string;
          body: string;
          category: string;
          comment_count: number;
          created_at: string;
          id: string;
          like_count: number;
          title: string;
          updated_at: string;
          view_count: number;
        };
        ComputedFields: never;
        Insert: {
          author_id?: string;
          body: string;
          category?: string;
          comment_count?: number;
          created_at?: string;
          id?: string;
          like_count?: number;
          title: string;
          updated_at?: string;
          view_count?: number;
        };
        Update: {
          author_id?: string;
          body?: string;
          category?: string;
          comment_count?: number;
          created_at?: string;
          id?: string;
          like_count?: number;
          title?: string;
          updated_at?: string;
          view_count?: number;
        };
        Relationships: [
          {
            foreignKeyName: "posts_author_id_fkey";
            columns: ["author_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          bio: string | null;
          created_at: string;
          id: string;
          nickname: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          avatar_url?: string | null;
          bio?: string | null;
          created_at?: string;
          id: string;
          nickname: string;
          updated_at?: string;
        };
        Update: {
          avatar_url?: string | null;
          bio?: string | null;
          created_at?: string;
          id?: string;
          nickname?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      reading_logs: {
        Row: {
          body: string;
          book_id: string | null;
          book_title: string;
          created_at: string;
          id: string;
          pages_read: number | null;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          body: string;
          book_id?: string | null;
          book_title: string;
          created_at?: string;
          id?: string;
          pages_read?: number | null;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          body?: string;
          book_id?: string | null;
          book_title?: string;
          created_at?: string;
          id?: string;
          pages_read?: number | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "reading_logs_book_id_fkey";
            columns: ["book_id"];
            isOneToOne: false;
            referencedRelation: "books";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reading_logs_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      space_avatars: {
        Row: {
          look: NonNullable<Json>;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          look: NonNullable<Json>;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          look?: NonNullable<Json>;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "space_avatars_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      space_rooms: {
        Row: {
          style: NonNullable<Json>;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          style: NonNullable<Json>;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          style?: NonNullable<Json>;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "space_rooms_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      space_visits: {
        Row: {
          entered_at: string;
          id: string;
          left_at: string | null;
          space_id: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          entered_at?: string;
          id?: string;
          left_at?: string | null;
          space_id?: string;
          user_id?: string;
        };
        Update: {
          entered_at?: string;
          id?: string;
          left_at?: string | null;
          space_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "space_visits_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      tea_columns: {
        Row: {
          body: string;
          created_at: string;
          id: string;
          tea_type: string | null;
          title: string;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          body: string;
          created_at?: string;
          id?: string;
          tea_type?: string | null;
          title: string;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          body?: string;
          created_at?: string;
          id?: string;
          tea_type?: string | null;
          title?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "tea_columns_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      timer_sessions: {
        Row: {
          activity: string;
          ended_at: string | null;
          id: string;
          paused_at: string | null;
          paused_seconds: number;
          started_at: string;
          status: string;
          target_seconds: number;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          activity: string;
          ended_at?: string | null;
          id?: string;
          paused_at?: string | null;
          paused_seconds?: number;
          started_at?: string;
          status?: string;
          target_seconds: number;
          user_id: string;
        };
        Update: {
          activity?: string;
          ended_at?: string | null;
          id?: string;
          paused_at?: string | null;
          paused_seconds?: number;
          started_at?: string;
          status?: string;
          target_seconds?: number;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "timer_sessions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      attendance_days: {
        Row: {
          day: string | null;
          focus_seconds: number | null;
          sessions: number | null;
          user_id: string;
        };
        ComputedFields: never;
        Relationships: [
          {
            foreignKeyName: "timer_sessions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Functions: {
      book_key: { Args: { p_title: string }; Returns: string };
      can_access_chat: {
        Args: { p_kind: string; p_room_id: string };
        Returns: boolean;
      };
      delete_group_message: {
        Args: { p_message_id: string };
        Returns: {
          body: string;
          client_id: string;
          created_at: string;
          deleted_at: string | null;
          deleted_by: string | null;
          group_id: string;
          id: string;
          sender_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "group_messages";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      delete_my_account: {
        Args: Record<PropertyKey, never>;
        Returns: undefined;
      };
      dm_can_send: { Args: { p_thread_id: string }; Returns: boolean };
      finish_timer: {
        Args: { p_id: string; p_status: string };
        Returns: {
          activity: string;
          ended_at: string | null;
          id: string;
          paused_at: string | null;
          paused_seconds: number;
          started_at: string;
          status: string;
          target_seconds: number;
          user_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "timer_sessions";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      has_visible_text: { Args: { p_value: string }; Returns: boolean };
      is_blocked_between: {
        Args: { p_a: string; p_b: string };
        Returns: boolean;
      };
      is_dm_participant: { Args: { p_thread_id: string }; Returns: boolean };
      is_group_banned: { Args: { p_group_id: string }; Returns: boolean };
      is_group_member: { Args: { p_group_id: string }; Returns: boolean };
      is_group_moderator: { Args: { p_group_id: string }; Returns: boolean };
      is_group_muted: { Args: { p_group_id: string }; Returns: boolean };
      is_group_owner: { Args: { p_group_id: string }; Returns: boolean };
      is_nickname_available: { Args: { p_nickname: string }; Returns: boolean };
      leave_dm: { Args: { p_thread_id: string }; Returns: undefined };
      mark_chat_read: {
        Args: { p_kind: string; p_room_id: string };
        Returns: undefined;
      };
      my_avatar_file_count: {
        Args: Record<PropertyKey, never>;
        Returns: number;
      };
      my_books: {
        Args: Record<PropertyKey, never>;
        Returns: {
          author: string;
          cover_url: string;
          created_at: string;
          genres: string[];
          id: string;
          last_log_at: string;
          log_count: number;
          pages: number;
          status: string;
          title: string;
          updated_at: string;
        }[];
      };
      my_chat_states: {
        Args: Record<PropertyKey, never>;
        Returns: {
          hidden: boolean;
          kind: string;
          muted: boolean;
          pinned_at: string;
          room_id: string;
          unread: number;
        }[];
      };
      my_dm_threads: {
        Args: Record<PropertyKey, never>;
        Returns: {
          created_at: string;
          id: string;
          last_at: string;
          last_body: string;
          last_sender_id: string;
          other_avatar_url: string;
          other_id: string;
          other_nickname: string;
        }[];
      };
      my_group_chats: {
        Args: Record<PropertyKey, never>;
        Returns: {
          group_id: string;
          joined_at: string;
          last_at: string;
          last_body: string;
          last_deleted: boolean;
          last_sender_id: string;
          last_sender_nickname: string;
          member_count: number;
          name: string;
        }[];
      };
      my_group_role: { Args: { p_group_id: string }; Returns: string };
      my_record_stats: { Args: Record<PropertyKey, never>; Returns: Json };
      my_unread_total: { Args: Record<PropertyKey, never>; Returns: number };
      pause_timer: {
        Args: { p_id: string };
        Returns: {
          activity: string;
          ended_at: string | null;
          id: string;
          paused_at: string | null;
          paused_seconds: number;
          started_at: string;
          status: string;
          target_seconds: number;
          user_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "timer_sessions";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      public_profile_stats: { Args: { p_user_id: string }; Returns: Json };
      record_post_view: { Args: { p_post_id: string }; Returns: boolean };
      resume_timer: {
        Args: { p_id: string };
        Returns: {
          activity: string;
          ended_at: string | null;
          id: string;
          paused_at: string | null;
          paused_seconds: number;
          started_at: string;
          status: string;
          target_seconds: number;
          user_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "timer_sessions";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      set_book_pages: {
        Args: { p_book_id: string; p_total: number };
        Returns: number;
      };
      set_chat_pref: {
        Args: {
          p_kind: string;
          p_muted?: boolean;
          p_pinned?: boolean;
          p_room_id: string;
        };
        Returns: undefined;
      };
      set_group_manager: {
        Args: { p_group_id: string; p_manager: boolean; p_user_id: string };
        Returns: undefined;
      };
      set_group_mute: {
        Args: { p_group_id: string; p_muted: boolean; p_user_id: string };
        Returns: undefined;
      };
      start_dm: { Args: { p_other: string }; Returns: Json };
      start_timer: {
        Args: { p_activity: string; p_target_seconds: number };
        Returns: {
          activity: string;
          ended_at: string | null;
          id: string;
          paused_at: string | null;
          paused_seconds: number;
          started_at: string;
          status: string;
          target_seconds: number;
          user_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "timer_sessions";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const;
