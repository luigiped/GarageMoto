import * as Crypto from 'expo-crypto'
import * as SecureStore from 'expo-secure-store'

const LOCAL_ENCRYPTION_KEY = 'garagemoto:local-encryption-key'
const ENCRYPTED_PAYLOAD_PREFIX = 'enc-v1'
const IV_LENGTH_BYTES = 12

let importedKeyPromise: Promise<CryptoKey> | null = null

export function isEncryptedPayload(value: string | null | undefined): boolean {
  return Boolean(value?.startsWith(`${ENCRYPTED_PAYLOAD_PREFIX}:`))
}

export async function encryptLocalPayload(plainText: string): Promise<string> {
  if (!plainText || isEncryptedPayload(plainText)) {
    return plainText
  }

  const subtle = getSubtleCrypto()
  const key = await getOrCreateCryptoKey()
  const iv = await Crypto.getRandomBytesAsync(IV_LENGTH_BYTES)
  const encrypted = await subtle.encrypt(
    { name: 'AES-GCM', iv: toArrayBuffer(iv) },
    key,
    toArrayBuffer(encodeUtf8(plainText)),
  )

  return `${ENCRYPTED_PAYLOAD_PREFIX}:${toHex(iv)}:${toHex(new Uint8Array(encrypted))}`
}

export async function decryptLocalPayload(value: string): Promise<string> {
  if (!value || !isEncryptedPayload(value)) {
    return value
  }

  const subtle = getSubtleCrypto()
  const key = await getOrCreateCryptoKey()
  const [, ivHex, cipherHex] = value.split(':')
  if (!ivHex || !cipherHex) {
    throw new Error('Payload cifrato locale non valido.')
  }

  const decrypted = await subtle.decrypt(
    { name: 'AES-GCM', iv: toArrayBuffer(fromHex(ivHex)) },
    key,
    toArrayBuffer(fromHex(cipherHex)),
  )

  return decodeUtf8(new Uint8Array(decrypted))
}

function getSubtleCrypto(): SubtleCrypto {
  const subtle = globalThis.crypto?.subtle
  if (!subtle) {
    throw new Error('SubtleCrypto non disponibile nel runtime corrente.')
  }
  return subtle
}

async function getOrCreateCryptoKey(): Promise<CryptoKey> {
  if (!importedKeyPromise) {
    importedKeyPromise = loadOrCreateCryptoKey()
  }

  return importedKeyPromise
}

async function loadOrCreateCryptoKey(): Promise<CryptoKey> {
  const rawHex = await getOrCreateKeyHex()
  return getSubtleCrypto().importKey(
    'raw',
    toArrayBuffer(fromHex(rawHex)),
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt'],
  )
}

async function getOrCreateKeyHex(): Promise<string> {
  const existing = await SecureStore.getItemAsync(LOCAL_ENCRYPTION_KEY)
  if (existing) {
    return existing
  }

  const bytes = await Crypto.getRandomBytesAsync(32)
  const next = toHex(bytes)
  await SecureStore.setItemAsync(LOCAL_ENCRYPTION_KEY, next)
  return next
}

function encodeUtf8(value: string): Uint8Array {
  return new TextEncoder().encode(value)
}

function decodeUtf8(value: Uint8Array): string {
  return new TextDecoder().decode(value)
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

function fromHex(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) {
    throw new Error('Hex non valido.')
  }

  const bytes = new Uint8Array(hex.length / 2)
  for (let index = 0; index < hex.length; index += 2) {
    bytes[index / 2] = Number.parseInt(hex.slice(index, index + 2), 16)
  }
  return bytes
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
}
