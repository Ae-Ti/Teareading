import sharp from "sharp";
import { AVATAR_INPUT_TYPES, MAX_AVATAR_BYTES } from "./forms";

export async function prepareAvatar(file: File) {
  if (file.size > MAX_AVATAR_BYTES || !AVATAR_INPUT_TYPES.includes(file.type)) {
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
    limitInputPixels: 16_000_000,
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
  // 재인코딩으로 위치 정보 등 원본 메타데이터와 원래 파일 이름을 저장하지 않는다.
  return image
    .autoOrient()
    .resize(512, 512, { fit: "cover", withoutEnlargement: true })
    .webp({ quality: 85 })
    .timeout({ seconds: 5 })
    .toBuffer();
}
