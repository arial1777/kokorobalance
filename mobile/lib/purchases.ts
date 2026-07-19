import { Platform } from 'react-native';
import Purchases, { LOG_LEVEL } from 'react-native-purchases';
import type { CustomerInfo, PurchasesOffering } from 'react-native-purchases';

const IOS_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY;

/** RevenueCatダッシュボードで作成するEntitlement識別子と一致させる */
export const PRO_ENTITLEMENT_ID = 'pro';

let configured = false;

export function configurePurchases() {
  if (configured || Platform.OS !== 'ios' || !IOS_API_KEY) return;
  Purchases.configure({ apiKey: IOS_API_KEY });
  if (__DEV__) Purchases.setLogLevel(LOG_LEVEL.DEBUG);
  configured = true;
}

/**
 * RevenueCatのapp_user_idをSupabaseのユーザーIDと一致させる。
 * これによりバックエンドはWebhookのapp_user_idをprofiles.idとしてそのまま扱える
 * （デバイス間の復元のために別途IDマッピングを持つ必要がない）。
 */
export async function loginPurchases(userId: string): Promise<void> {
  if (!configured) return;
  await Purchases.logIn(userId);
}

export async function logoutPurchases(): Promise<void> {
  if (!configured) return;
  await Purchases.logOut().catch(() => {});
}

export async function getCurrentOffering(): Promise<PurchasesOffering | null> {
  if (!configured) return null;
  const offerings = await Purchases.getOfferings();
  return offerings.current;
}

export function isProEntitled(info: CustomerInfo): boolean {
  return typeof info.entitlements.active[PRO_ENTITLEMENT_ID] !== 'undefined';
}

export async function restorePurchases(): Promise<CustomerInfo> {
  return Purchases.restorePurchases();
}
