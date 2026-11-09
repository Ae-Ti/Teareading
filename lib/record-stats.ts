import type { SupabaseClient } from "@supabase/supabase-js";
import type { Genre } from "@/lib/books";
import type { TeaType } from "@/lib/records";
import type { Database } from "@/types/database";

export type MonthValue = { month: string; value: number };

export type RecordStats = {
  reading: {
    books: number;
    finished: number;
    reading_now: number;
    by_genre: { genre: Genre; count: number }[];
    logs: number;
    pages: number;
    pages_this_month: number;
    top_books: { title: string; pages: number; logs: number }[];
    monthly: MonthValue[];
  };
  tea: {
    columns: number;
    untyped: number;
    by_type: { type: TeaType; count: number }[];
    seconds: number;
    sessions: number;
    seconds_this_month: number;
    monthly: MonthValue[];
  };
};

// 내 기록 화면의 통계 (본인 기록만 집계된다)
export async function getRecordStats(supabase: SupabaseClient<Database>) {
  const { data, error } = await supabase.rpc("my_record_stats");
  if (error) return { stats: null, error };
  return { stats: data as unknown as RecordStats, error: null };
}
