// Entry program for make.fun news-image-20261126 — "The World Today,
// 26 November 2026 in one image".
//
// The page itself is drawn ahead of time by a PIL renderer and stored in
// this repository as entry.png. This program's whole job is to deliver
// those exact bytes to the output directory: it audits the payload
// (PNG signature, the competition's 1 MiB cap), then copies it. It uses
// no network, no clock and no randomness, so two runs always produce
// byte-identical output with the same sha256.
import { copyFileSync, mkdirSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoDir = dirname(fileURLToPath(import.meta.url));
const srcPath = join(repoDir, "entry.png");
const payload = readFileSync(srcPath);

// Audit before copying: the gate only accepts a whole PNG of at most
// 1 MiB, so fail loudly here rather than ship a broken entry.
const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const isPng = PNG_MAGIC.every((byte, i) => payload[i] === byte);
if (!isPng) {
  throw new Error("entry.png does not start with the PNG signature");
}
if (payload.byteLength > 1_048_576) {
  throw new Error(`entry.png is ${payload.byteLength} bytes, over the 1 MiB cap`);
}

// The canvas must be exactly the competition's 1024x1024 frame. A PNG's
// IHDR chunk stores width and height as big-endian uint32s at bytes
// 16..24, right after the signature and the chunk header, so the audit
// can read the dimensions straight from the payload bytes.
const width = payload.readUInt32BE(16);
const height = payload.readUInt32BE(20);
if (width !== 1024 || height !== 1024) {
  throw new Error(`entry.png is ${width}x${height}, not the required 1024x1024`);
}

const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";
mkdirSync(outDir, { recursive: true });
const destPath = join(outDir, "entry.png");
copyFileSync(srcPath, destPath);

const digest = createHash("sha256").update(payload).digest("hex");

// Prove the copy landed whole: re-read what was written and compare its
// digest with the audited source before declaring success.
const written = readFileSync(destPath);
const writtenDigest = createHash("sha256").update(written).digest("hex");
if (writtenDigest !== digest) {
  throw new Error(`copied entry.png sha256 ${writtenDigest} != source ${digest}`);
}
console.log(`entry.png: ${payload.byteLength} bytes, ${width}x${height}, sha256 ${digest} -> ${destPath}`);
