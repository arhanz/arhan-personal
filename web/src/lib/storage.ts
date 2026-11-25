import { mkdir, readFile, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import path from "node:path";

const DIR = process.env.STORAGE_DIR ?? path.join(process.cwd(), "storage");

export function sniffImage(b: Buffer): { ext: string; mime: string } | null {
  if (b.length > 12 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return { ext: "png", mime: "image/png" };
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { ext: "jpg", mime: "image/jpeg" };
  if (b.length > 12 && b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP") return { ext: "webp", mime: "image/webp" };
  return null;
}
export async function saveBuffer(buf: Buffer, ext: string) {
  await mkdir(DIR, { recursive: true });
  const key = randomBytes(24).toString("hex") + "." + ext;
  await writeFile(path.join(DIR, key), buf);
  return key;
}
export async function readStored(key: string) {
  if (!/^[a-f0-9]{48}\.(png|jpg|webp)$/.test(key)) throw new Error("bad key");
  return readFile(path.join(DIR, key));
}
