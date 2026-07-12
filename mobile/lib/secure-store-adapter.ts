import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

// expo-secure-store の1アイテムは2048バイトまでという制約があり、
// Supabaseのセッション(access_token + refresh_token等)はこれを超えることがあるため、
// 値をチャンク分割して複数キーに保存する。
const CHUNK_SIZE = 1800;

// expo-secure-storeはWebをサポートしないため、Web版（管理画面プレビュー等）ではlocalStorageに委譲する。
const WebStorageAdapter = {
  async getItem(key: string): Promise<string | null> {
    return globalThis.localStorage?.getItem(key) ?? null;
  },
  async setItem(key: string, value: string): Promise<void> {
    globalThis.localStorage?.setItem(key, value);
  },
  async removeItem(key: string): Promise<void> {
    globalThis.localStorage?.removeItem(key);
  },
};

function chunkKey(key: string, index: number): string {
  return `${key}_chunk_${index}`;
}

async function getChunkCount(key: string): Promise<number> {
  const raw = await SecureStore.getItemAsync(`${key}_chunk_count`);
  return raw ? parseInt(raw, 10) : 0;
}

const NativeSecureStoreAdapter = {
  async getItem(key: string): Promise<string | null> {
    const count = await getChunkCount(key);
    if (count === 0) return null;
    const chunks = await Promise.all(
      Array.from({ length: count }, (_, i) => SecureStore.getItemAsync(chunkKey(key, i))),
    );
    if (chunks.some((c) => c === null)) return null;
    return chunks.join('');
  },

  async setItem(key: string, value: string): Promise<void> {
    const previousCount = await getChunkCount(key);
    const chunks: string[] = [];
    for (let i = 0; i < value.length; i += CHUNK_SIZE) {
      chunks.push(value.slice(i, i + CHUNK_SIZE));
    }
    await Promise.all(chunks.map((chunk, i) => SecureStore.setItemAsync(chunkKey(key, i), chunk)));
    for (let i = chunks.length; i < previousCount; i++) {
      await SecureStore.deleteItemAsync(chunkKey(key, i));
    }
    await SecureStore.setItemAsync(`${key}_chunk_count`, String(chunks.length));
  },

  async removeItem(key: string): Promise<void> {
    const count = await getChunkCount(key);
    await Promise.all(
      Array.from({ length: count }, (_, i) => SecureStore.deleteItemAsync(chunkKey(key, i))),
    );
    await SecureStore.deleteItemAsync(`${key}_chunk_count`);
  },
};

export const ChunkedSecureStoreAdapter =
  Platform.OS === 'web' ? WebStorageAdapter : NativeSecureStoreAdapter;
