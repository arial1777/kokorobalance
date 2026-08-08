import { useState } from 'react';
import { View, Text, Pressable, ScrollView, TextInput, Alert, Share } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { toast } from '@/store/toast';
import { AppHeader } from '@/components/ui/app-header';
import { PairSharingNotice } from '@/components/pair-sharing-notice';
import type { PairView, PillarSlot, VerificationRequestAnswer } from '@/types';

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : '通信に失敗しました';
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

/**
 * 確かな柱は色つき、それ以外は白丸。常に5個（09 §2.3、PR-A-12）。
 *
 * 育て中と空きスロットを描き分けないのは意図的。分けると育て中の本数が数えられてしまい、
 * 「数を数えられる形にしない」という §2.3 の狙いが崩れる（仕様のモックも ●●●○○ と同じ丸）
 */
function PillarDots({ slots }: { slots: PillarSlot[] }) {
  return (
    <View className="flex-row items-center gap-1.5">
      {slots.map((slot, i) =>
        slot.kind === 'verified' ? (
          <View key={i} className="h-3 w-3 rounded-full" style={{ backgroundColor: slot.color }} />
        ) : (
          <View key={i} className="h-3 w-3 rounded-full border-2 border-border bg-white" />
        ),
      )}
    </View>
  );
}

