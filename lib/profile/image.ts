import sharp from "sharp";
import { AVATAR_INPUT_TYPES, MAX_AVATAR_BYTES } from "./forms";

export const MAX_POST_IMAGE_BYTES = 5 * 1024 * 1024;

// 형식·파일 시그니처를 확인하고 sharp로 연다
async function openImage(file: File, maxBytes: number, maxPixels: number) {
  if (file.size > maxBytes || !AVATAR_INPUT_TYPES.includes(file.type)) {
    throw new Error("invalid_avatar");
  }
  const bytes = Buffer.from(await file.arrayBuffer());
  const matchesSignature =
    (file.type === "image/jpeg" &&
      bytes.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) ||
    (file.type === "image/png" &&
      bytes
        .subarray(0, 8)
        .equals(
          Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        )) ||
    (file.type === "image/webp" &&
      bytes.toString("ascii", 0, 4) === "RIFF" &&
      bytes.toString("ascii", 8, 12) === "WEBP");
  if (!matchesSignature) throw new Error("invalid_avatar");
  const image = sharp(bytes, {
    limitInputPixels: maxPixels,
    failOn: "warning",
  });
  const metadata = await image.metadata();
  const mime = { jpeg: "image/jpeg", png: "image/png", webp: "image/webp" };
  if (
    !metadata.format ||
    !(metadata.format in mime) ||
    mime[metadata.format as keyof typeof mime] !== file.type ||
    (metadata.pages ?? 1) > 1
  ) {
    throw new Error("invalid_avatar");
  }
  return image;
}

// 재인코딩으로 위치 정보 등 원본 메타데이터와 원래 파일 이름을 저장하지 않는다.
export async function prepareAvatar(file: File) {
  const image = await openImage(file, MAX_AVATAR_BYTES, 16_000_000);
  return image
    .autoOrient()
    .resize(512, 512, { fit: "cover", withoutEnlargement: true })
    .webp({ quality: 85 })
    .timeout({ seconds: 5 })
    .toBuffer();
}

// 게시판 글 사진: 비율을 유지하고 긴 변 1600px 이하로 줄인다
export async function preparePostImage(file: File) {
  const image = await openImage(file, MAX_POST_IMAGE_BYTES, 50_000_000);
  return image
    .autoOrient()
    .resize(1600, 1600, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 82 })
    .timeout({ seconds: 10 })
    .toBuffer();
}
