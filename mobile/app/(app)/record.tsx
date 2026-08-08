import { useEffect, useState } from 'react';
import { View, Text, Pressable, ScrollView, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { track } from '@/lib/analytics';
import { todayJST } from '@/lib/utils';
import { Icon } from '@/components/ui/icon';
import { AppHeader } from '@/components/ui/app-header';
import { SafetyResourceCard } from '@/components/safety-resource-card';
import { KIND_LABEL } from '@/components/pillar-sections';
import type {
  Category,
  CurrentWeeklyCheckResult,
  FluctuationEvent,
  FluctuationMagnitude,
  HotlineView,
  PillarKind,
  SaveFluctuationResult,
  SaveWeeklyCheckResult,
} from '@/types';

type Level = 0 | 1 | 2 | 3;

const VISIBLE_CATEGORY_LIMIT = 10;

const MAGNITUDES: { value: FluctuationMagnitude; label: string }[] = [
  { value: 'small', label: '小' },
  { value: 'medium', label: '中' },
  { value: 'large', label: '大' },
];

const MAGNITUDE_LABEL: Record<FluctuationMagnitude, string> = {
  small: '小さく揺れた',
  medium: '揺れた',
  large: '大きく揺れた',
};

function formatWeekRange(weekStart: string): string {
  const start = new Date(`${weekStart}T00:00:00Z`);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);
  const fmt = (d: Date) => `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
  return `${fmt(start)} - ${fmt(end)}`;
}

export default function WeeklyCheckScreen() {
  const router = useRouter();
  const qc = useQueryClient();

  const { data: current, isLoading } = useQuery<CurrentWeeklyCheckResult>({
    queryKey: ['weekly-check-current'],
    queryFn: () => api.get<CurrentWeeklyCheckResult>('/weekly-check/current'),
  });

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ['categories'],
    queryFn: () => api.get<Category[]>('/categories'),
    select: (cats) => cats.filter((c) => c.isActive),
  });

  const today = todayJST();
  const { data: fluctuations = [] } = useQuery<FluctuationEvent[]>({
    queryKey: ['fluctuations', today],
    queryFn: () => api.get<FluctuationEvent[]>(`/records/fluctuations?from=${today}&to=${today}`),
  });

  const [levels, setLevels] = useState<Record<string, Level>>({});
  const [moodNoteOpen, setMoodNoteOpen] = useState(false);
  const [moodNote, setMoodNote] = useState('');
  const [showMoreCategories, setShowMoreCategories] = useState(false);
  const [result, setResult] = useState<SaveWeeklyCheckResult | null>(null);

  // 点検の画面内から柱を追加する（07 §4.2）
  const [addPillarOpen, setAddPillarOpen] = useState(false);
  const [newPillarName, setNewPillarName] = useState('');
  const [newPillarKind, setNewPillarKind] = useState<PillarKind>('place');

  const [fluctOpen, setFluctOpen] = useState(false);
  const [fluctCategoryId, setFluctCategoryId] = useState<string | null>(null);
  const [fluctMagnitude, setFluctMagnitude] = useState<FluctuationMagnitude | null>(null);
  const [fluctNote, setFluctNote] = useState('');
  const [fluctSafetyPrompt, setFluctSafetyPrompt] = useState<{ eventId: string; hotlines: HotlineView[] } | null>(null);

  useEffect(() => {
    if (!current) return;
    setLevels((prev) => {
      if (Object.keys(prev).length > 0) return prev;
      const init: Record<string, Level> = {};
      current.entries.forEach((e) => {
        init[e.categoryId] = e.level as Level;
      });
      return init;
    });
    if (current.moodNote) {
      setMoodNote(current.moodNote);
      setMoodNoteOpen(true);
    }
  }, [current]);

  const saveMutation = useMutation({
    mutationFn: () =>
      api.put<SaveWeeklyCheckResult>('/weekly-check', {
        entries: Object.entries(levels)
          .filter(([, level]) => level > 0)
          .map(([categoryId, level]) => ({ categoryId, level })),
        moodNote: moodNote || undefined,
      }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['weekly-check-current'] });
      qc.invalidateQueries({ queryKey: ['portfolio'] });
      qc.invalidateQueries({ queryKey: ['reports'] });
      track('weekly_check_saved', { entries: res.check.entries.length });
      setResult(res);
    },
  });

  const addPillarMutation = useMutation({
    mutationFn: () =>
      api.post<Category>('/categories', {
        name: newPillarName.trim(),
        parentName: KIND_LABEL[newPillarKind],
        kind: newPillarKind,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['categories'] });
      qc.invalidateQueries({ queryKey: ['weekly-check-current'] });
      setNewPillarName('');
      setAddPillarOpen(false);
    },
  });

  const addFluctMutation = useMutation({
    mutationFn: () =>
      api.post<SaveFluctuationResult>('/records/fluctuations', {
        occurredDate: today,
        categoryId: fluctCategoryId ?? undefined,
        magnitude: fluctMagnitude,
        note: fluctNote || undefined,
      }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['fluctuations', today] });
      setFluctCategoryId(null);
      setFluctMagnitude(null);
      setFluctNote('');
      if (res.safetyVerdict !== 'clear' && res.hotlines.length > 0) {
        setFluctSafetyPrompt({ eventId: res.event.id, hotlines: res.hotlines });
      }
    },
  });

  const deleteFluctMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/records/fluctuations/${id}`),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ['fluctuations', today] });
      setFluctSafetyPrompt((prev) => (prev?.eventId === id ? null : prev));
    },
  });

  function cycleLevel(id: string) {
    setLevels((prev) => {
      const next = (((prev[id] ?? 0) + 1) % 4) as Level;
      return { ...prev, [id]: next };
    });
  }

  const displayCategories = current?.categories ?? categories.map((c) => ({ ...c, selectionCount: 0 }));
  const visibleCategories = showMoreCategories ? displayCategories : displayCategories.slice(0, VISIBLE_CATEGORY_LIMIT);
  const hiddenCount = displayCategories.length - visibleCategories.length;

  if (result) {
    const topEntry = [...result.check.entries].sort((a, b) => b.level - a.level)[0];
    const topCategory = topEntry ? displayCategories.find((c) => c.id === topEntry.categoryId) : null;
    return (
      <View className="flex-1 bg-background">
        <AppHeader title="今週の点検" subtitle={current ? formatWeekRange(current.weekStart) : ''} back />
        <View className="px-4 pt-8 pb-8">
          <View className="rounded-2xl border border-border bg-white p-6 shadow-sm items-center">
            <Text className="mb-4 text-3xl">🌙</Text>
            <Text className="mb-2 text-center text-base leading-relaxed text-foreground">
              {topCategory ? `今週は${topCategory.name}が大きかったんですね。記録しました。` : 'そういう週もあります。記録しました。'}
            </Text>
            {/* 確かな柱が0件のまま続いた人にだけ1回（06 §5.2）。宿題に見えないよう控えめに置く */}
            {result.gentleNudge && (
              <Text className="mt-4 w-full text-xs leading-relaxed text-muted-foreground">{result.gentleNudge}</Text>
            )}
            {result.safetyVerdict !== 'clear' && result.hotlines.length > 0 && (
              <View className="mt-4 w-full">
                <SafetyResourceCard variant="block" hotlines={result.hotlines} />
              </View>
            )}
            <Pressable onPress={() => router.replace('/dashboard')} className="mt-6">
              <Text className="text-sm font-semibold text-accent">ホームへ戻る →</Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <AppHeader title="今週の点検" subtitle={current ? formatWeekRange(current.weekStart) : ''} back />
      <ScrollView contentContainerClassName="px-4 pb-8 pt-5">
        <Text className="mb-1 text-sm text-muted-foreground">この1週間、支えになったのは？</Text>
        <Text className="mb-6 text-xs text-muted-foreground">いくつでも、なくても大丈夫です</Text>

        {isLoading && <Text className="text-center text-sm text-muted-foreground">読み込み中...</Text>}

        <View className="gap-2.5">
          {visibleCategories.map((cat) => {
            const level = levels[cat.id] ?? 0;
            return (
              <Pressable
                key={cat.id}
                onPress={() => cycleLevel(cat.id)}
                className={`flex-row items-center gap-3 rounded-2xl border p-4 shadow-sm ${
                  level > 0 ? 'border-accent/30' : 'border-border bg-white'
                }`}
                style={level > 0 ? { backgroundColor: `${cat.color}${['', '22', '44', '66'][level]}` } : undefined}
              >
                <View className="h-3 w-3 rounded-full" style={{ backgroundColor: cat.color }} />
                <Text
                  numberOfLines={1}
                  className={`flex-1 text-sm font-medium ${level > 0 ? 'text-foreground' : 'text-muted-foreground'}`}
                >
                  {cat.name}
                </Text>
                {'kind' in cat && <Text className="text-[10px] text-muted-foreground">{KIND_LABEL[cat.kind]}</Text>}
                {level > 0 && (
                  <View className="flex-row gap-0.5">
                    {[1, 2, 3].map((i) => (
                      <View key={i} className={`h-4 w-1.5 rounded-full ${i <= level ? 'bg-primary' : 'bg-secondary'}`} />
                    ))}
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>

        {hiddenCount > 0 && (
          <Pressable onPress={() => setShowMoreCategories(true)} className="mt-3 py-2">
            <Text className="text-center text-xs font-semibold text-accent">もっと見る（他{hiddenCount}件）</Text>
          </Pressable>
        )}

        {/* 点検の画面内から柱を足せるようにする（07 §4.2 / 06 W-04） */}
        {!addPillarOpen ? (
          <Pressable onPress={() => setAddPillarOpen(true)} className="mt-4">
            <Text className="text-xs font-semibold text-accent">＋ 新しく追加する</Text>
          </Pressable>
        ) : (
          <View className="mt-4 gap-3 rounded-2xl border border-border bg-white p-4 shadow-sm">
            <View className="flex-row gap-1.5">
              {(['place', 'relation', 'habit'] as PillarKind[]).map((k) => (
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
              placeholder={
                newPillarKind === 'relation' ? '名前やあだ名でどうぞ' : newPillarKind === 'place' ? '例: 木曜のバンド' : '例: 朝の散歩'
              }
              placeholderTextColor="#6B584880"
              className="rounded-xl border border-border px-3 py-2.5 text-sm text-foreground"
            />
            {newPillarKind === 'relation' && (
              <Text className="text-[11px] text-muted-foreground">ここに書いた名前は誰にも見えません。</Text>
            )}
            <View className="flex-row gap-2">
              <Pressable
                onPress={() => {
                  setAddPillarOpen(false);
                  setNewPillarName('');
                }}
                className="flex-1 items-center rounded-xl border border-border py-2"
              >
                <Text className="text-xs font-semibold text-muted-foreground">やめる</Text>
              </Pressable>
              <Pressable
                disabled={!newPillarName.trim() || addPillarMutation.isPending}
                onPress={() => addPillarMutation.mutate()}
                className={`flex-1 items-center rounded-xl bg-accent py-2 ${!newPillarName.trim() ? 'opacity-40' : ''}`}
              >
                <Text className="text-xs font-semibold text-white">追加する</Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* ひとこと残す（既定で折りたたみ） */}
        <View className="mt-8 overflow-hidden rounded-2xl border border-border bg-white shadow-sm">
          <Pressable onPress={() => setMoodNoteOpen((v) => !v)} className="flex-row items-center gap-3 p-4">
            <Icon name="edit" size={18} color="#6B5848" />
            <Text className="flex-1 text-sm font-medium text-foreground">
              ひとこと残す<Text className="text-xs text-muted-foreground"> （任意）</Text>
            </Text>
            <Icon name={moodNoteOpen ? 'expand_less' : 'expand_more'} size={20} color="#6B5848" />
          </Pressable>
          {moodNoteOpen && (
            <View className="px-4 pb-4">
              <TextInput
                value={moodNote}
                onChangeText={setMoodNote}
                maxLength={500}
                multiline
                numberOfLines={3}
                placeholder="今週のことを、少しだけ"
                placeholderTextColor="#6B584880"
                className="rounded-xl border border-border bg-white px-3 py-2.5 text-sm text-foreground"
              />
            </View>
          )}
        </View>

        {/* 心が揺れた出来事（既存機能。今回のスコープでは変更しない） */}
        <View className="mt-4 overflow-hidden rounded-2xl border border-border bg-white shadow-sm">
          <Pressable onPress={() => setFluctOpen((v) => !v)} className="flex-row items-center gap-3 p-4">
            <Icon name="water_drop" size={18} color="#0EA5E9" />
            <Text className="flex-1 text-sm font-medium text-foreground">
              心が揺れた出来事はありましたか？<Text className="text-xs text-muted-foreground"> （任意）</Text>
            </Text>
            <Icon name={fluctOpen ? 'expand_less' : 'expand_more'} size={20} color="#6B5848" />
          </Pressable>

          {fluctOpen && (
            <View className="gap-4 px-4 pb-4">
              {fluctuations.length > 0 && (
                <View className="gap-2">
                  {fluctuations.map((f) => (
                    <View key={f.id} className="flex-row items-center gap-2 rounded-xl border border-sky-100 bg-sky-50 px-3 py-2">
                      <Text className="text-xs font-semibold text-sky-700">{MAGNITUDE_LABEL[f.magnitude]}</Text>
                      {f.category && <Text className="text-xs text-sky-600">{f.category.name}</Text>}
                      {f.note && (
                        <Text numberOfLines={1} className="flex-1 text-xs text-muted-foreground">
                          {f.note}
                        </Text>
                      )}
                      <Pressable onPress={() => deleteFluctMutation.mutate(f.id)} className="ml-auto">
                        <Icon name="close" size={16} color="#6B5848" />
                      </Pressable>
                    </View>
                  ))}
                </View>
              )}

              <View>
                <Text className="mb-2 text-xs text-muted-foreground">関係するもの（任意）</Text>
                <View className="flex-row flex-wrap gap-1.5">
                  {categories.map((cat) => (
                    <Pressable
                      key={cat.id}
                      onPress={() => setFluctCategoryId((prev) => (prev === cat.id ? null : cat.id))}
                      style={fluctCategoryId === cat.id ? { backgroundColor: cat.color, borderColor: cat.color } : undefined}
                      className={`rounded-full border px-3 py-1.5 ${fluctCategoryId === cat.id ? '' : 'border-border bg-white'}`}
                    >
                      <Text className={`text-xs font-medium ${fluctCategoryId === cat.id ? 'text-white' : 'text-muted-foreground'}`}>
                        {cat.name}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              <View>
                <Text className="mb-2 text-xs text-muted-foreground">揺れの大きさ</Text>
                <View className="flex-row gap-2">
                  {MAGNITUDES.map(({ value, label }) => (
                    <Pressable
                      key={value}
                      onPress={() => setFluctMagnitude(value)}
                      className={`flex-1 rounded-xl border py-2 ${fluctMagnitude === value ? 'border-sky-500 bg-sky-500' : 'border-transparent bg-secondary'}`}
                    >
                      <Text className={`text-center text-sm font-semibold ${fluctMagnitude === value ? 'text-white' : 'text-muted-foreground'}`}>
                        {label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              <TextInput
                value={fluctNote}
                onChangeText={setFluctNote}
                placeholder="ひとことメモ（任意）"
                maxLength={500}
                placeholderTextColor="#6B584880"
                className="rounded-xl border border-border bg-white px-3 py-2.5 text-sm text-foreground"
              />

              <Pressable
                onPress={() => addFluctMutation.mutate()}
                disabled={!fluctMagnitude || addFluctMutation.isPending}
                className={`rounded-xl bg-sky-500 py-2.5 ${!fluctMagnitude || addFluctMutation.isPending ? 'opacity-40' : ''}`}
              >
                <Text className="text-center text-sm font-semibold text-white">
                  {addFluctMutation.isPending ? '追加中…' : '揺らぎを記録する'}
                </Text>
              </Pressable>

              {fluctSafetyPrompt && (
                <SafetyResourceCard
                  variant="block"
                  hotlines={fluctSafetyPrompt.hotlines}
                  onDelete={() => deleteFluctMutation.mutate(fluctSafetyPrompt.eventId)}
                />
              )}
            </View>
          )}
        </View>

        <View className="mt-8">
          <Pressable
            onPress={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            className={`rounded-xl bg-accent py-3.5 shadow-lg ${saveMutation.isPending ? 'opacity-50' : ''}`}
          >
            <Text className="text-center text-sm font-semibold text-white">
              {saveMutation.isPending
                ? '記録中…'
                : Object.values(levels).some((l) => l > 0)
                  ? '終わり'
                  : '今週は思いつかない'}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}