export default function PairScreen() {
  const qc = useQueryClient();
  const [code, setCode] = useState('');

  const { data: pair, isLoading } = useQuery<PairView>({
    queryKey: ['pair'],
    queryFn: () => api.get<PairView>('/pair'),
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['pair'] });
    qc.invalidateQueries({ queryKey: ['categories'] });
  };

  const inviteMutation = useMutation({
    mutationFn: () => api.post<{ code: string; expiresAt: string }>('/pair/invite'),
    onSuccess: refresh,
    onError: (e) => toast.error(errorMessage(e)),
  });
  const revokeMutation = useMutation({
    mutationFn: () => api.delete('/pair/invite'),
    onSuccess: refresh,
    onError: (e) => toast.error(errorMessage(e)),
  });
  const acceptMutation = useMutation({
    mutationFn: () => api.post('/pair/accept', { code: code.trim().toUpperCase() }),
    onSuccess: () => {
      setCode('');
      refresh();
      toast.success('ペアになりました');
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const pauseMutation = useMutation({
    mutationFn: () => api.post('/pair/pause'),
    onSuccess: refresh,
    onError: (e) => toast.error(errorMessage(e)),
  });
  const resumeMutation = useMutation({
    mutationFn: () => api.post('/pair/resume'),
    onSuccess: refresh,
    onError: (e) => toast.error(errorMessage(e)),
  });
  const endMutation = useMutation({
    mutationFn: () => api.delete('/pair'),
    onSuccess: refresh,
    onError: (e) => toast.error(errorMessage(e)),
  });
  const respondMutation = useMutation({
    mutationFn: ({ id, answer }: { id: string; answer: VerificationRequestAnswer }) =>
      api.post(`/pair/requests/${id}/respond`, { answer }),
    onSuccess: refresh,
    onError: (e) => toast.error(errorMessage(e)),
  });

  function confirmEnd() {
    Alert.alert('ペアを解消しますか？', undefined, [
      { text: 'やめる', style: 'cancel' },
      { text: '解消する', style: 'destructive', onPress: () => endMutation.mutate() },
    ]);
  }

  return (
    <View className="flex-1 bg-background">
      <AppHeader title="ペア" subtitle="ひとりだけ、招待できます" back />
      <ScrollView contentContainerClassName="gap-5 px-4 pb-24 pt-5">
        {isLoading && <Text className="text-center text-sm text-muted-foreground">読み込み中...</Text>}

        {/* ペアなし */}
        {pair && pair.state === null && (
          <>
            <View className="rounded-2xl border border-border bg-white p-5 shadow-sm">
              <Text className="mb-1 text-sm font-semibold text-foreground">ひとりだけ、招待できます</Text>
              <Text className="mb-4 text-xs leading-relaxed text-muted-foreground">
                お互いの支えを、そっと確かめ合うためのつながりです。メッセージのやりとりはできません。
              </Text>
              <Pressable
                onPress={() => inviteMutation.mutate()}
                disabled={inviteMutation.isPending}
                className={`items-center rounded-xl bg-accent py-3 ${inviteMutation.isPending ? 'opacity-40' : ''}`}
              >
                <Text className="text-sm font-semibold text-white">
                  {inviteMutation.isPending ? '作成中…' : '招待コードを作る'}
                </Text>
              </Pressable>
            </View>

            <View className="rounded-2xl border border-border bg-white p-5 shadow-sm">
              <Text className="mb-3 text-sm font-semibold text-foreground">コードをもらった方</Text>
              <View className="flex-row gap-2">
                <TextInput
                  value={code}
                  onChangeText={(v) => setCode(v.toUpperCase())}
                  maxLength={8}
                  autoCapitalize="characters"
                  placeholder="招待コード"
                  placeholderTextColor="#6B584880"
                  className="flex-1 rounded-xl border border-border px-3 py-2.5 text-sm tracking-widest text-foreground"
                />
                <Pressable
                  onPress={() => acceptMutation.mutate()}
                  disabled={code.trim().length < 6 || acceptMutation.isPending}
                  className={`rounded-xl bg-primary px-5 py-2.5 ${code.trim().length < 6 ? 'opacity-40' : ''}`}
                >
                  <Text className="text-sm font-semibold text-white">つながる</Text>
                </Pressable>
              </View>
            </View>

            <PairSharingNotice />
          </>
        )}

        {/* 招待中 */}
        {pair?.state === 'invited' && pair.invite && (
          <>
            <View className="items-center rounded-2xl border border-border bg-white p-5 shadow-sm">
              <Text className="mb-2 text-xs text-muted-foreground">このコードを、招待したい人に渡してください</Text>
              <Text className="mb-1 text-3xl font-bold tracking-widest text-foreground">{pair.invite.code}</Text>
              <Text className="mb-4 text-[11px] text-muted-foreground">
                {formatDate(pair.invite.expiresAt)}まで有効
              </Text>
              <Pressable
                onPress={() => Share.share({ message: `ココロバランスの招待コード: ${pair.invite!.code}` })}
                className="mb-2 w-full items-center rounded-xl border border-border py-2.5"
              >
                <Text className="text-sm font-semibold text-foreground">コードを送る</Text>
              </Pressable>
              <Pressable onPress={() => revokeMutation.mutate()} disabled={revokeMutation.isPending}>
                <Text className="text-xs text-muted-foreground">招待をやめる</Text>
              </Pressable>
            </View>
            <PairSharingNotice />
          </>
        )}

        {/* 一時停止中 */}
        {pair?.state === 'paused' && (
          <View className="items-center rounded-2xl border border-border bg-white p-5 shadow-sm">
            <Text className="mb-1 text-sm font-semibold text-foreground">いま、共有を止めています</Text>
            <Text className="mb-4 text-xs text-muted-foreground">再開するまで、お互いに何も見えません。</Text>
            <Pressable
              onPress={() => resumeMutation.mutate()}
              className="w-full items-center rounded-xl bg-accent py-2.5"
            >
              <Text className="text-sm font-semibold text-white">共有を再開する</Text>
            </Pressable>
          </View>
        )}

        {/* 成立後 */}
        {pair?.state === 'active' && pair.partner && (
          <>
            <View className="rounded-2xl border border-border bg-white p-5 shadow-sm">
              <Text className="mb-4 text-base font-semibold text-foreground">{pair.partner.displayName} さん</Text>

              <View className="mb-3 flex-row items-center justify-between">
                <Text className="text-xs text-muted-foreground">今週の点検</Text>
                <Text className="text-sm text-foreground">{pair.partner.checkedThisWeek ? '済' : 'まだ'}</Text>
              </View>

              <View className="mb-4 flex-row items-center justify-between">
                <Text className="text-xs text-muted-foreground">柱</Text>
                <PillarDots slots={pair.partner.pillarSlots} />
              </View>

              {pair.partner.upcomingShake && (
                <View className="rounded-xl bg-sky-50 px-4 py-3">
                  <Text className="text-sm text-sky-900">
                    {formatDate(`${pair.partner.upcomingShake.eventDate}T00:00:00`)}に、揺れそうな日があります
                  </Text>
                  {pair.partner.upcomingShake.title && (
                    <Text className="mt-0.5 text-xs text-sky-700">{pair.partner.upcomingShake.title}</Text>
                  )}
                </View>
              )}
            </View>

            {pair.incomingRequests.map((req) => (
              <View key={req.id} className="rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm">
                <Text className="mb-1 text-xs text-muted-foreground">{req.requesterName} さんから</Text>
                <Text className="mb-1 text-base font-semibold text-foreground">「{req.pillarLabel}」</Text>
                <Text className="mb-4 text-sm leading-relaxed text-muted-foreground">
                  これが、{req.requesterName}さんの支えになっていることを知っていますか？
                </Text>
                <View className="mb-3 flex-row gap-2">
                  <Pressable
                    onPress={() => respondMutation.mutate({ id: req.id, answer: 'known' })}
                    disabled={respondMutation.isPending}
                    className="flex-1 items-center rounded-xl bg-primary py-2.5"
                  >
                    <Text className="text-sm font-semibold text-white">知っている</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => respondMutation.mutate({ id: req.id, answer: 'unsure' })}
                    disabled={respondMutation.isPending}
                    className="flex-1 items-center rounded-xl border border-border py-2.5"
                  >
                    <Text className="text-sm font-semibold text-muted-foreground">よく知らない</Text>
                  </Pressable>
                </View>
                <Text className="text-[11px] leading-relaxed text-muted-foreground">
                  どちらを選んでも、相手には「見た」ことだけが伝わります。
                </Text>
              </View>
            ))}

            {pair.outgoingRequests.length > 0 && (
              <View className="rounded-2xl border border-border bg-white p-5 shadow-sm">
                <Text className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  お願いしている柱
                </Text>
                <View className="gap-2">
                  {pair.outgoingRequests.map((req) => (
                    <View key={req.id} className="flex-row items-center justify-between">
                      <Text className="text-sm text-foreground">{req.categoryName}</Text>
                      <Text className="text-xs text-muted-foreground">
                        {req.state === 'seen' ? '見てもらいました' : '待っています'}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            <PairSharingNotice />

            <View className="gap-3 pt-2">
              <Pressable onPress={() => pauseMutation.mutate()}>
                <Text className="text-center text-xs text-muted-foreground">しばらく共有を止める</Text>
              </Pressable>
              <Pressable onPress={confirmEnd}>
                <Text className="text-center text-xs text-muted-foreground">ペアを解消する</Text>
              </Pressable>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}
