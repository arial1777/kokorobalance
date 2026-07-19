import { useEffect, useState } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import * as WebBrowser from 'expo-web-browser';
import Purchases, { PURCHASES_ERROR_CODE } from 'react-native-purchases';
import type { PurchasesPackage } from 'react-native-purchases';
import { getCurrentOffering, isProEntitled, restorePurchases } from '@/lib/purchases';
import { toast } from '@/store/toast';
import { Icon } from '@/components/ui/icon';
import { AppHeader } from '@/components/ui/app-header';

const WEB_URL = process.env.EXPO_PUBLIC_WEB_URL ?? 'https://kokorobalance.example.com';

const BENEFITS = [
  'AIコーチと無制限に会話できる',
  '週間レポートのAIコメントを毎週読める',
  'プリセットにない自分だけのカテゴリを追加できる',
];

async function waitForProSync(qc: ReturnType<typeof useQueryClient>) {
  for (let i = 0; i < 5; i++) {
    await qc.invalidateQueries({ queryKey: ['profile'] });
    await qc.invalidateQueries({ queryKey: ['coach-quota'] });
    const profile = qc.getQueryData<{ plan?: string }>(['profile']);
    if (profile?.plan === 'pro') return;
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
}

export default function PaywallPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [packages, setPackages] = useState<PurchasesPackage[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [purchasingId, setPurchasingId] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);

  useEffect(() => {
    getCurrentOffering()
      .then((offering) => setPackages(offering?.availablePackages ?? []))
      .catch(() => setPackages([]))
      .finally(() => setLoading(false));
  }, []);

  async function handlePurchase(pkg: PurchasesPackage) {
    setPurchasingId(pkg.identifier);
    try {
      const { customerInfo } = await Purchases.purchasePackage(pkg);
      if (isProEntitled(customerInfo)) {
        toast.success('Proプランへようこそ！');
        await waitForProSync(qc);
        router.back();
      }
    } catch (err: any) {
      if (err?.code !== PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR) {
        toast.error('購入処理に失敗しました。時間をおいて再度お試しください');
      }
    } finally {
      setPurchasingId(null);
    }
  }

  async function handleRestore() {
    setRestoring(true);
    try {
      const info = await restorePurchases();
      if (isProEntitled(info)) {
        toast.success('購入を復元しました');
        await waitForProSync(qc);
        router.back();
      } else {
        toast.error('復元できる購入が見つかりませんでした');
      }
    } catch {
      toast.error('復元に失敗しました。時間をおいて再度お試しください');
    } finally {
      setRestoring(false);
    }
  }

  if (Platform.OS !== 'ios') {
    return (
      <View className="flex-1 bg-background">
        <AppHeader title="Proプラン" back />
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-center text-sm text-muted-foreground">
            現在このプラットフォームではご利用いただけません
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <AppHeader title="Proプラン" subtitle="心の柱を、もっと自由に育てる" back />
      <ScrollView contentContainerClassName="gap-6 px-4 pb-8 pt-5">
        <View className="items-center rounded-2xl bg-primary/10 p-5">
          <View className="mb-3 h-14 w-14 items-center justify-center rounded-2xl bg-primary">
            <Icon name="workspace_premium" filled size={28} color="#FFFFFF" />
          </View>
          <Text className="text-lg font-bold text-foreground">ココロバランス Pro</Text>
        </View>

        <View className="gap-2.5">
          {BENEFITS.map((benefit) => (
            <View key={benefit} className="flex-row items-center gap-2.5 rounded-xl border border-border bg-white px-4 py-3 shadow-sm">
              <Icon name="check_circle" filled size={18} color="#1A3352" />
              <Text className="flex-1 text-sm text-foreground">{benefit}</Text>
            </View>
          ))}
        </View>

        {loading ? (
          <ActivityIndicator color="#1A3352" className="mt-4" />
        ) : packages && packages.length > 0 ? (
          <View className="gap-3">
            {packages.map((pkg) => (
              <Pressable
                key={pkg.identifier}
                onPress={() => handlePurchase(pkg)}
                disabled={purchasingId !== null || restoring}
                className={`rounded-2xl bg-accent px-5 py-4 shadow-sm ${purchasingId !== null || restoring ? 'opacity-50' : ''}`}
              >
                {purchasingId === pkg.identifier ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <Text className="text-center text-base font-bold text-white">{pkg.product.title}</Text>
                    <Text className="mt-0.5 text-center text-sm text-white/90">
                      {pkg.product.priceString}
                      {pkg.product.subscriptionPeriod ? ` / ${describePeriod(pkg.product.subscriptionPeriod)}` : ''}
                    </Text>
                  </>
                )}
              </Pressable>
            ))}
          </View>
        ) : (
          <Text className="text-center text-sm text-muted-foreground">
            現在ご購入いただけるプランがありません。時間をおいて再度お試しください
          </Text>
        )}

        <Pressable onPress={handleRestore} disabled={restoring || purchasingId !== null} className="items-center py-2">
          {restoring ? (
            <ActivityIndicator color="#6B5848" />
          ) : (
            <Text className="text-sm font-semibold text-muted-foreground">購入を復元</Text>
          )}
        </Pressable>

        <Text className="text-center text-[11px] leading-relaxed text-muted-foreground">
          お支払いはApple IDに請求されます。購読は自動更新され、現在の期間終了の24時間前までにキャンセルしない限り、同一料金で自動的に更新されます。購読の管理・解約はiPhoneの「設定」＞Apple
          ID＞「サブスクリプション」から行えます。
        </Text>

        <View className="flex-row justify-center gap-4">
          <Text className="text-xs text-accent" onPress={() => WebBrowser.openBrowserAsync(`${WEB_URL}/terms`)}>
            利用規約
          </Text>
          <Text className="text-xs text-accent" onPress={() => WebBrowser.openBrowserAsync(`${WEB_URL}/privacy`)}>
            プライバシーポリシー
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

function describePeriod(period: string): string {
  // ISO 8601 duration (例: P1M, P1Y)
  const match = /^P(\d+)([DWMY])$/.exec(period);
  if (!match) return period;
  const [, n, unit] = match;
  const labels: Record<string, string> = { D: '日', W: '週間', M: 'ヶ月', Y: '年' };
  return `${n}${labels[unit] ?? unit}`;
}
