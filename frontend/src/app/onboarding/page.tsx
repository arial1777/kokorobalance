'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { track } from '@/lib/analytics';
import { clearLpDiagnosis, loadLpDiagnosis } from '@/lib/lp-diagnosis';
import { Icon } from '@/components/ui/icon';
import { KIND_LABEL } from '@/components/pillar-sections';
import { PortfolioPie } from '@/components/charts/portfolio-pie';
import { todayJST } from '@/lib/utils';
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

const STEPS = ['柱', '重要度', '揺れ', '完成'] as const;

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
  // step 0: ようこそ / 1: 柱の登録 / 2: 重要度 / 3: 揺れそうな日 / 4: ポートフォリオ完成
  const [step, setStep] = useState(0);
  const [drafts, setDrafts] = useState<DraftPillar[]>([]);
  const [activeKind, setActiveKind] = useState<PillarKind>('place');
  const [labelInput, setLabelInput] = useState('');
  const [oshiAsking, setOshiAsking] = useState(false);
  const [savedCategories, setSavedCategories] = useState<Category[]>([]);

  // Step 3: 揺れそうな日（05 §4.4）
  const [shakeCategory, setShakeCategory] = useState<ShakeCategory | null>(null);
  const [shakeDate, setShakeDate] = useState('');
  const [shakeTemplate, setShakeTemplate] = useState<ShakeTemplate | null>(null);
  const [shakeRegistered, setShakeRegistered] = useState<string | null>(null);
  // 「いまは思いつかない」を選んだ人に、揺れやすい柱から1問だけ逆算して聞く（§4.6）
  const [fragileAsking, setFragileAsking] = useState(false);

  const { data: presets = [] } = useQuery<PresetCategory[]>({
    queryKey: ['presets'],
    queryFn: () => api.get<PresetCategory[]>('/categories/presets'),
    enabled: step === 1,
  });

  // LPミニ診断からのプリフィル: 下書きが空のときだけ種付けする
  useEffect(() => {
    if (presets.length === 0) return;
    setDrafts((prev) => {
      if (prev.length > 0) return prev;
      const lp = loadLpDiagnosis();
      if (!lp || lp.length === 0) return prev;
      const byName = new Map(presets.map((p) => [p.name, p]));
      const seeded = lp
        .map((i) => byName.get(i.presetName))
        .filter((p): p is PresetCategory => !!p)
        .map((p) => ({
          key: `lp-${p.id}`,
          name: p.name,
          kind: p.kind,
          color: p.color,
          parentName: p.parentName,
          importance: (lp.find((i) => i.presetName === p.name)?.level ?? 2) as Level,
          isFragile: false,
        }));
      if (seeded.length === 0) return prev;
      clearLpDiagnosis();
      return seeded;
    });
  }, [presets]);

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
      setSavedCategories(categories);
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
    enabled: step === 4,
  });

  useEffect(() => {
    if (step === 4 && portfolio) track('baseline_portfolio_viewed');
  }, [step, portfolio]);

  const onboardingMutation = useMutation({
    mutationFn: () => api.patch<Profile>('/profile/onboarding'),
    onSuccess: (profile) => {
      track('onboarding_completed');
      qc.setQueryData(['profile'], profile);
      router.push('/dashboard');
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

  // ---------- Step 0: ようこそ ----------
  if (step === 0) {
    return (
      <div className="min-h-screen bg-[#1A3352] flex flex-col">
        <div className="flex-1 max-w-lg mx-auto px-6 pt-16 pb-8 flex flex-col">
          <div className="flex-1">
            <div className="mb-10">
              <div className="w-16 h-16 rounded-2xl bg-white/15 flex items-center justify-center mb-6">
                <Icon name="donut_large" filled className="text-4xl text-white" />
              </div>
              <h1 className="text-3xl font-bold text-white mb-3 leading-tight">
                ようこそ、
                <br />
                ココロバランスへ
              </h1>
              <p className="text-white/60 text-sm leading-relaxed">
                支えは、数より、確かさ。
                <br />
                あなたを支えているものを教えてください。
              </p>
            </div>

            <div className="space-y-3">
              {[
                { icon: 'diversity_3', title: '居場所と相手', desc: '人とのつながりが、いちばん確かな支えになります' },
                { icon: 'thunderstorm', title: '揺れそうな日に備える', desc: 'つらくなりそうな日の前に、支えを厚くしておく' },
                { icon: 'smart_toy', title: '壁打ち', desc: '考えを整理したいとき、そばで話を聞く相手' },
              ].map(({ icon, title, desc }) => (
                <div key={title} className="flex items-start gap-4 bg-white/10 rounded-2xl p-4">
                  <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
                    <Icon name={icon} filled className="text-2xl text-white" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-white">{title}</p>
                    <p className="text-xs text-white/60 mt-0.5 leading-relaxed">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={() => setStep(1)}
            className="mt-10 w-full py-4 bg-[#E05A3A] text-white font-semibold rounded-xl hover:bg-[#c94d30] transition shadow-lg text-sm"
          >
            はじめる
          </button>
          <p className="mt-4 text-center text-[11px] text-white/40 leading-relaxed">
            本アプリは医療・診断を目的としたものではありません
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-lg mx-auto px-4 pt-8 pb-10">
        {/* プログレスバー */}
        <div className="flex items-center gap-2 mb-8">
          {STEPS.map((label, i) => {
            const stepIndex = i + 1;
            return (
              <div key={label} className="flex items-center gap-2 flex-1">
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition ${
                    stepIndex <= step ? 'bg-primary text-white' : 'bg-secondary text-muted-foreground'
                  }`}
                >
                  {stepIndex < step ? <Icon name="check" className="text-sm text-white" /> : i + 1}
                </div>
                {i < STEPS.length - 1 && (
                  <div
                    className={`flex-1 h-0.5 rounded-full transition ${stepIndex < step ? 'bg-primary' : 'bg-secondary'}`}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Step 1: 柱の登録（型ファースト） */}
        {step === 1 && (
          <div>
            <div className="mb-6">
              <h2 className="text-xl font-bold text-foreground mb-1">いま、あなたを支えているものは？</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                2つ以上で先に進めます。あとからいつでも増やせます。
              </p>
            </div>

            {/* 型の選択 */}
            <div className="flex gap-1.5 mb-4">
              {(['place', 'relation', 'habit'] as PillarKind[]).map((k) => (
                <button
                  key={k}
                  onClick={() => {
                    setActiveKind(k);
                    setLabelInput('');
                    setOshiAsking(false);
                  }}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border-2 transition ${
                    activeKind === k ? 'bg-primary text-white border-primary' : 'border-border bg-white text-muted-foreground'
                  }`}
                >
                  {KIND_LABEL[k]}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mb-4 leading-relaxed">{KIND_HELP[activeKind]}</p>

            {/* 推しの1問（§2.3） */}
            {oshiAsking ? (
              <div className="bg-white rounded-2xl border border-border shadow-sm p-4 mb-4">
                <p className="text-sm text-foreground mb-1">推しのコミュニティ について</p>
                <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
                  そのファンの人たちと、やりとりはありますか？
                </p>
                <div className="space-y-2">
                  <button
                    onClick={() => {
                      addDraft('推し界', 'place');
                      setOshiAsking(false);
                    }}
                    className="w-full py-2.5 rounded-xl bg-primary text-white text-xs font-semibold"
                  >
                    ある
                  </button>
                  <button
                    onClick={() => {
                      addDraft('推し', 'habit');
                      setOshiAsking(false);
                    }}
                    className="w-full py-2.5 rounded-xl border border-border text-xs font-semibold text-muted-foreground"
                  >
                    ひとりで追っている
                  </button>
                  <button
                    onClick={() => {
                      addDraft('推し', 'habit');
                      setOshiAsking(false);
                    }}
                    className="w-full py-2 text-xs text-muted-foreground"
                  >
                    こたえない
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* 候補チップ */}
                <div className="flex flex-wrap gap-2 mb-3">
                  {activeKind === 'place' &&
                    PLACE_CANDIDATES.map((c) => (
                      <button
                        key={c}
                        onClick={() => {
                          if (c === OSHI_CANDIDATE) {
                            setOshiAsking(true);
                            return;
                          }
                          setLabelInput(c);
                        }}
                        className="px-3.5 py-2 rounded-full text-sm font-medium border-2 border-border bg-white text-foreground hover:border-primary/30 transition"
                      >
                        {c}
                      </button>
                    ))}
                  {activeKind === 'habit' &&
                    habitPresets.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => addDraft(p.name, 'habit', p.color, p.parentName)}
                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-medium border-2 border-border bg-white text-foreground hover:border-primary/30 transition"
                      >
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.color }} />
                        {p.name}
                      </button>
                    ))}
                </div>

                {/* 自分の言葉でラベルを付ける（P-10） */}
                <div className="flex gap-2 mb-6">
                  <input
                    value={labelInput}
                    onChange={(e) => setLabelInput(e.target.value)}
                    maxLength={20}
                    placeholder={
                      activeKind === 'relation'
                        ? '名前やあだ名でどうぞ'
                        : activeKind === 'place'
                          ? '例: 木曜のバンド'
                          : '例: 朝の散歩'
                    }
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addDraft(labelInput, activeKind);
                      }
                    }}
                    className="flex-1 px-3 py-2.5 rounded-xl border border-border text-sm"
                  />
                  <button
                    onClick={() => addDraft(labelInput, activeKind)}
                    disabled={!labelInput.trim()}
                    className="px-5 py-2.5 rounded-xl bg-accent text-white text-sm font-semibold disabled:opacity-40"
                  >
                    追加
                  </button>
                </div>
              </>
            )}

            {/* 追加済みの柱 */}
            {drafts.length > 0 && (
              <div className="space-y-2 mb-6">
                {drafts.map((d) => (
                  <div
                    key={d.key}
                    className="flex items-center gap-3 bg-white rounded-xl border border-border shadow-sm px-4 py-3"
                  >
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: d.color }} />
                    <span className="text-sm flex-1 min-w-0 truncate">{d.name}</span>
                    <span className="text-[10px] text-muted-foreground">{KIND_LABEL[d.kind]}</span>
                    <button
                      onClick={() => setDrafts((prev) => prev.filter((x) => x.key !== d.key))}
                      aria-label={`${d.name}を外す`}
                      className="text-muted-foreground"
                    >
                      <Icon name="close" className="text-base" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* 社会的な柱の推奨（強制しない → P-12） */}
            {drafts.length >= MIN_PILLARS && socialCount === 0 && (
              <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
                人や居場所の柱があると、揺れた日に頼れる先が増えます。あとからでも大丈夫です。
              </p>
            )}

            <button
              onClick={() => setStep(2)}
              disabled={drafts.length < MIN_PILLARS}
              className="w-full py-3.5 bg-accent text-white font-semibold rounded-xl hover:bg-[#c94d30] disabled:opacity-50 transition shadow-lg shadow-accent/20 text-sm"
            >
              {drafts.length < MIN_PILLARS ? `あと${MIN_PILLARS - drafts.length}つ選んでください` : '次へ'}
            </button>
          </div>
        )}

        {/* Step 2: 重要度と「揺れやすい柱」 */}
        {step === 2 && (
          <div>
            <div className="mb-6">
              <h2 className="text-xl font-bold text-foreground mb-1">どれくらい大切ですか？</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                揺れたらしんどいと思うものには、印をつけておけます。
              </p>
            </div>

            <div className="space-y-3">
              {drafts.map((d) => (
                <div key={d.key} className="bg-white rounded-2xl border border-border shadow-sm p-4">
                  <div className="flex items-center gap-2.5 mb-3">
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: d.color }} />
                    <span className="font-medium text-sm text-foreground flex-1 min-w-0 truncate">{d.name}</span>
                    <span className="text-[10px] text-muted-foreground">{KIND_LABEL[d.kind]}</span>
                  </div>
                  <div className="flex gap-2 mb-3">
                    {IMPORTANCE_LEVELS.map(({ value, label }) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() =>
                          setDrafts((prev) =>
                            prev.map((x) => (x.key === d.key ? { ...x, importance: value } : x)),
                          )
                        }
                        className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition ${
                          d.importance === value
                            ? 'bg-primary text-white border-primary'
                            : 'bg-secondary text-muted-foreground border-transparent'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setDrafts((prev) => prev.map((x) => (x.key === d.key ? { ...x, isFragile: !x.isFragile } : x)))
                    }
                    className={`text-xs font-medium ${d.isFragile ? 'text-accent' : 'text-muted-foreground'}`}
                  >
                    {d.isFragile ? '✓ 揺れたらしんどい' : '揺れたらしんどい？'}
                  </button>
                </div>
              ))}
            </div>

            <button
              onClick={() => bulkCreateMutation.mutate()}
              disabled={bulkCreateMutation.isPending || baselineMutation.isPending}
              className="mt-8 w-full py-3.5 bg-accent text-white font-semibold rounded-xl hover:bg-[#c94d30] disabled:opacity-50 transition shadow-lg shadow-accent/20 text-sm"
            >
              {bulkCreateMutation.isPending || baselineMutation.isPending ? '保存中…' : 'できあがりを見る'}
            </button>
          </div>
        )}

        {/* Step 3: 揺れそうな日（05 §4.4）。原則4により、空の状態でホームに送らない */}
        {step === 3 && (
          <div>
            <div className="mb-6">
              <h2 className="text-xl font-bold text-foreground mb-1">この先、心が揺れそうな日はありますか？</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                日付がわかっている予定があれば、その日までに支えを厚くしておけます。
              </p>
            </div>

            {fragileAsking ? (
              /* §4.6 柱から逆算して1問だけ聞く。答えなくても先に進める */
              <div className="bg-white rounded-2xl border border-border shadow-sm p-4">
                <p className="text-sm text-foreground mb-3 leading-relaxed">
                  「{fragilePillarName}」に、この先なにか予定はありますか？
                </p>
                <div className="space-y-2">
                  <button
                    onClick={() => setFragileAsking(false)}
                    className="w-full py-2.5 rounded-xl bg-primary text-white text-xs font-semibold"
                  >
                    ある — 登録する
                  </button>
                  <button
                    onClick={() => setStep(4)}
                    className="w-full py-2.5 rounded-xl border border-border text-xs font-semibold text-muted-foreground"
                  >
                    いまは思いつかない
                  </button>
                </div>
              </div>
            ) : !shakeCategory ? (
              <div className="grid grid-cols-2 gap-2">
                {(Object.keys(SHAKE_CATEGORY_LABELS) as ShakeCategory[]).map((c) => (
                  <button
                    key={c}
                    onClick={() => setShakeCategory(c)}
                    className="py-3 rounded-xl border border-border bg-white text-sm font-medium hover:border-accent/40 transition"
                  >
                    {SHAKE_CATEGORY_LABELS[c]}
                  </button>
                ))}
              </div>
            ) : !shakeTemplate ? (
              <div className="space-y-2">
                <button onClick={() => setShakeCategory(null)} className="text-xs text-accent">
                  ← 種類を選び直す
                </button>
                {shakeTemplates
                  .filter((t) => t.category === shakeCategory)
                  .map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setShakeTemplate(t)}
                      className="w-full text-left py-3 px-4 rounded-xl border border-border bg-white text-sm font-medium hover:border-accent/40 transition"
                    >
                      {t.label}
                    </button>
                  ))}
              </div>
            ) : (
              <div className="space-y-4">
                <button onClick={() => setShakeTemplate(null)} className="text-xs text-accent">
                  ← 選び直す
                </button>
                <div className="bg-white rounded-2xl border border-border shadow-sm p-4">
                  <p className="text-sm font-semibold text-foreground mb-3">{shakeTemplate.label}</p>
                  <p className="text-xs text-muted-foreground mb-2">いつですか？</p>
                  <input
                    type="date"
                    min={todayJST()}
                    value={shakeDate}
                    onChange={(e) => setShakeDate(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-border text-sm"
                  />
                  <p className="text-[11px] text-muted-foreground mt-2 leading-relaxed">
                    空のままでも登録できます（日付未定として扱います）
                  </p>
                </div>
                <button
                  onClick={() => createShakeMutation.mutate(shakeTemplate)}
                  disabled={createShakeMutation.isPending}
                  className="w-full py-3.5 bg-accent text-white font-semibold rounded-xl hover:bg-[#c94d30] disabled:opacity-50 transition shadow-lg shadow-accent/20 text-sm"
                >
                  {createShakeMutation.isPending ? '登録中…' : '登録する'}
                </button>
              </div>
            )}

            {!fragileAsking && (
              <button
                onClick={() => {
                  // 揺れやすい柱があれば1問だけ逆算して聞く（§4.6）。無ければそのまま進む
                  if (fragilePillarName) setFragileAsking(true);
                  else setStep(4);
                }}
                className="w-full mt-6 py-2.5 text-xs text-muted-foreground"
              >
                いまは思いつかない
              </button>
            )}
          </div>
        )}

        {/* Step 4: 初期ポートフォリオ */}
        {step === 4 && (
          <div>
            <div className="text-center mb-6">
              <h2 className="text-xl font-bold text-foreground mb-2">
                これがいまの、
                <br />
                あなたの支えの形です
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                毎週の点検で、すこしずつ実際のデータに置き換わっていきます
              </p>
            </div>

            <div className="bg-white rounded-2xl border border-border shadow-sm p-5">
              {portfolio ? (
                <PortfolioPie breakdown={portfolio.breakdown} />
              ) : (
                <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">読み込み中…</div>
              )}
            </div>

            {shakeRegistered ? (
              <p className="text-center text-sm text-muted-foreground mt-4 leading-relaxed">
                「{shakeRegistered}」の日に向けて、備えを用意しておきます。
              </p>
            ) : (
              savedCategories.length > 0 && (
                <p className="text-center text-sm text-muted-foreground mt-4 leading-relaxed">
                  {savedCategories.length >= MIN_PILLARS
                    ? 'ここから、揺れそうな日に備えていきましょう。'
                    : 'ここから育てていきましょう。'}
                </p>
              )
            )}

            <button
              onClick={() => onboardingMutation.mutate()}
              disabled={onboardingMutation.isPending}
              className="mt-8 w-full py-3.5 bg-accent text-white font-semibold rounded-xl hover:bg-[#c94d30] disabled:opacity-50 transition shadow-lg shadow-accent/20 text-sm"
            >
              {onboardingMutation.isPending ? 'はじめています…' : 'ホームへ'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
