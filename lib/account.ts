import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

// 회원 탈퇴 확인 문구. 실수로 누르지 않도록 직접 입력하게 한다.
export const DELETE_CONFIRM = "탈퇴합니다";

const FAILED =
  "탈퇴를 마치지 못했어요. 계정은 그대로 남아 있어요. 잠시 후 다시 시도해 주세요.";

// 1) 프로필 이미지·글 사진 파일 삭제 (Storage는 회원과 연결돼 있지 않아 자동으로 지워지지 않는다)
// 2) 계정 삭제 → 프로필·기록·메시지·모임장인 모임·차단·찻집 기록이 함께 지워진다
// 파일 삭제에 실패하면 계정을 지우지 않는다 (공개 URL로 이미지가 남는 것을 막기 위해).
export async function deleteAccount(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    for (const name of ["avatars", "post-images"]) {
      const bucket = supabase.storage.from(name);
      const listed = await bucket.list(userId, { limit: 1000 });
      if (listed.error) return { ok: false, message: FAILED };
      const paths = listed.data.map((file) => `${userId}/${file.name}`);
      if (paths.length) {
        const removed = await bucket.remove(paths);
        if (removed.error) return { ok: false, message: FAILED };
      }
    }
    const { error } = await supabase.rpc("delete_my_account");
    if (error) return { ok: false, message: FAILED };
    return { ok: true };
  } catch {
    return { ok: false, message: FAILED };
  }
}
