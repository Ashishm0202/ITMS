import { cbc } from "@noble/ciphers/aes.js";
import { pbkdf2 } from "@noble/hashes/pbkdf2.js";
import { sha1 } from "@noble/hashes/legacy.js";
import { base64 } from "@scure/base";

/**
 * Mirrors the backend's own password encryption scheme exactly (PBKDF2-SHA1 key derivation +
 * AES-CBC over UTF-16LE plaintext) - this is the same .NET Rfc2898DeriveBytes-compatible scheme
 * shared across this organization's apps, not something invented for this app specifically.
 */
const SALT = new Uint8Array([73, 118, 97, 110, 32, 77, 101, 100, 118, 101, 100, 101, 118]); // "Ivan Medvedev"
const DERIVE_PASSWORD = "KMDRE23870FDR3S";

function decodeUtf16LE(bytes: Uint8Array): string {
  let result = "";
  for (let i = 0; i < bytes.length; i += 2) {
    const code = bytes[i] | (bytes[i + 1] << 8);
    if (code === 0) break;
    result += String.fromCharCode(code);
  }
  return result;
}

function encodeUtf16LE(str: string): Uint8Array {
  const buf = new Uint8Array(str.length * 2);
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    buf[i * 2] = code & 0xff;
    buf[i * 2 + 1] = code >> 8;
  }
  return buf;
}

function deriveKeyAndIV() {
  const keyMaterial = pbkdf2(sha1, DERIVE_PASSWORD, SALT, { c: 1000, dkLen: 48 });
  return { key: keyMaterial.slice(0, 32), iv: keyMaterial.slice(32, 48) };
}

export function encrypt(plainText: string): string {
  const { key, iv } = deriveKeyAndIV();
  const encryptedBytes = cbc(key, iv).encrypt(encodeUtf16LE(plainText));
  return base64.encode(encryptedBytes);
}

export function decrypt(cipherTextBase64: string): string {
  const { key, iv } = deriveKeyAndIV();
  const decryptedBytes = cbc(key, iv).decrypt(base64.decode(cipherTextBase64));
  return decodeUtf16LE(decryptedBytes);
}
