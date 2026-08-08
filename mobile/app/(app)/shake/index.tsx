import { useState } from 'react';
import { View, Text, Pressable, ScrollView, TextInput, Modal, Switch } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import DateTimePicker from '@react-native-community/datetimepicker';
import { api } from '@/lib/api';
import { todayJST } from '@/lib/utils';
import { Icon } from '@/components/ui/icon';
import { AppHeader } from '@/components/ui/app-header';
import { SafetyResourceCard } from '@/components/safety-resource-card';
import type { Category, HotlineView, SaveShakeEventResult, ShakeCategory, ShakeEvent, ShakeTemplate } from '@/types';

const CATEGORY_LABELS: Record<ShakeCategory, string> = {
  oshi: '推し',
  work: '仕事',
  relationship: '関係',
  exam: '試験',
  health: '健康',
  money: 'お金',
  life: '人生',
  other: 'その他',
};

const STATUS_LABELS: Record<ShakeEvent['status'], string> = {
  planned: '準備前',
  prepping: '備え中',
  today: '今日',
  passed: 'ふりかえり待ち',
  archived: '完了',
};

const SHAKE_LABELS = ['少し', 'けっこう', 'かなり'];

export default function ShakeListScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const [wizardOpen, setWizardOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [category, setCategory] = useState<ShakeCategory | null>(null);
  const [template, setTemplate] = useState<ShakeTemplate | null>(null);
  const [customTitle, setCustomTitle] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isDateCertain, setIsDateCertain] = useState(true);
  const [expectedShake, setExpectedShake] = useState<number | null>(null);
  const [affectedCategoryIds, setAffectedCategoryIds] = useState<string[]>([]);
  const [safetyPrompt, setSafetyPrompt] = useState<{ eventId: string; hotlines: HotlineView[] } | null>(null);

  const { data: events = [], isLoading } = useQuery<ShakeEvent[]>({
    queryKey: ['shake-events'],
    queryFn: () => api.get<ShakeEvent[]>('/shake/events'),
  });

  const { data: templates = [] } = useQuery<ShakeTemplate[]>({
    queryKey: ['shake-templates'],
    queryFn: () => api.get<ShakeTemplate[]>('/shake/templates'),
    enabled: wizardOpen,
  });

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ['categories'],
    queryFn: () => api.get<Category[]>('/categories'),
    select: (cats) => cats.filter((c) => c.isActive),
    enabled: wizardOpen,
  });

  const createMutation = useMutation({
    mutationFn: () =>
      api.post<SaveShakeEventResult>('/shake/events', {
        templateKey: template?.templateKey,
        title: template ? undefined : customTitle,
        category: template ? undefined : category,
        eventDate: isDateCertain ? eventDate : todayJST(),
        isDateCertain,
        expectedShake,
        affectedCategoryIds: affectedCategoryIds.length ? affectedCategoryIds : undefined,
      }),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ['shake-events'] });
      if (result.safetyVerdict !== 'clear' && result.hotlines.length > 0) {
        setSafetyPrompt({ eventId: result.event.id, hotlines: result.hotlines });
      } else {
        resetWizard();
        router.push(`/shake/${result.event.id}`);
      }
    },
  });

  function resetWizard() {
    setWizardOpen(false);
    setStep(1);
    setCategory(null);
    setTemplate(null);
    setCustomTitle('');
    setEventDate('');
    setIsDateCertain(true);
    setExpectedShake(null);
    setAffectedCategoryIds([]);
  }

  const activeEvents = events.filter((e) => e.status !== 'archived');
  const archivedEvents = events.filter((e) => e.status === 'archived');
  const templatesByCategory = templates.reduce<Record<string, ShakeTemplate[]>>((acc, t) => {
    (acc[t.category] ??= []).push(t);
    return acc;
  }, {});

  function daysUntilLabel(date: string): string {
    const diff = Math.round((new Date(`${date}T00:00:00`).getTime() - new Date(`${todayJST()}T00:00:00`).getTime()) / 86400000);
    if (diff === 0) return '今日';
    if (diff > 0) return `あと${diff}日`;
    return `${-diff}日前`;
  }

  return (
    <View className="flex-1 bg-background">
      <AppHeader title="揺れ予報" subtitle="心が揺れそうな日への備え" />
      <ScrollView contentContainerClassName="px-4 pt-5 pb-24 gap-5">
        <Pressable
          onPress={() => setWizardOpen(true)}
          className="flex-row items-center justify-center gap-2 py-3.5 rounded-xl bg-accent shadow-sm"
        >
          <Icon name="add" size={18} color="#FFFFFF" />
          <Text className="text-white font-semibold text-sm">揺れそうな日を追加</Text>
        </Pressable>

        {isLoading && <Text className="text-center text-sm text-muted-foreground">読み込み中...</Text>}

        {!isLoading && activeEvents.length === 0 && (
          <View className="items-center mt-8">
            <Icon name="thunderstorm" size={40} color="#6B584866" />
            <Text className="text-sm text-muted-foreground mt-2 text-center leading-relaxed">
              いまは穏やかそうです。{'\n'}この先、心が揺れそうな日があれば登録してみてください。
            </Text>
          </View>
        )}

        <View className="gap-2.5">
          {activeEvents.map((e) => (
            <Pressable
              key={e.id}
              onPress={() => router.push(`/shake/${e.id}`)}
              className="flex-row items-center gap-3 bg-white rounded-2xl border border-border shadow-sm p-4"
            >
              <View className="flex-1">
                <Text className="font-semibold text-sm text-foreground" numberOfLines={1}>
                  {e.title}
                </Text>
                <Text className="text-xs text-muted-foreground mt-0.5">
                  {e.isDateCertain ? daysUntilLabel(e.eventDate) : '日付未定'} ・ {STATUS_LABELS[e.status]}
                </Text>
              </View>
              <Icon name="chevron_right" size={18} color="#6B5848" />
            </Pressable>
          ))}
        </View>

        {archivedEvents.length > 0 && (
          <View>
            <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">完了した揺れ</Text>
            <View className="gap-2">
              {archivedEvents.map((e) => (
                <Pressable
                  key={e.id}
                  onPress={() => router.push(`/shake/${e.id}`)}
                  className="bg-secondary/50 rounded-xl px-4 py-2.5"
                >
                  <Text className="text-xs text-muted-foreground">{e.title}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      <Modal visible={wizardOpen} transparent animationType="slide">
        <View className="flex-1 justify-end bg-black/40">
          <View className="bg-white rounded-t-2xl max-h-[85%] p-6">
            <ScrollView>
              {!safetyPrompt ? (
                <>
                  {step === 1 && (
                    <View className="gap-4">
                      <Text className="text-lg font-bold text-foreground">どんな日？</Text>
                      {!category ? (
                        <View className="flex-row flex-wrap gap-2">
                          {(Object.keys(CATEGORY_LABELS) as ShakeCategory[]).map((c) => (
                            <Pressable
                              key={c}
                              onPress={() => setCategory(c)}
                              className="w-[48%] py-3 rounded-xl border border-border items-center"
                            >
                              <Text className="text-sm font-medium text-foreground">{CATEGORY_LABELS[c]}</Text>
                            </Pressable>
                          ))}
                        </View>
                      ) : (
                        <View className="gap-2">
                          <Pressable onPress={() => setCategory(null)}>
                            <Text className="text-xs text-accent">← カテゴリを選び直す</Text>
                          </Pressable>
                          {(templatesByCategory[category] ?? []).map((t) => (
                            <Pressable
                              key={t.id}
                              onPress={() => {
                                setTemplate(t);
                                setExpectedShake(t.defaultExpectedShake);
                                setStep(2);
                              }}
                              className="py-3 px-4 rounded-xl border border-border"
                            >
                              <Text className="text-sm font-medium text-foreground">
                                {t.templateKey === 'custom' ? 'その他（自分で書く）' : t.label}
                              </Text>
                            </Pressable>
                          ))}
                          {category === 'other' && (
                            <View className="gap-2 pt-2">
                              <TextInput
                                value={customTitle}
                                onChangeText={setCustomTitle}
                                maxLength={60}
                                placeholder="どんな日か、短く書いてください"
                                className="px-3 py-2.5 rounded-xl border border-border text-sm text-foreground"
                              />
                              <Pressable
                                disabled={!customTitle.trim()}
                                onPress={() => {
                                  setTemplate(null);
                                  setExpectedShake(2);
                                  setStep(2);
                                }}
                                className={`py-2.5 rounded-xl bg-accent items-center ${!customTitle.trim() ? 'opacity-40' : ''}`}
                              >
                                <Text className="text-white text-sm font-semibold">次へ</Text>
                              </Pressable>
                            </View>
                          )}
                        </View>
                      )}
                    </View>
                  )}

                  {step === 2 && (
                    <View className="gap-4">
                      <Text className="text-lg font-bold text-foreground">いつ？</Text>
                      <View className="flex-row items-center gap-2">
                        <Switch value={!isDateCertain} onValueChange={(v) => setIsDateCertain(!v)} />
                        <Text className="text-sm text-muted-foreground">まだわからない</Text>
                      </View>
                      {isDateCertain && (
                        <>
                          <Pressable
                            onPress={() => setShowDatePicker(true)}
                            className="px-3 py-2.5 rounded-xl border border-border"
                          >
                            <Text className="text-sm text-foreground">{eventDate || '日付を選ぶ'}</Text>
                          </Pressable>
                          {showDatePicker && (
                            <DateTimePicker
                              value={eventDate ? new Date(`${eventDate}T00:00:00`) : new Date()}
                              mode="date"
                              minimumDate={new Date()}
                              onChange={(_event, date) => {
                                setShowDatePicker(false);
                                if (date) setEventDate(date.toISOString().split('T')[0]);
                              }}
                            />
                          )}
                        </>
                      )}
                      <View className="flex-row gap-2">
                        <Pressable onPress={() => setStep(1)} className="flex-1 py-2.5 rounded-xl border border-border items-center">
                          <Text className="text-sm font-semibold text-muted-foreground">戻る</Text>
                        </Pressable>
                        <Pressable
                          disabled={isDateCertain && !eventDate}
                          onPress={() => setStep(3)}
                          className={`flex-1 py-2.5 rounded-xl bg-accent items-center ${isDateCertain && !eventDate ? 'opacity-40' : ''}`}
                        >
                          <Text className="text-white text-sm font-semibold">次へ</Text>
                        </Pressable>
                      </View>
                    </View>
                  )}

                  {step === 3 && (
                    <View className="gap-4">
                      <Text className="text-lg font-bold text-foreground">どのくらい揺れそう？</Text>
                      <View className="flex-row gap-2">
                        {SHAKE_LABELS.map((label, i) => (
                          <Pressable
                            key={label}
                            onPress={() => setExpectedShake(i + 1)}
                            className={`flex-1 py-3 rounded-xl border items-center ${
                              expectedShake === i + 1 ? 'bg-primary border-primary' : 'border-border'
                            }`}
                          >
                            <Text className={`text-sm font-semibold ${expectedShake === i + 1 ? 'text-white' : 'text-muted-foreground'}`}>
                              {label}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                      <View className="flex-row gap-2">
                        <Pressable onPress={() => setStep(2)} className="flex-1 py-2.5 rounded-xl border border-border items-center">
                          <Text className="text-sm font-semibold text-muted-foreground">戻る</Text>
                        </Pressable>
                        <Pressable
                          disabled={!expectedShake}
                          onPress={() => setStep(4)}
                          className={`flex-1 py-2.5 rounded-xl bg-accent items-center ${!expectedShake ? 'opacity-40' : ''}`}
                        >
                          <Text className="text-white text-sm font-semibold">次へ</Text>
                        </Pressable>
                      </View>
                    </View>
                  )}

                  {step === 4 && (
                    <View className="gap-4">
                      <Text className="text-lg font-bold text-foreground">揺れるかもしれない柱（任意）</Text>
                      <Text className="text-xs text-muted-foreground">選ばなくても大丈夫です</Text>
                      <View className="flex-row flex-wrap gap-1.5">
                        {categories.map((c) => (
                          <Pressable
                            key={c.id}
                            onPress={() =>
                              setAffectedCategoryIds((prev) =>
                                prev.includes(c.id) ? prev.filter((id) => id !== c.id) : [...prev, c.id],
                              )
                            }
                            style={affectedCategoryIds.includes(c.id) ? { backgroundColor: c.color, borderColor: c.color } : undefined}
                            className={`rounded-full border px-3 py-1.5 ${affectedCategoryIds.includes(c.id) ? '' : 'border-border bg-white'}`}
                          >
                            <Text className={`text-xs font-medium ${affectedCategoryIds.includes(c.id) ? 'text-white' : 'text-muted-foreground'}`}>
                              {c.name}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                      <View className="flex-row gap-2">
                        <Pressable onPress={() => setStep(3)} className="flex-1 py-2.5 rounded-xl border border-border items-center">
                          <Text className="text-sm font-semibold text-muted-foreground">戻る</Text>
                        </Pressable>
                        <Pressable
                          disabled={createMutation.isPending}
                          onPress={() => createMutation.mutate()}
                          className={`flex-1 py-2.5 rounded-xl bg-accent items-center ${createMutation.isPending ? 'opacity-40' : ''}`}
                        >
                          <Text className="text-white text-sm font-semibold">{createMutation.isPending ? '登録中…' : '登録する'}</Text>
                        </Pressable>
                      </View>
                    </View>
                  )}

                  <Pressable onPress={resetWizard} className="mt-4">
                    <Text className="text-center text-xs text-muted-foreground">やめる</Text>
                  </Pressable>
                </>
              ) : (
                <View className="gap-4">
                  <SafetyResourceCard variant="block" hotlines={safetyPrompt.hotlines} />
                  <Pressable
                    onPress={() => {
                      const id = safetyPrompt.eventId;
                      resetWizard();
                      router.push(`/shake/${id}`);
                    }}
                    className="py-2.5 rounded-xl bg-secondary items-center"
                  >
                    <Text className="text-sm font-semibold text-foreground">閉じる</Text>
                  </Pressable>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}
