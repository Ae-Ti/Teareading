// 이용약관·개인정보처리방침에 들어가는 운영 정보. 문서 본문은 app/terms, app/privacy에 있다.
// ⚠️ 출시 전 운영자가 실제 값을 확인해야 하는 항목은 `null`로 두었다.
//    null이면 화면에 "출시 전 공지 예정"으로 표시되고, `npm run test:legal`이 실패해 출시 전 확인을 강제한다.
export const LEGAL = {
  serviceName: "티어리딩",
  // 운영 주체 (개인 이름 또는 팀·사업자명)
  operator: null as string | null,
  // 개인정보 보호책임자 이름·직책
  privacyOfficer: null as string | null,
  // 문의·탈퇴·개인정보 요청을 받는 이메일
  contactEmail: null as string | null,
  // Supabase 프로덕션 프로젝트 리전 (예: "대한민국(서울, ap-northeast-2)")
  dataRegion: null as string | null,
  // 시행일 (출시일)
  effectiveDate: "2026년 11월 9일",
} as const;

export const PENDING = "출시 전 공지 예정";

export function legalValue(value: string | null) {
  return value ?? PENDING;
}

export function missingLegalFields() {
  return (
    ["operator", "privacyOfficer", "contactEmail", "dataRegion"] as const
  ).filter((key) => LEGAL[key] === null);
}
