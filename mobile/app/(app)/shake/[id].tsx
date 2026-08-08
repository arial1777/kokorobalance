import { useState } from 'react';
import { View, Text, Pressable, ScrollView, TextInput, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { AppHeader } from '@/components/ui/app-header';
import { SafetyResourceCard } from '@/components/safety-resource-card';
import { KIND_LABEL } from '@/components/pillar-sections';
import { ProUpsell } from '@/components/pro-upsell';
import type { PillarKind, PrepAction, Profile, SaveShakeReviewResult, ShakeEventDetail, WasSupported } from '@/types';

const SHAKE_LABELS = ['少し', 'けっこう', 'かなり'];
const SUPPORTED_OPTIONS: { value: WasSupported; label: string }[] = [
  { value: 'yes', label: 'あった' },
  { value: 'partly', label: '少し' },
  { value: 'no', label: 'なかった' },
];

export default function ShakeEventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const [customPrepOpen, setCustomPrepOpen] = useState(false);
  const [customPrepBody, setCustomPrepBody] = useState('');
  const [feltShake, setFeltShake] = useState<number | null>(null);
  const [wasSupported, setWasSupported] = useState<WasSupported | null>(null);
  const [helpedIds, setHelpedIds] = useState<string[]>([]);
  const [reviewNote, setReviewNote] = useState('');
  const [reviewResult, setReviewResult] = useState<SaveShakeReviewResult | null>(null);

  // 備えの完了から柱を登録する導線（07 §4.2）
  const [pillarPrompt, setPillarPrompt] = useState<string | null>(null);
  const [newPillarName, setNewPillarName] = useState('');
  const [newPillarKind, setNewPillarKind] = useState<PillarKind>('relation');

  const { data, isLoading } = useQuery<ShakeEventDetail>({
    queryKey: ['shake-event', id],
    queryFn: () => api.get<ShakeEventDetail>(`/shake/events/${id}`),
  });

  const { data: profile } = useQuery<Profile>({
    queryKey: ['profile'],
    queryFn: () => api.get<Profile>('/profile'),
  });

  const acceptMutation = useMutation({
    mutationFn: (prepId: string) => api.post(`/shake/events/${id}/preps/${prepId}/accept`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shake-event', id] }),
  });
  const doneMutation = useMutation({
    mutationFn: (prepId: string) => api.post(`/shake/events/${id}/preps/${prepId}/done`),
    onSuccess: (_res, prepId) => {
      qc.invalidateQueries({ queryKey: ['shake-event', id] });
      // 備えを実行した結果として柱が増えるのが理想的なループ（07 §4.2）
      const done = data?.preps.find((p) => p.id === prepId);
      if (done) setPillarPrompt(done.body);
    },
  });

  // 備えの完了から柱を登録する
  const addPillarMutation = useMutation({
    mutationFn: () =>
      api.post('/categories', {
        name: newPillarName.trim(),
        parentName: KIND_LABEL[newPillarKind],
        kind: newPillarKind,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['categories'] });
      qc.invalidateQueries({ queryKey: ['portfolio'] });
      setPillarPrompt(null);
      setNewPillarName('');
    },
  });
  const skipMutation = useMutation({
    mutationFn: (prepId: string) => api.post(`/shake/events/${id}/preps/${prepId}/skip`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shake-event', id] }),
  });
  const customPrepMutation = useMutation({
    mutationFn: () => api.post(`/shake/events/${id}/preps`, { body: customPrepBody }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['shake-event', id] });
      setCustomPrepOpen(false);
      setCustomPrepBody('');
    },
  });
  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/shake/events/${id}`),
    onSuccess: () => router.replace('/shake'),
  });
  const reviewMutation = useMutation({
    mutationFn: () =>
      api.post<SaveShakeReviewResult>(`/shake/events/${id}/review`, {
        feltShake,
        wasSupported,
        helpedCategoryIds: helpedIds.length ? helpedIds : undefined,
        note: reviewNote || undefined,
      }),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ['shake-event', id] });
      setReviewResult(result);
    },
  });

  if (isLoading || !data) {
    return (
      <View className="flex-1 bg-background">
        <AppHeader title="揺れそうな日" back />
        <Text className="text-center text-sm text-muted-foreground mt-8">読み込み中...</Text>
      </View>
    );
  }

  const { event, preps, review } = data;
  const accepted = preps.find((p) => p.state === 'accepted');
  const suggested = preps.filter((p) => p.state === 'suggested');

  function confirmDelete() {
    Alert.alert('この揺れそうな日を削除しますか？', undefined, [
      { text: 'キャンセル', style: 'cancel' },
      { text: '削除する', style: 'destructive', onPress: () => deleteMutation.mutate() },
    ]);
  }

  return (
    <View className="flex-1 bg-background">
      <AppHeader title={event.title} subtitle="揺れそうな日" back />
      <ScrollView contentContainerClassName="px-4 pt-5 pb-24 gap-5">
        {/* 備えを実行した結果として柱が増えるのが理想的なループ（07 §4.2） */}
        {pillarPrompt && (
          <View className="rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm">
            <Text className="mb-1 text-sm font-semibold text-foreground">できましたね。</Text>
            <Text className="mb-3 text-xs leading-relaxed text-muted-foreground">
              「{pillarPrompt}」で関わった人や場所を、柱として登録しておきますか？
            </Text>
            <View className="mb-2.5 flex-row gap-1.5">
              {(['relation', 'place', 'habit'] as PillarKind[]).map((k) => (
                <Pressable
                  key={k}
                  onPress={() => setNewPillarKind(k)}
                  className={`flex-1 items-center rounded-lg border py-1.5 ${
                    newPillarKind === k ? 'border-primary bg-primary' : 'border-border'
                  }`}
                >
                  <Text
                    className={`text-xs font-semibold ${newPillarKind === k ? 'text-white' : 'text-muted-foreground'}`}
                  >
                    {KIND_LABEL[k]}
                  </Text>
                </Pressable>
              ))}
            </View>
            <TextInput
              value={newPillarName}
              onChangeText={setNewPillarName}
              maxLength={20}
              placeholder={newPillarKind === 'relation' ? '名前やあだ名でどうぞ' : '例: 木曜のバンド'}
              placeholderTextColor="#6B584880"
              className="mb-2 rounded-xl border border-border px-3 py-2.5 text-sm text-foreground"
            />
            {newPillarKind === 'relation' && (
              <Text className="mb-2 text-[11px] text-muted-foreground">ここに書いた名前は誰にも見えません。</Text>
            )}
            <View className="flex-row gap-2">
              <Pressable
                onPress={() => {
                  setPillarPrompt(null);
                  setNewPillarName('');
                }}
                className="flex-1 items-center rounded-xl border border-border py-2"
              >
                <Text className="text-xs font-semibold text-muted-foreground">いまはしない</Text>
              </Pressable>
              <Pressable
                disabled={!newPillarName.trim() || addPillarMutation.isPending}
                onPress={() => addPillarMutation.mutate()}
                className={`flex-1 items-center rounded-xl bg-accent py-2 ${!newPillarName.trim() ? 'opacity-40' : ''}`}
              >
                <Text className="text-xs font-semibold text-white">柱にする</Text>
              </Pressable>
            </View>
          </View>
        )}

        {event.preReflection && (event.status === 'prepping' || event.status === 'today') && (
          <View className="bg-white rounded-2xl border border-border shadow-sm p-5">
            <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">揺れの前の整理</Text>
            <Text className="text-sm text-foreground leading-relaxed">{event.preReflection}</Text>
          </View>
        )}

        {event.status === 'planned' && (
          <View className="bg-white rounded-2xl border border-border shadow-sm p-5">
            <Text className="text-sm text-muted-foreground leading-relaxed">
              まだ備えの時期ではありません。近づいたら、こちらで備えを一緒に考えます。
            </Text>
          </View>
        )}

        {event.status === 'prepping' && (
          <View className="bg-white rounded-2xl border border-border shadow-sm p-5">
            {accepted ? (
              <>
                <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">いま備えていること</Text>
                <View className="bg-secondary rounded-xl p-4">
                  <Text className="text-sm text-foreground mb-3">{accepted.body}</Text>
                  <View className="flex-row gap-2">
                    <Pressable onPress={() => doneMutation.mutate(accepted.id)} className="flex-1 py-2 rounded-lg bg-primary items-center">
                      <Text className="text-white text-xs font-semibold">できた</Text>
                    </Pressable>
                    <Pressable onPress={() => skipMutation.mutate(accepted.id)} className="flex-1 py-2 rounded-lg border border-border items-center">
                      <Text className="text-xs font-semibold text-muted-foreground">変える</Text>
                    </Pressable>
                  </View>
                </View>
              </>
            ) : (
              <>
                <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">ひとつだけ、備えてみませんか</Text>
                <View className="gap-2">
                  {suggested.map((p) => (
                    <Pressable key={p.id} onPress={() => acceptMutation.mutate(p.id)} className="px-4 py-3 rounded-xl border border-border">
                      <Text className="text-sm text-foreground">{p.body}</Text>
                    </Pressable>
                  ))}
                  {!customPrepOpen ? (
                    <Pressable onPress={() => setCustomPrepOpen(true)}>
                      <Text className="text-xs text-accent">＋ 自分で書く</Text>
                    </Pressable>
                  ) : (
                    <View className="flex-row gap-2">
                      <TextInput
                        value={customPrepBody}
                        onChangeText={setCustomPrepBody}
                        maxLength={60}
                        placeholder="自分で備えを書く"
                        className="flex-1 px-3 py-2 rounded-xl border border-border text-sm text-foreground"
                      />
                      <Pressable
                        disabled={!customPrepBody.trim() || customPrepMutation.isPending}
                        onPress={() => customPrepMutation.mutate()}
                        className={`px-4 py-2 rounded-xl bg-accent items-center justify-center ${!customPrepBody.trim() ? 'opacity-40' : ''}`}
                      >
                        <Text className="text-white text-xs font-semibold">追加</Text>
                      </Pressable>
                    </View>
                  )}
                </View>
                <Text className="text-xs text-muted-foreground mt-3">選ばなくても大丈夫です</Text>
              </>
            )}
          </View>
        )}

        {event.status === 'today' && event.supportListSnapshot && (
          <View className="bg-white rounded-2xl border border-sky-100 shadow-sm p-5">
            <Text className="text-sm font-semibold text-foreground mb-4">
              {event.supportListSnapshot.headline === 'many' && 'あなたには、これがあります。'}
              {event.supportListSnapshot.headline === 'one' && '今日は、これがあります。'}
              {event.supportListSnapshot.headline === 'none' && '今日はしんどい日かもしれません。無理に何かしなくて大丈夫です。'}
            </Text>
            <View className="gap-2">
              {event.supportListSnapshot.items.map((item, i) => (
                <View key={i} className="rounded-xl bg-secondary px-4 py-3">
                  <Text className="text-sm text-foreground">{item.label}</Text>
                  {item.detail && <Text className="text-xs text-muted-foreground mt-0.5">{item.detail}</Text>}
                </View>
              ))}
            </View>
            <View className="mt-4">
              <SafetyResourceCard variant="block" hotlines={data.hotlines} />
            </View>
          </View>
        )}

        {event.status === 'passed' && !review && !reviewResult && (
          <View className="bg-white rounded-2xl border border-border shadow-sm p-5 gap-5">
            <Text className="text-sm font-semibold text-foreground">{event.title} から少し経ちました。どうでしたか？</Text>

            <View>
              <Text className="text-xs text-muted-foreground mb-2">実際、どのくらい揺れましたか？</Text>
              <View className="flex-row gap-2">
                {SHAKE_LABELS.map((label, i) => (
                  <Pressable
                    key={label}
                    onPress={() => setFeltShake(i + 1)}
                    className={`flex-1 py-2 rounded-xl border items-center ${feltShake === i + 1 ? 'bg-primary border-primary' : 'border-border'}`}
                  >
                    <Text className={`text-xs font-semibold ${feltShake === i + 1 ? 'text-white' : 'text-muted-foreground'}`}>{label}</Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View>
              <Text className="text-xs text-muted-foreground mb-2">支えられた感じはありましたか？</Text>
              <View className="flex-row gap-2">
                {SUPPORTED_OPTIONS.map((o) => (
                  <Pressable
                    key={o.value}
                    onPress={() => setWasSupported(o.value)}
                    className={`flex-1 py-2 rounded-xl border items-center ${wasSupported === o.value ? 'bg-primary border-primary' : 'border-border'}`}
                  >
                    <Text className={`text-xs font-semibold ${wasSupported === o.value ? 'text-white' : 'text-muted-foreground'}`}>{o.label}</Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {preps.some((p) => p.state === 'done') && (
              <View>
                <Text className="text-xs text-muted-foreground mb-2">どれが効きましたか？（複数選択・任意）</Text>
                <View className="gap-1.5">
                  {preps
                    .filter((p) => p.state === 'done')
                    .map((p: PrepAction) => (
                      <Pressable
                        key={p.id}
                        disabled={!p.categoryId}
                        onPress={() =>
                          p.categoryId &&
                          setHelpedIds((prev) => (prev.includes(p.categoryId!) ? prev.filter((x) => x !== p.categoryId) : [...prev, p.categoryId!]))
                        }
                        className="flex-row items-center gap-2"
                      >
                        <View
                          className={`w-4 h-4 rounded border ${p.categoryId && helpedIds.includes(p.categoryId) ? 'bg-primary border-primary' : 'border-border'}`}
                        />
                        <Text className="text-sm text-foreground">{p.body}</Text>
                      </Pressable>
                    ))}
                </View>
              </View>
            )}

            <TextInput
              value={reviewNote}
              onChangeText={setReviewNote}
              maxLength={500}
              placeholder="ひとこと残す（任意）"
              className="px-3 py-2.5 rounded-xl border border-border text-sm text-foreground"
            />

            <Pressable
              disabled={!feltShake || !wasSupported || reviewMutation.isPending}
              onPress={() => reviewMutation.mutate()}
              className={`py-2.5 rounded-xl bg-accent items-center ${!feltShake || !wasSupported ? 'opacity-40' : ''}`}
            >
              <Text className="text-white text-sm font-semibold">終わり</Text>
            </Pressable>
          </View>
        )}

        {reviewResult && (
          <View className="bg-white rounded-2xl border border-border shadow-sm p-5 gap-4">
            <Text className="text-sm text-foreground leading-relaxed">
              {reviewResult.review.wasSupported === 'no'
                ? 'そうでしたか。書いてくれてありがとうございます。効かなかったことも、次の手がかりになります。'
                : '記録しました。次に揺れそうな日が来たら、まずこれを思い出します。'}
            </Text>
            {reviewResult.review.aiReflection && (
              <View className="rounded-xl bg-secondary/60 px-4 py-3">
                <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">ふりかえり</Text>
                <Text className="text-sm text-foreground leading-relaxed">{reviewResult.review.aiReflection}</Text>
              </View>
            )}
            {reviewResult.hotlines.length > 0 && <SafetyResourceCard variant="caution" hotlines={reviewResult.hotlines} />}
          </View>
        )}

        {/*
          課金訴求は「支えられた」と答えた直後にだけ出す（10 §2.4 #1、最重要の訴求点）。
          ふりかえりは passed（D+1以降）でしか行えないので、**揺れの当日には出ない**（M-A-04）。
          つらかった人（no / partly）には出さない。
        */}
        {reviewResult?.review.wasSupported === 'yes' && profile?.plan !== 'pro' && (
          <ProUpsell
            route="shake_review_supported"
            headline="よかったです。"
            body="次の揺れる日には、これまでのふりかえりを踏まえた整理を、3日前にお届けすることもできます。"
          />
        )}

        {(event.status === 'archived' || (event.status === 'passed' && (review || reviewResult))) && (
          <View className="bg-secondary/50 rounded-2xl p-5">
            {review ? (
              <Text className="text-sm text-muted-foreground">
                ふりかえり: 支えられた感じ「{SUPPORTED_OPTIONS.find((o) => o.value === review.wasSupported)?.label}」
              </Text>
            ) : (
              <Text className="text-sm text-muted-foreground">この揺れそうな日は完了しました。</Text>
            )}
          </View>
        )}

        {event.status !== 'archived' && (
          <Pressable onPress={confirmDelete} className="pt-2">
            <Text className="text-center text-xs text-muted-foreground">削除する</Text>
          </Pressable>
        )}
      </ScrollView>
    </View>
  );
}
