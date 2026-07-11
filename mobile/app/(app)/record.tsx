import { useEffect, useState } from 'react';
import { View, Text, Pressable, ScrollView, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { track } from '@/lib/analytics';
import { todayJST } from '@/lib/utils';
import { Icon } from '@/components/ui/icon';
import { AppHeader } from '@/components/ui/app-header';
import type {
  Category,
  DailyRecord,
  FluctuationEvent,
  FluctuationMagnitude,
  RecordFeedback,
  SaveRecordResult,
} from '@/types';

type Level = 1 | 2 | 3;

const LEVELS: { value: Level; label: string }[] = [
  { value: 1, label: 'すこし' },
  { value: 2, label: '満たされた' },
  { value: 3, label: 'とても' },
];

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

export default function RecordPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const today = todayJST();

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ['categories'],
    queryFn: () => api.get<Category[]>('/categories'),
    select: (cats) => cats.filter((c) => c.isActive),
  });

  const { data: todayRecord } = useQuery<DailyRecord | null>({
    queryKey: ['record', today],
    queryFn: () => api.get<DailyRecord>(`/records/${today}`),
  });

  const { data: fluctuations = [] } = useQuery<FluctuationEvent[]>({
    queryKey: ['fluctuations', today],
    queryFn: () => api.get<FluctuationEvent[]>(`/records/fluctuations?from=${today}&to=${today}`),
  });

  const [levels, setLevels] = useState<Record<string, Level>>({});
  const [feedback, setFeedback] = useState<RecordFeedback | null>(null);

  const [fluctOpen, setFluctOpen] = useState(false);
  const [fluctCategoryId, setFluctCategoryId] = useState<string | null>(null);
  const [fluctMagnitude, setFluctMagnitude] = useState<FluctuationMagnitude | null>(null);
  const [fluctNote, setFluctNote] = useState('');

  useEffect(() => {
    if (!todayRecord) return;
    setLevels((prev) => {
      if (Object.keys(prev).length > 0) return prev;
      const init: Record<string, Level> = {};
      todayRecord.items.forEach((i) => {
        init[i.categoryId] = Math.min(3, Math.max(1, i.score)) as Level;
      });
      return init;
    });
  }, [todayRecord]);

  const saveMutation = useMutation({
    mutationFn: (items: { categoryId: string; score: number }[]) =>
      api.post<SaveRecordResult>('/records', { recordedDate: today, items }),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ['record', today] });
      qc.invalidateQueries({ queryKey: ['portfolio'] });
      track('record_saved', { date: today, items: result.record.items.length });
      setFeedback(result.feedback);
    },
  });

  useEffect(() => {
    if (!feedback) return;
    const timer = setTimeout(() => router.replace('/dashboard'), 2600);
    return () => clearTimeout(timer);
  }, [feedback, router]);

  const addFluctMutation = useMutation({
    mutationFn: () =>
      api.post<FluctuationEvent>('/records/fluctuations', {
        occurredDate: today,
        categoryId: fluctCategoryId ?? undefined,
        magnitude: fluctMagnitude,
        note: fluctNote || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fluctuations', today] });
      setFluctCategoryId(null);
      setFluctMagnitude(null);
      setFluctNote('');
    },
  });

  const deleteFluctMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/records/fluctuations/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fluctuations', today] }),
  });

  function toggleCategory(id: string) {
    setLevels((prev) => {
      const next = { ...prev };
      if (next[id]) delete next[id];
      else next[id] = 2;
      return next;
    });
  }

  function handleSubmit() {
    const items = Object.entries(levels).map(([categoryId, score]) => ({ categoryId, score }));
    saveMutation.mutate(items);
  }

  const selectedCount = Object.keys(levels).length;

  const grouped = categories.reduce<Record<string, Category[]>>((acc, c) => {
    (acc[c.parentName] ??= []).push(c);
    return acc;
  }, {});

  if (feedback) {
    return (
      <View className="flex-1 items-center justify-center bg-[#1A3352] px-8">
        <View className="max-w-sm items-center">
          <Text className="mb-6 text-6xl">🌱</Text>
          <Text className="mb-4 text-center text-2xl font-bold leading-relaxed text-white">
            今日は{feedback.todaysPillars}本の柱が{'\n'}あなたを支えました
          </Text>
          {feedback.highlights[0] && feedback.highlights[0].weeklyCount > 1 && (
            <Text className="text-sm text-white/70">
              「{feedback.highlights[0].categoryName}」は今週{feedback.highlights[0].weeklyCount}回目です
            </Text>
          )}
          <Text className="mt-8 text-xs text-white/40">ダッシュボードへ移動します…</Text>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <AppHeader title="何で満たされた？" subtitle="今日の記録" />
      <ScrollView contentContainerClassName="px-4 pb-8 pt-5">
        <Text className="mb-6 text-sm text-muted-foreground">
          今日、心が満たされたものをタップしてください
        </Text>

        <View className="gap-7">
          {Object.entries(grouped).map(([group, cats]) => (
            <View key={group}>
              <Text className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {group}
              </Text>
              <View className="gap-2.5">
                {cats.map((cat) => {
                  const level = levels[cat.id];
                  const isSelected = level !== undefined;
                  return (
                    <View
                      key={cat.id}
                      className={`overflow-hidden rounded-2xl border bg-white shadow-sm ${isSelected ? 'border-accent/30' : 'border-border'}`}
                    >
                      <Pressable
                        onPress={() => toggleCategory(cat.id)}
                        className="flex-row items-center gap-3 p-4"
                      >
                        <View className="h-3 w-3 rounded-full" style={{ backgroundColor: cat.color }} />
                        <Text className={`flex-1 text-sm font-medium ${isSelected ? 'text-foreground' : 'text-muted-foreground'}`}>
                          {cat.name}
                        </Text>
                        <View
                          className={`h-5 w-5 items-center justify-center rounded-full border-2 ${isSelected ? 'border-primary bg-primary' : 'border-slate-300'}`}
                        >
                          {isSelected && <Icon name="check" size={13} color="#FFFFFF" />}
                        </View>
                      </Pressable>

                      {isSelected && (
                        <View className="flex-row gap-2 px-4 pb-4">
                          {LEVELS.map(({ value, label }) => (
                            <Pressable
                              key={value}
                              onPress={() => setLevels((prev) => ({ ...prev, [cat.id]: value }))}
                              className={`flex-1 rounded-xl border py-2 ${level === value ? 'border-primary bg-primary' : 'border-transparent bg-secondary'}`}
                            >
                              <Text
                                className={`text-center text-xs font-semibold ${level === value ? 'text-white' : 'text-muted-foreground'}`}
                              >
                                {label}
                              </Text>
                            </Pressable>
                          ))}
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            </View>
          ))}
        </View>

        <View className="mt-8 overflow-hidden rounded-2xl border border-border bg-white shadow-sm">
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
                    <View
                      key={f.id}
                      className="flex-row items-center gap-2 rounded-xl border border-sky-100 bg-sky-50 px-3 py-2"
                    >
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
              <Text className="text-[11px] leading-relaxed text-muted-foreground">
                揺らぎはポートフォリオの割合には入りません。週間レポートで振り返りに使われます。
              </Text>
            </View>
          )}
        </View>

        <View className="mt-8">
          <Pressable
            onPress={handleSubmit}
            disabled={selectedCount === 0 || saveMutation.isPending}
            className={`rounded-xl bg-accent py-3.5 shadow-lg ${selectedCount === 0 || saveMutation.isPending ? 'opacity-50' : ''}`}
          >
            <Text className="text-center text-sm font-semibold text-white">
              {saveMutation.isPending
                ? '保存中…'
                : selectedCount === 0
                  ? 'カテゴリをタップしてください'
                  : `${selectedCount}件を記録する`}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}
