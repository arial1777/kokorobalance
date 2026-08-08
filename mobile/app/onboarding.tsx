import { useState } from 'react';
import { View, Text, Pressable, ScrollView, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { track } from '@/lib/analytics';
import { todayJST } from '@/lib/utils';
import { registerForPushNotifications } from '@/lib/push-notifications';
import { Icon } from '@/components/ui/icon';
import { KIND_LABEL } from '@/components/pillar-sections';
import { PortfolioPie } from '@/components/charts/portfolio-pie';
import type {
  Category,
  PillarKind,
  Portfolio,
  PresetCategory,
  Profile,
  SaveShakeEventResult,
  ShakeCategory,
  ShakeTemplate,
} from '@/types';

const STEPS = ['柱', '重要度', '揺れ', '通知', '完成'] as const;

type Level = 1 | 2 | 3;

const IMPORTANCE_LEVELS: { value: Level; label: string }[] = [
  { value: 1, label: 'すこし' },
  { value: 2, label: 'まあまあ' },
  { value: 3, label: 'とても' },
];

/** オンボ完了に必要な柱の数（07-spec-pillars.md P-12）。全て習慣でも通す */
const MIN_PILLARS = 2;
const MAX_PILLARS = 30;

const PALETTE = ['#E84393', '#6C5CE7', '#0984E3', '#00B894', '#FDCB6E', '#E17055', '#D63031', '#B2BEC3'];

/** 居場所の候補（§4.1 Step2）。選んだあと自分の言葉でラベルを付け直せる */
const PLACE_CANDIDATES = ['職場', '学校', 'サークル', '推しのコミュニティ', 'お店', 'オンライン'];
/** 推し系は「ファンの人たちとやりとりがあるか」で place / habit を分ける（§2.3、P-A-08） */
const OSHI_CANDIDATE = '推しのコミュニティ';

interface DraftPillar {
  key: string;
  name: string;
  kind: PillarKind;
  color: string;
  parentName: string;
  importance: Level;
  isFragile: boolean;
}

/** 揺れ予報のカテゴリ表示名（05 §4.2）。全23テンプレを一覧で見せず2段で選ばせる */
const SHAKE_CATEGORY_LABELS: Record<ShakeCategory, string> = {
  oshi: '推し',
  work: '仕事',
  relationship: '関係',
  exam: '試験',
  health: '健康',
  money: 'お金',
  life: '人生',
  other: 'その他',
};

const KIND_HELP: Record<PillarKind, string> = {
  place: '継続的に顔を出していて、そこにいると認識されうる集まり',
  relation: '名前やあだ名でどうぞ。ここに書いた名前は誰にも見えません。',
  habit: 'ひとりで完結する活動。柱の本数には数えませんが、大切な支えです',
};

export default function OnboardingPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [step, setStep] = useState(0);
  const [drafts, setDrafts] = useState<DraftPillar[]>([]);
  const [activeKind, setActiveKind] = useState<PillarKind>('place');
  const [labelInput, setLabelInput] = useState('');
  const [oshiAsking, setOshiAsking] = useState(false);

  // Step 3: 揺れそうな日（05 §4.4）
  const [shakeCategory, setShakeCategory] = useState<ShakeCategory | null>(null);
  const [shakeTemplate, setShakeTemplate] = useState<ShakeTemplate | null>(null);
  const [shakeDate, setShakeDate] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [shakeRegistered, setShakeRegistered] = useState<string | null>(null);
  // 「いまは思いつかない」を選んだ人に、揺れやすい柱から1問だけ逆算して聞く（§4.6）
  const [fragileAsking, setFragileAsking] = useState(false);
  // Step 4: 通知許可（04 §4.3）。OSダイアログの前にプレプロンプトを挟む
  const [pushRequesting, setPushRequesting] = useState(false);

  const { data: presets = [] } = useQuery<PresetCategory[]>({
    queryKey: ['presets'],
    queryFn: () => api.get<PresetCategory[]>('/categories/presets'),
    enabled: step === 1,
  });

  const bulkCreateMutation = useMutation({
    mutationFn: () =>
      api.post<Category[]>('/categories/bulk-create', {
        pillars: drafts.map((d) => ({
          name: d.name,
          parentName: d.parentName,
          color: d.color,
          kind: d.kind,
          importance: d.importance,
          isFragile: d.isFragile,
        })),
      }),
    onSuccess: (categories) => {
      // 重要度を初期ポートフォリオの重みとして引き継ぐ（既存のブレンド機構をそのまま使う）
      const levelByName = new Map(drafts.map((d) => [d.name, d.importance]));
      baselineMutation.mutate(
        categories.map((c) => ({ categoryId: c.id, level: levelByName.get(c.name) ?? 2 })),
      );
    },
  });

  const baselineMutation = useMutation({
    mutationFn: (items: { categoryId: string; level: number }[]) =>
      api.post('/onboarding/baseline', { items }),
    onSuccess: () => setStep(3),
  });

  const { data: shakeTemplates = [] } = useQuery<ShakeTemplate[]>({
    queryKey: ['shake-templates'],
    queryFn: () => api.get<ShakeTemplate[]>('/shake/templates'),
    enabled: step === 3,
  });

  // 揺れの大きさはテンプレの既定値を使う。オンボでは3タップ+日付で終わらせる（05 S-01）
  const createShakeMutation = useMutation({
    mutationFn: (template: ShakeTemplate) =>
      api.post<SaveShakeEventResult>('/shake/events', {
        templateKey: template.templateKey,
        eventDate: shakeDate || todayJST(),
        isDateCertain: !!shakeDate,
        expectedShake: template.defaultExpectedShake,
      }),
    onSuccess: (result) => {
      setShakeRegistered(result.event.title);
      setStep(4);
    },
  });

  const { data: portfolio } = useQuery<Portfolio>({
    queryKey: ['portfolio', 'onboarding'],
    queryFn: () => api.get<Portfolio>('/portfolio?period=30'),
    enabled: step === 5,
  });

  const onboardingMutation = useMutation({
    mutationFn: () => api.patch<Profile>('/profile/onboarding'),
    onSuccess: (profile) => {
      track('onboarding_completed');
      qc.setQueryData(['profile'], profile);
      router.replace('/dashboard');
    },
  });

  function addDraft(name: string, kind: PillarKind, color?: string, parentName?: string) {
    const trimmed = name.trim().slice(0, 20);
    if (!trimmed) return;
    if (drafts.length >= MAX_PILLARS) return;
    if (drafts.some((d) => d.name === trimmed && d.kind === kind)) return;
    setDrafts((prev) => [
      ...prev,
      {
        key: `${kind}-${trimmed}-${Date.now()}`,
        name: trimmed,
        kind,
        color: color ?? PALETTE[prev.length % PALETTE.length],
        parentName: parentName ?? KIND_LABEL[kind],
        importance: 2,
        isFragile: false,
      },
    ]);
    setLabelInput('');
  }

  const habitPresets = presets.filter((p) => p.kind === 'habit');
  const socialCount = drafts.filter((d) => d.kind !== 'habit').length;
  /** 「揺れたらしんどい」と印を付けた柱。§4.6 の逆算の問いに使う */
  const fragilePillarName = drafts.find((d) => d.isFragile)?.name ?? null;

  /**
   * プレプロンプトで納得してもらってからOSの許可ダイアログを出す（04 §4.3）。
   * 拒否されてもエラーにしない。バックエンドがメールにフォールバックする（§4.4）
   */
  async function requestPushThenContinue() {
    setPushRequesting(true);
    try {
      await registerForPushNotifications();
    } finally {
      setPushRequesting(false);
      setStep(5);
    }
  }

  if (step === 0) {
    return (
      <View className="flex-1 bg-[#1A3352]">
        <ScrollView contentContainerClassName="flex-grow px-6 pb-8 pt-16" className="max-w-lg self-center">
          <View className="mb-10">
            <View className="mb-6 h-16 w-16 items-center justify-center rounded-2xl bg-white/15">
              <Icon name="donut_large" filled color="#FFFFFF" size={32} />
            </View>
            <Text className="mb-3 text-3xl font-bold leading-tight text-white">
              ようこそ、{'\n'}ココロバランスへ
            </Text>
            <Text className="text-sm leading-relaxed text-white/60">
              支えは、数より、確かさ。{'\n'}あなたを支えているものを教えてください。
            </Text>
          </View>

          <View className="gap-3">
            {[
              { icon: 'diversity_3', title: '居場所と相手', desc: '人とのつながりが、いちばん確かな支えになります' },
              { icon: 'thunderstorm', title: '揺れそうな日に備える', desc: 'つらくなりそうな日の前に、支えを厚くしておく' },
              { icon: 'smart_toy', title: '壁打ち', desc: '考えを整理したいとき、そばで話を聞く相手' },
            ].map(({ icon, title, desc }) => (
              <View key={title} className="flex-row items-start gap-4 rounded-2xl bg-white/10 p-4">
                <View className="h-10 w-10 items-center justify-center rounded-xl bg-white/10">
                  <Icon name={icon} filled color="#FFFFFF" size={22} />
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-semibold text-white">{title}</Text>
                  <Text className="mt-0.5 text-xs leading-relaxed text-white/60">{desc}</Text>
                </View>
              </View>
            ))}
          </View>

          <Pressable onPress={() => setStep(1)} className="mt-10 rounded-xl bg-[#E05A3A] py-4 shadow-lg">
            <Text className="text-center text-sm font-semibold text-white">はじめる</Text>
          </Pressable>
          <Text className="mt-4 text-center text-[11px] leading-relaxed text-white/40">
            本アプリは医療・診断を目的としたものではありません
          </Text>
        </ScrollView>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="px-4 pb-10 pt-8">
      <View className="mb-8 flex-row items-center gap-2">
        {STEPS.map((label, i) => {
          const stepIndex = i + 1;
          return (
            <View key={label} className="flex-1 flex-row items-center gap-2">
              <View
                className={`h-6 w-6 items-center justify-center rounded-full ${stepIndex <= step ? 'bg-primary' : 'bg-secondary'}`}
              >
                {stepIndex < step ? (
                  <Icon name="check" size={13} color="#FFFFFF" />
                ) : (
                  <Text className={`text-xs font-bold ${stepIndex <= step ? 'text-white' : 'text-muted-foreground'}`}>
                    {i + 1}
                  </Text>
                )}
              </View>
              {i < STEPS.length - 1 && (
                <View className={`h-0.5 flex-1 rounded-full ${stepIndex < step ? 'bg-primary' : 'bg-secondary'}`} />
              )}
            </View>
          );
        })}
      </View>

      {/* Step 1: 柱の登録（型ファースト） */}
      {step === 1 && (
        <View>
          <View className="mb-6">
            <Text className="mb-1 text-xl font-bold text-foreground">いま、あなたを支えているものは？</Text>
            <Text className="text-sm leading-relaxed text-muted-foreground">
              2つ以上で先に進めます。あとからいつでも増やせます。
            </Text>
          </View>

          <View className="mb-4 flex-row gap-1.5">
            {(['place', 'relation', 'habit'] as PillarKind[]).map((k) => (
              <Pressable
                key={k}
                onPress={() => {
                  setActiveKind(k);
                  setLabelInput('');
                  setOshiAsking(false);
                }}
                className={`flex-1 items-center rounded-xl border-2 py-2.5 ${
                  activeKind === k ? 'border-primary bg-primary' : 'border-border bg-white'
                }`}
              >
                <Text className={`text-sm font-semibold ${activeKind === k ? 'text-white' : 'text-muted-foreground'}`}>
                  {KIND_LABEL[k]}
                </Text>
              </Pressable>
            ))}
          </View>
          <Text className="mb-4 text-xs leading-relaxed text-muted-foreground">{KIND_HELP[activeKind]}</Text>

          {/* 推しの1問（§2.3） */}
          {oshiAsking ? (
            <View className="mb-4 gap-2 rounded-2xl border border-border bg-white p-4 shadow-sm">
              <Text className="text-sm text-foreground">推しのコミュニティ について</Text>
              <Text className="mb-1 text-xs leading-relaxed text-muted-foreground">
                そのファンの人たちと、やりとりはありますか？
              </Text>
              <Pressable
                onPress={() => {
                  addDraft('推し界', 'place');
                  setOshiAsking(false);
                }}
                className="items-center rounded-xl bg-primary py-2.5"
              >
                <Text className="text-xs font-semibold text-white">ある</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  addDraft('推し', 'habit');
                  setOshiAsking(false);
                }}
                className="items-center rounded-xl border border-border py-2.5"
              >
                <Text className="text-xs font-semibold text-muted-foreground">ひとりで追っている</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  addDraft('推し', 'habit');
                  setOshiAsking(false);
                }}
                className="items-center py-2"
              >
                <Text className="text-xs text-muted-foreground">こたえない</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <View className="mb-3 flex-row flex-wrap gap-2">
                {activeKind === 'place' &&
                  PLACE_CANDIDATES.map((c) => (
                    <Pressable
                      key={c}
                      onPress={() => {
                        if (c === OSHI_CANDIDATE) {
                          setOshiAsking(true);
                          return;
                        }
                        setLabelInput(c);
                      }}
                      className="rounded-full border-2 border-border bg-white px-3.5 py-2"
                    >
                      <Text className="text-sm font-medium text-foreground">{c}</Text>
                    </Pressable>
                  ))}
                {activeKind === 'habit' &&
                  habitPresets.map((p) => (
                    <Pressable
                      key={p.id}
                      onPress={() => addDraft(p.name, 'habit', p.color, p.parentName)}
                      className="flex-row items-center gap-1.5 rounded-full border-2 border-border bg-white px-3.5 py-2"
                    >
                      <View className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: p.color }} />
                      <Text className="text-sm font-medium text-foreground">{p.name}</Text>
                    </Pressable>
                  ))}
              </View>

              {/* 自分の言葉でラベルを付ける（P-10） */}
              <View className="mb-6 flex-row gap-2">
                <TextInput
                  value={labelInput}
                  onChangeText={setLabelInput}
                  maxLength={20}
                  placeholder={
                    activeKind === 'relation'
                      ? '名前やあだ名でどうぞ'
                      : activeKind === 'place'
                        ? '例: 木曜のバンド'
                        : '例: 朝の散歩'
                  }
                  placeholderTextColor="#6B584880"
                  className="flex-1 rounded-xl border border-border px-3 py-2.5 text-sm text-foreground"
                />
                <Pressable
                  onPress={() => addDraft(labelInput, activeKind)}
                  disabled={!labelInput.trim()}
                  className={`rounded-xl bg-accent px-5 py-2.5 ${!labelInput.trim() ? 'opacity-40' : ''}`}
                >
                  <Text className="text-sm font-semibold text-white">追加</Text>
                </Pressable>
              </View>
            </>
          )}

          {drafts.length > 0 && (
            <View className="mb-6 gap-2">
              {drafts.map((d) => (
                <View
                  key={d.key}
                  className="flex-row items-center gap-3 rounded-xl border border-border bg-white px-4 py-3 shadow-sm"
                >
                  <View className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                  <Text className="flex-1 text-sm text-foreground" numberOfLines={1}>
                    {d.name}
                  </Text>
                  <Text className="text-[10px] text-muted-foreground">{KIND_LABEL[d.kind]}</Text>
                  <Pressable onPress={() => setDrafts((prev) => prev.filter((x) => x.key !== d.key))}>
                    <Icon name="close" size={16} color="#6B5848" />
                  </Pressable>
                </View>
              ))}
            </View>
          )}

          {/* 社会的な柱の推奨（強制しない → P-12） */}
          {drafts.length >= MIN_PILLARS && socialCount === 0 && (
            <Text className="mb-4 text-xs leading-relaxed text-muted-foreground">
              人や居場所の柱があると、揺れた日に頼れる先が増えます。あとからでも大丈夫です。
            </Text>
          )}

          <Pressable
            onPress={() => setStep(2)}
            disabled={drafts.length < MIN_PILLARS}
            className={`rounded-xl bg-accent py-3.5 shadow-lg ${drafts.length < MIN_PILLARS ? 'opacity-50' : ''}`}
          >
            <Text className="text-center text-sm font-semibold text-white">
              {drafts.length < MIN_PILLARS ? `あと${MIN_PILLARS - drafts.length}つ選んでください` : '次へ'}
            </Text>
          </Pressable>
        </View>
      )}

      {/* Step 2: 重要度と「揺れやすい柱」 */}
      {step === 2 && (
        <View>
          <View className="mb-6">
            <Text className="mb-1 text-xl font-bold text-foreground">どれくらい大切ですか？</Text>
            <Text className="text-sm leading-relaxed text-muted-foreground">
              揺れたらしんどいと思うものには、印をつけておけます。
            </Text>
          </View>

          <View className="gap-3">
            {drafts.map((d) => (
              <View key={d.key} className="rounded-2xl border border-border bg-white p-4 shadow-sm">
                <View className="mb-3 flex-row items-center gap-2.5">
                  <View className="h-3 w-3 rounded-full" style={{ backgroundColor: d.color }} />
                  <Text className="flex-1 text-sm font-medium text-foreground" numberOfLines={1}>
                    {d.name}
                  </Text>
                  <Text className="text-[10px] text-muted-foreground">{KIND_LABEL[d.kind]}</Text>
                </View>
                <View className="mb-3 flex-row gap-2">
                  {IMPORTANCE_LEVELS.map(({ value, label }) => (
                    <Pressable
                      key={value}
                      onPress={() =>
                        setDrafts((prev) => prev.map((x) => (x.key === d.key ? { ...x, importance: value } : x)))
                      }
                      className={`flex-1 items-center rounded-xl border py-2 ${
                        d.importance === value ? 'border-primary bg-primary' : 'border-transparent bg-secondary'
                      }`}
                    >
                      <Text
                        className={`text-xs font-semibold ${d.importance === value ? 'text-white' : 'text-muted-foreground'}`}
                      >
                        {label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <Pressable
                  onPress={() =>
                    setDrafts((prev) => prev.map((x) => (x.key === d.key ? { ...x, isFragile: !x.isFragile } : x)))
                  }
                >
                  <Text className={`text-xs font-medium ${d.isFragile ? 'text-accent' : 'text-muted-foreground'}`}>
                    {d.isFragile ? '✓ 揺れたらしんどい' : '揺れたらしんどい？'}
                  </Text>
                </Pressable>
              </View>
            ))}
          </View>

          <Pressable
            onPress={() => bulkCreateMutation.mutate()}
            disabled={bulkCreateMutation.isPending || baselineMutation.isPending}
            className={`mt-8 rounded-xl bg-accent py-3.5 shadow-lg ${
              bulkCreateMutation.isPending || baselineMutation.isPending ? 'opacity-50' : ''
            }`}
          >
            <Text className="text-center text-sm font-semibold text-white">
              {bulkCreateMutation.isPending || baselineMutation.isPending ? '保存中…' : 'できあがりを見る'}
            </Text>
          </Pressable>
        </View>
      )}

      {/* Step 3: 揺れそうな日（05 §4.4）。原則4により、空の状態でホームに送らない */}
      {step === 3 && (
        <View>
          <View className="mb-6">
            <Text className="mb-1 text-xl font-bold text-foreground">この先、心が揺れそうな日はありますか？</Text>
            <Text className="text-sm leading-relaxed text-muted-foreground">
              日付がわかっている予定があれば、その日までに支えを厚くしておけます。
            </Text>
          </View>

          {fragileAsking ? (
            /* §4.6 柱から逆算して1問だけ聞く。答えなくても先に進める */
            <View className="gap-2 rounded-2xl border border-border bg-white p-4 shadow-sm">
              <Text className="mb-1 text-sm leading-relaxed text-foreground">
                「{fragilePillarName}」に、この先なにか予定はありますか？
              </Text>
              <Pressable onPress={() => setFragileAsking(false)} className="items-center rounded-xl bg-primary py-2.5">
                <Text className="text-xs font-semibold text-white">ある — 登録する</Text>
              </Pressable>
              <Pressable onPress={() => setStep(4)} className="items-center rounded-xl border border-border py-2.5">
                <Text className="text-xs font-semibold text-muted-foreground">いまは思いつかない</Text>
              </Pressable>
            </View>
          ) : !shakeCategory ? (
            <View className="flex-row flex-wrap gap-2">
              {(Object.keys(SHAKE_CATEGORY_LABELS) as ShakeCategory[]).map((c) => (
                <Pressable
                  key={c}
                  onPress={() => setShakeCategory(c)}
                  className="w-[48%] items-center rounded-xl border border-border bg-white py-3"
                >
                  <Text className="text-sm font-medium text-foreground">{SHAKE_CATEGORY_LABELS[c]}</Text>
                </Pressable>
              ))}
            </View>
          ) : !shakeTemplate ? (
            <View className="gap-2">
              <Pressable onPress={() => setShakeCategory(null)}>
                <Text className="text-xs text-accent">← 種類を選び直す</Text>
              </Pressable>
              {shakeTemplates
                .filter((t) => t.category === shakeCategory)
                .map((t) => (
                  <Pressable
                    key={t.id}
                    onPress={() => setShakeTemplate(t)}
                    className="rounded-xl border border-border bg-white px-4 py-3"
                  >
                    <Text className="text-sm font-medium text-foreground">{t.label}</Text>
                  </Pressable>
                ))}
            </View>
          ) : (
            <View className="gap-4">
              <Pressable onPress={() => setShakeTemplate(null)}>
                <Text className="text-xs text-accent">← 選び直す</Text>
              </Pressable>
              <View className="rounded-2xl border border-border bg-white p-4 shadow-sm">
                <Text className="mb-3 text-sm font-semibold text-foreground">{shakeTemplate.label}</Text>
                <Text className="mb-2 text-xs text-muted-foreground">いつですか？</Text>
                <Pressable
                  onPress={() => setShowDatePicker(true)}
                  className="rounded-xl border border-border px-3 py-2.5"
                >
                  <Text className="text-sm text-foreground">{shakeDate || '日付を選ぶ'}</Text>
                </Pressable>
                {showDatePicker && (
                  <DateTimePicker
                    value={shakeDate ? new Date(`${shakeDate}T00:00:00`) : new Date()}
                    mode="date"
                    minimumDate={new Date()}
                    onChange={(_event, date) => {
                      setShowDatePicker(false);
                      if (date) setShakeDate(date.toISOString().split('T')[0]);
                    }}
                  />
                )}
                <Text className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                  選ばなくても登録できます（日付未定として扱います）
                </Text>
              </View>
              <Pressable
                onPress={() => createShakeMutation.mutate(shakeTemplate)}
                disabled={createShakeMutation.isPending}
                className={`rounded-xl bg-accent py-3.5 shadow-lg ${createShakeMutation.isPending ? 'opacity-50' : ''}`}
              >
                <Text className="text-center text-sm font-semibold text-white">
                  {createShakeMutation.isPending ? '登録中…' : '登録する'}
                </Text>
              </Pressable>
            </View>
          )}

          {!fragileAsking && (
            <Pressable
              onPress={() => {
                // 揺れやすい柱があれば1問だけ逆算して聞く（§4.6）。無ければそのまま進む
                if (fragilePillarName) setFragileAsking(true);
                else setStep(4);
              }}
              className="mt-6 items-center py-2.5"
            >
              <Text className="text-xs text-muted-foreground">いまは思いつかない</Text>
            </Pressable>
          )}
        </View>
      )}

      {/* Step 4: 通知許可のプレプロンプト（04 §4.3）。初回起動時には要求しない */}
      {step === 4 && (
        <View>
          <View className="mb-6">
            <Text className="mb-1 text-xl font-bold text-foreground">
              {shakeRegistered ? `「${shakeRegistered}」が近づいたらお知らせします` : '揺れそうな日が近づいたらお知らせします'}
            </Text>
            <Text className="text-sm leading-relaxed text-muted-foreground">
              前日と当日に、備えのヒントを届けます。週次の点検のリマインドにも使います。
            </Text>
          </View>

          <View className="mb-6 gap-3 rounded-2xl border border-border bg-white p-4 shadow-sm">
            {[
              { icon: 'thunderstorm', text: '揺れそうな日の前日と当日' },
              { icon: 'refresh', text: '週に1回の点検のリマインド' },
            ].map(({ icon, text }) => (
              <View key={text} className="flex-row items-center gap-3">
                <Icon name={icon} size={18} color="#6B5848" />
                <Text className="flex-1 text-sm text-foreground">{text}</Text>
              </View>
            ))}
          </View>

          <Pressable
            onPress={requestPushThenContinue}
            disabled={pushRequesting}
            className={`rounded-xl bg-accent py-3.5 shadow-lg ${pushRequesting ? 'opacity-50' : ''}`}
          >
            <Text className="text-center text-sm font-semibold text-white">
              {pushRequesting ? '確認中…' : '通知を許可する'}
            </Text>
          </Pressable>
          {/* 拒否してもメールにフォールバックする（§4.4）。あとから設定画面で有効化できる */}
          <Pressable onPress={() => setStep(5)} className="mt-3 items-center py-2.5">
            <Text className="text-xs text-muted-foreground">あとで（メールでお知らせします）</Text>
          </Pressable>
        </View>
      )}

      {/* Step 5: 初期ポートフォリオ */}
      {step === 5 && (
        <View>
          <View className="mb-6 items-center">
            <Text className="mb-2 text-center text-xl font-bold text-foreground">
              これがいまの、{'\n'}あなたの支えの形です
            </Text>
            <Text className="text-center text-sm leading-relaxed text-muted-foreground">
              毎週の点検で、すこしずつ実際のデータに置き換わっていきます
            </Text>
          </View>

          {shakeRegistered && (
            <Text className="mb-4 text-center text-sm leading-relaxed text-muted-foreground">
              「{shakeRegistered}」の日に向けて、備えを用意しておきます。
            </Text>
          )}

          <View className="rounded-2xl border border-border bg-white p-5 shadow-sm">
            {portfolio ? (
              <PortfolioPie breakdown={portfolio.breakdown} />
            ) : (
              <View className="h-40 items-center justify-center">
                <Text className="text-sm text-muted-foreground">読み込み中…</Text>
              </View>
            )}
          </View>

          <Pressable
            onPress={() => onboardingMutation.mutate()}
            disabled={onboardingMutation.isPending}
            className={`mt-8 rounded-xl bg-accent py-3.5 shadow-lg ${onboardingMutation.isPending ? 'opacity-50' : ''}`}
          >
            <Text className="text-center text-sm font-semibold text-white">
              {onboardingMutation.isPending ? 'はじめています…' : 'ホームへ'}
            </Text>
          </Pressable>
        </View>
      )}
    </ScrollView>
  );
}
