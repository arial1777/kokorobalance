# 12. エビデンス台帳

全ドキュメントから `E-xx` で参照される出典の一覧です。

## 使い方と注意

| 信頼度 | 意味 |
|---|---|
| **A** | 査読論文 / 政府・公的機関の一次資料 / 企業の適時開示・公式リリース |
| **B** | 業界レポート（方法論が明示されている） / 大手メディアの報道 / 企業公表値 |
| **C** | 業界レポート（方法論非公開） / 二次情報 / ベンダー自称値 |
| **未検証** | 本調査では一次ソースを確認できていない。**社外資料への引用前に必ず確認** |

> **重要**
> - 数値を社外資料（LP・営業資料・プレスリリース・投資家向け資料）に転記する前に、**必ず一次ソースを再確認してください。** URLは2026年8月1日時点のものです。
> - 信頼度 **C** の市場規模データは、海外レポートの翻訳転売が多く、**同じ市場について数値が数十倍単位で矛盾している**ケースがあります。社外資料への引用は避けてください。
> - 学術データを訴求に使う場合、**研究の対象集団と条件を省略しないでください**（例: E-03 は「既にうつのある人において」の数値）。

---

## 学術（気分記録・self-monitoring）

### E-16 — 気分モニタリング介入のRCTメタ分析【A】
Astill Wright L, Shajan G, Purewal D, et al. "Mood Monitoring, Mood Tracking, and Ambulatory Assessment Interventions in Depression and Bipolar Disorder: Systematic Review and Meta-Analysis of Randomized Controlled Trials." *JMIR Ment Health*. 2026 Jan 7;13:e84020.
https://mental.jmir.org/2026/1/e84020 / https://pmc.ncbi.nlm.nih.gov/articles/PMC12779106/

- 対象RCT 8件（双極性障害5・うつ病3）
- 躁/軽躁 SMD −0.16（95%CI −0.34〜0.01, P=.06）**有意でない**／双極性うつ SMD −0.08（−0.31〜0.15）**効果なし**／うつ病12ヶ月 SMD −0.25（−0.49〜0.00, P=.05）**境界的**、6ヶ月 −0.21（P=.21）**有意でない**
- 含まれた全介入が看護師レビュー・心理教育・CBTモジュール等を併用しており、**トラッキング単独の効果を分離できない**
- 有害事象: 1研究のみ報告。3名が「ストレスフル」、1名が「役に立たない」
- 著者結論: 気分モニタリングは「**治療介入ではなくアウトカム測定手段**」として位置づけるべき

### E-06 — self-monitoring の負担・罪悪感【A】
Orji R, Lomotey R, Oyibo K, et al. "Tracking feels oppressive and 'punishy': Exploring the costs and benefits of self-monitoring for health and wellness." *Digital Health*. 2018;4:2055207618797554.
https://pmc.ncbi.nlm.nih.gov/articles/PMC6122239/

- 2研究・計 **1,768名**
- 抽出された弱点: ①健康障害リスク（摂食障害・うつの誘発）、②感情的負担（"oppressive" "punishy" と表現され、**動機づけではなく罪悪感と恥**を生む）、③退屈（"tedious" "boring" "hard work"）、④単体では不十分

### E-07 — 気分記録アプリ利用者へのインタビュー【A】
Schueller SM, Neary M, Lai J, Epstein DA. "Understanding people's use of and perspectives on mood-tracking apps: interview study." *JMIR Ment Health*. 2021 Aug 11;8(8):e29368.
https://mental.jmir.org/2021/8/e29368

- 実利用者 **22名**への半構造化インタビュー
- 利用開始トリガーは**ネガティブなライフイベントの後**（常時利用の動機は弱い）
- **一部のユーザーは「ポジティブな気分だけを記録することを好んだ」**
- 最大の不満: **「自分のデータをどう解釈すべきかの推奨・示唆がアプリから提供されない」**

補足【A】: Kelley C, Lee B, Wilcox L. "Self-tracking for Mental Wellness." *CHI '17*. — モチベーションが最大の障壁であり、その要因が「**ネガティブ感情データを記録することへの恐れ**」 https://dl.acm.org/doi/10.1145/3025453.3025750

### E-08 — 気分アプリの機能分析【A】
Caldeira C, Chen Y, Chan L, et al. "Mobile apps for mood tracking: an analysis of features and user reviews." *AMIA Annu Symp Proc*. 2017:495-504.
https://pubmed.ncbi.nlm.nih.gov/29854114/

- 商用アプリ **32本**の機能分析＋レビューの質的分析
- personal informatics フレームワーク（preparation → collection → reflection → action）で評価すると、**collection と reflection は豊富だが preparation と action の支援が不足**

### E-30 — 尺度妥当性への批判（ikigai）【A】
Ikigai-9 等の尺度で、31の因子負荷のうち .70 を超えたのは2つのみ。4因子で全分散の39.1%しか説明できない。確認的因子分析は原論文の3因子モデルを支持せず単一因子解を支持。研究者が ikigai の知覚とその源泉を混同している。
https://internationaljournalofwellbeing.org/index.php/ijow/article/download/979/907/5073

### E-31 — emodiversity の統計的アーティファクト批判【A】
Brown NJL, Coyne JC. "Emodiversity: Robust Predictor of Outcomes or Statistical Artifact?" *J Exp Psychol Gen*. 2017. — Shannon エントロピー式の適用が疑問。報告された効果は階層的回帰の未実施と抑制効果に由来する可能性が高く、「**計算上・統計上のアーティファクトの集合に還元されうる**」
https://pubmed.ncbi.nlm.nih.gov/28846007/
（原典: Quoidbach J, et al. *J Exp Psychol Gen*. 2014. https://pubmed.ncbi.nlm.nih.gov/25285428/ ／著者反論: https://pubmed.ncbi.nlm.nih.gov/29469588/ ／**論争は未決着**）

---

## 学術（self-complexity — 使ってはいけない側）

### E-01 — Linville 1987 の再現失敗【A】
原典: Linville PW. "Self-complexity as a cognitive buffer against stress-related illness and depression." *J Pers Soc Psychol*. 1987;52(4):663-76. https://pubmed.ncbi.nlm.nih.gov/3572732/

- 構成概念妥当性への疑義（Koenig 1989、Hershberger 1990）
- **Linville (1987) と同様の prospective panel design を用いた複数の研究が、ストレス曝露後の抑うつ症状に対する緩衝効果を見出せなかった**
https://www.sciencedirect.com/science/article/abs/pii/S0191886998002475 / https://link.springer.com/article/10.1023/A:1026311222295

### E-02 — メタ分析による否定【A】
Rafaeli-Mor E, Steinberg J. "Self-Complexity and Well-Being: A Review and Research Synthesis." *Personality and Social Psychology Review*. 2002;6(1):31-58.
https://journals.sagepub.com/doi/10.1207/S15327957PSPR0601_2

- self-complexity は well-being と**負に、しかし弱く**相関（研究間の強い異質性あり）
- **ストレス緩衝仮説への支持はほとんど見出されなかった**。むしろポジティブな出来事の調整変数としての支持のほうが大きい

逆方向の知見【A】: McConnell AR, et al. "The Simple Life: On the Benefits of Low Self-Complexity." *Pers Soc Psychol Bull*. 2009. https://allenmcconnell.net/pdfs/simplelife-PSPB-2009.pdf

> **結論: Linville 1987 を「ポートフォリオ理論」の根拠として引用してはいけません**（→ `07#6`）。

---

## 学術（Social Identity — 使うべき側）

### E-03 — 縦断コホート（社会的グループ所属とうつ）【A】
Cruwys T, Dingle GA, Haslam C, et al. "Social group memberships protect against future depression, alleviate depression symptoms and prevent depression relapse." *Soc Sci Med*. 2013;98:179-186.
https://pubmed.ncbi.nlm.nih.gov/24331897/

- 近位分析 **5,055名を2年間**、遠位分析 **4,087名を4年間**
- ベースラインの抑うつ・年齢・性別・SES・健康状態・婚姻状況・民族をコントロール
- **既に抑うつのある人において: グループを1つ増やすと再発リスク −24%、3つ増やすと −63%**
- 効果は**非抑うつ者より抑うつ者において顕著に強い**

> **訴求時の注意: 「既にうつのある人において」という条件を省略しないこと。**

関連【A】: Cruwys T, et al. "Social Identity Reduces Depression by Fostering Positive Attributions." *Soc Psychol Personal Sci*. 2015. https://journals.sagepub.com/doi/10.1177/1948550614543309

### E-04 — Groups 4 Health（RCT）【A】
**Phase 3 非劣性RCT**: Haslam C, Cruwys T, Chang MX-L, et al. *Br J Psychiatry*. 2022. （15–25歳、孤独＋臨床的に有意な抑うつ症状、N=174: G4H 84 / CBT 90、12ヶ月フォローアップ）
https://pubmed.ncbi.nlm.nih.gov/35049477/

- 抑うつ pre-post: **d_G4H = −0.71 / d_CBT = −0.91** → **G4H は CBT に非劣性**
- 孤独: **d_G4H = −1.07 / d_CBT = −0.89** → 治療完了後に G4H がやや上回る

**Phase 2 RCT**（N=120、G4H vs TAU）: 孤独感 d=−1.04（TAU −0.33）／社会不安 d=−0.46／抑うつ d=−0.63／**「複数グループへの帰属感」自体が d=0.52 で強化**
https://www.researchgate.net/publication/335529981

### E-05 — identity accumulation と verification（決定的な条件）【A】
Thoits の identity accumulation hypothesis に関する研究群。

- **アイデンティティ累積が well-being を高めるのは、それらが高度に "verified"（他者から承認・確認されている）場合のみ。verify されていないアイデンティティの累積は well-being を低下させる**
https://www.researchgate.net/publication/334512698_Identity_Accumulation_Verification_and_Well-Being / https://link.springer.com/rwe/10.1007/978-94-007-0753-5_2535

---

## 学術（アプリ全般・AI）

### E-17 — リテンションの決定版データ【A】
Baumel A, Muench F, Edan S, Kane JM. "Objective User Engagement With Mental Health Apps: Systematic Search and Panel-Based Usage Analysis." *J Med Internet Res*. 2019;21(9):e14567.
https://www.jmir.org/2019/9/e14567/

- 対象 **93アプリ**（インストール数中央値10万、IQR 9万）
- **DAU（open rate）中央値 4.0%**（IQR 4.7%）
- **15日継続率 中央値 3.9%**（IQR 10.3%）／**30日継続率 中央値 3.3%**（IQR 6.2%）
- 30日継続率のカテゴリ別: **ピアサポート 8.9%** / トラッカー 6.1%（IQR 20.4%） / マインドフルネス・瞑想 4.7% / **呼吸法 0.0%**
- open rate のカテゴリ別: **ピアサポート 17.0%** / トラッカー 6.3% / 呼吸法 1.6%
- アクティブユーザーの1日利用時間: マインドフルネス 中央値21.47分 / トラッカー・呼吸法・心理教育 3.53〜8.32分

> **注意: Google Play のパネルデータであり、自社の計測手法と厳密には比較できません**（→ `11#4.2`）。

### E-34 — 臨床試験での脱落率【A】
Torous J, et al. "Dropout rates in clinical trials of smartphone apps for depressive symptoms: A systematic review and meta-analysis." *J Affect Disord*. 2020.
https://pubmed.ncbi.nlm.nih.gov/31969272/

- 平均脱落率 26.2%、出版バイアス補正後 **47.8%**
- 気分トラッキング機能を含むものは脱落率が低い（18.4%）／**人間のフィードバックがある研究も脱落率が低い**
- **プラセボアプリと実治療アプリで脱落率に差がなかった**

### E-10 — LLM のクライシス応答失敗【A】
Moore J, Grabb D, Agnew W, et al. "Expressing stigma and inappropriate responses prevents LLMs from safely replacing mental health providers." *ACM FAccT 2025*.
https://dl.acm.org/doi/full/10.1145/3715275.3732039 / https://news.stanford.edu/stories/2025/06/ai-mental-health-care-tools-dangers-risks

- **モデルは妄想的思考を現実検討せずに追認し、メンタルヘルスクライシスを認識できず、確立された治療実践に反する助言を与えた**
- **より新しく高性能なLLMでもスティグマは同程度。モデルサイズや技術進歩はスティグマをほとんど減らさなかった**
- 具体例: 失職後に自殺を示唆したユーザーが「橋のリスト」を求めた際、**7cups の Noni や Character.ai の therapist は文脈を捉えず単に橋を列挙した**

### E-11 — APA の警告【A】
American Psychological Association. "Health Advisory on the Use of Generative AI Chatbots and Wellness Applications for Mental Health." 2025年11月13日.
https://www.apa.org/topics/artificial-intelligence-machine-learning/health-advisory-ai-chatbots-wellness-apps-mental-health.pdf

- **生成AIは心理療法・心理的治療・診断・クライシス支援に使用すべきでない**
- **高品質な心理学的科学に基づいて開発されたAIツールであっても、安全性・有効性を示す十分なエビデンスを欠く**
- 「チャットボットは支援と承認をすぐに提供するように見えるが、**クライシスにある人を安全に導く能力は限定的かつ予測不能**」（CEO Arthur C. Evans Jr.）
- **承認的な応答は必ずしも正確ではなく、短期的な安堵は持続的な症状改善に転換しない**
- 政策提言に **AIチャットボットが免許専門職を装うことの禁止**

参考（唯一の肯定的RCT）【A】: Heinz MV, et al. "Randomized Trial of a Generative AI Chatbot for Mental Health Treatment (Therabot)." *NEJM AI*. 2025. N=210、4週間、PHQ-9 介入 −6.13 vs 対照 +2.63。**ただし安全上の懸念（自殺念慮 n=15）や不適切な応答の訂正（n=13）のためスタッフの介入が計28回必要だった。** 待機リスト対照。 https://ai.nejm.org/doi/full/10.1056/AIoa2400802

### E-29 — implementation intentions【**未検証**】
事前の if-then 型計画（implementation intentions）が行動変容に中〜大の効果を持つとされるメタ分析（Gollwitzer & Sheeran, 2006 と記憶されるが、**本調査では一次ソースを確認していない**）。

> **`05#1.2` でこれを引用しています。社外資料に使う前に必ず一次ソースを確認してください。** 確認できない場合は「行動科学で広く使われる技法」という記述に留めること。

---

## 市場（日本）

### E-21 — 日本のヘルスケアアプリ利用実態【B】
MMD研究所「ヘルスケアアプリと医療DXに関する調査」（2021年10月、18〜69歳スマホ所有者 n=5,984）
https://mmdlabo.jp/investigation/detail_2005.html

- 医療・ヘルスケアアプリ 現在利用 24.2%（20代 32.1%が最多）
- **未利用理由（n=2,603）: 利用するきっかけがなかった 29.2% / 記録が面倒 28.8% / 利用するメリットがないと思った 18.0%**
- プライバシー懸念は全世代で1割未満でランク外（**プライバシーは主要障壁ではない**）

### E-14 — 推し活【A】
財務省『ファイナンス』2025年11月号 コラム 経済トレンド137「推し活〜若年層を中心に急成長する消費形態〜」
https://www.mof.go.jp/public_relations/finance/2025011/202511f.pdf

- **15〜79歳の3人に1人が推しを持つ**（インテージ 2025年1月、n=5,000）。**20代女性 45%**、男性全体29%
- 矢野経済研究所推計: 主要16分野 2020年度 6,730億円 → 2024年度 **1兆90億円**（約50%拡大）
- 年間支出: 国内アイドル 約4.8万円、ミュージシャン 約3.4万円、K-POP 約2.7万円
- **物価高の影響「全く影響しない」= 推し活全般 54.0%** vs 食材費 29.9%、水道光熱 29.8%
- 第一生命経済研究所: 推し活は**寄付と同様の「利他性」に基づく満足感**でウェルビーイングに寄与

### E-23 — Z世代のトレンド転換【B】
- 「Z世代はSNS疲れを感じており、2025年は利用率や接触時間が伸びなくなり、**SNS登場以来初めての転換点**」 https://toyokeizai.net/articles/-/925225
- 「映え」から「リアル」へ（Reaplus「Youth Now!」） https://prtimes.jp/main/html/rd/p/000000053.000129874.html
- 「**見せるための自分**」ではなく「**素の自分**」を出せる環境が支持される https://media-radar.jp/mediapicks/article/knowledge/columns-sns-young

補足【B】: 日経BP「未来コトハジメ」— 「Twitterの鍵付きアカウントで愚痴をつぶやいている人たちが相当数いる。**みんな何かしら吐き出したいけれども、人には見られたくない**」「メモ帳では味気ない」 https://project.nikkeibp.co.jp/mirakoto/atcl/wellness/h_vol55/

### E-33 — emol CEO の指摘【B】
同上（日経BP）。emol CEO 千頭沙織氏: 「**相槌でも何でもいいからリアクションがほしい。AIが『そうなんだ、大変だね』と反応してくれるだけでも心が楽になる**」

### E-09 — 競合のストアレビュー【B（一次: App Store）】
- Awarefy（4.3 / 7,047件）https://apps.apple.com/jp/app/id1513802951
  - 「チェックインアウト時のAIの一言が当たり障りがない所か**オウム返し**な返事をされる上に『無理をなさらないでくださいね』と**定型文を毎回返される**」
  - 「年間契約をしてしまったのですが、**今まで話した全ての事を覚えていてくれるわけではありません**」
  - 「ストレスの原因を**勝手に夫婦間の揉め事だと思われた**」
  - 「運営に何度も問い合わせましたが（中略）**音沙汰なし**」
- muute（4.7 / 2.1万件）https://apps.apple.com/jp/app/id1512361252
  - 「**ネガティブを否定しないで欲しい。**『ネガティブ多い。来週は発見や喜びも報告してもらえると嬉しい』というインサイトが届いてがっかりした」
  - 「有料画面を閉じる**右上のバツボタンの表示が薄過ぎて気がつきにくい。無料と誤解しかねない**」
- Upmind（4.6 / 4.4万件）https://apps.apple.com/jp/app/id1565658134
  - 「アンロック内容だけでは、**年会費を支払うまで充実しているか不明**」
  - 「**スリープストーリーの一部コンテンツがロックされて聴けなくなった**」

### E-36 — 競合価格【B】
Awarefy 1,200円/月（年7,200円）、AIパートナープラン 約4,000円 ／ Upmind 1,650円（年6,600円） ／ Headspace 1,650円 ／ Calm 1,950円（年6,500円） ／ Unlace トライアル+ビデオ1回 13,200円 ／ メンヘラせんぱい 30分300円
各App Store・公式サイト（2026年8月時点）

### E-46 — 無料の公的競合【A】
こころコンディショナー（朝日新聞社／ストレスマネジメントネットワーク／NECソリューションイノベータ、大野裕監修、認知行動療法ベース、**完全無料**）が東京都「ここナビ」に公式採用
https://www.hokeniryo.metro.tokyo.lg.jp/kenkou/tokyokaigi/chatbot
厚労省「こころの耳」 https://kokoro.mhlw.go.jp/

### E-37 — 日本のB2Cプレイヤーの結末【A】
- **cotree**: 2025年3月1日付で JMDC に吸収合併され法人消滅 https://www.jmdc.co.jp/wp-content/uploads/2024/12/news20241223.pdf
- **muute**: 2025年11月4日、日本生命がミッドナイトブレックファストの全株式を取得し完全子会社化、社名を Nissay MIRAIQA に変更（150万DL到達後） https://www.nissay.co.jp/news/2025/pdf/20251104.pdf
- **emol**: 2020年に法人向け emol work へピボット、その後 精神疾患DTx（強迫症・社交不安症・ADHD）へ。2025年1月シリーズA 3.15億円 https://thebridge.jp/2020/05/emol-work-official-launch / https://prtimes.jp/main/html/rd/p/000000024.000043787.html
- **FiNC**: 2019年12月期 純損失47.2億円、2020年12月期 25.1億円・債務超過、2023年12月期 3.17億円、減資を反復 https://media-innovation.jp/2020/04/28/finc-technologies-full-year-result/ / https://gamebiz.jp/news/396239

### E-42 — Awarefy の規模【A】
100万DL達成（2026年1月、2020年5月リリースから約6年）https://1million.awarefy.app/
2024年12月シリーズA 4億円、累計調達 7.09億円 https://www.awarefy.com/news/press-release-20241211 / https://initial.inc/companies/A-36377

### E-38 — 法人向け市場【B】
日経／ミック経済研究所: 法人向けヘルスケアソリューション市場 **2023年度 258.1億円 → 2024年度 325.3億円 → 2028年度 806.5億円、CAGR 25.6%**（ベンダー33社集計、2024年11月発刊）
https://www.nikkei.com/article/DGXZRSP684986_Z00C25A1000000/
参考【B】: 健康経営関連サービス13品目 2030年度 3,308億円（富士経済） https://womanslabo.com/market-250616-2

### E-22 — ストレスチェック義務化【A】
「労働安全衛生法及び作業環境測定法の一部を改正する法律」2025年5月14日公布。**50人未満事業場へのストレスチェック義務化の施行日は2028年4月1日**。
https://www.mhlw.go.jp/stf/newpage_70761.html / https://www.mhlw.go.jp/stf/newpage_69680.html（小規模事業場向け実施マニュアル）

### E-39 — ストレスチェックの単価【C】
Web受検 200〜700円/人、紙 400〜1,000円/人、平均300〜600円/人。月額型は1名あたり数百円/月。50人規模で年間2〜10万円。
https://service.firstcall.md/blog/281 / https://www.persol-bd.co.jp/service/hrsolution/s-hr/column/stresscheck-outsourcing/

### E-50 — 実施率のギャップ【B】
50人以上の事業場: 81.7〜90% ／ **50人未満: 34.6%**
https://www.avenir-executive.co.jp/sangyoui/column-list/news251226-1/

### E-51 — B2B導入の失敗要因【C】
「従業員への周知・教育不足」「社内推進担当者の不在」が主原因。最も多いのは「**企業の想定**」と「**従業員の実際のニーズ**」のズレ。
https://wellcon.co-nect.co.jp/health-app-corporate/

### E-40 — 日本のアプリ支出【B】
Sensor Tower 2025年版モバイル市場年鑑: 日本は消費者アプリ支出額 **世界第3位、2024年 165億ドル**
https://sensortower.com/ja/blog/state-of-mobile-2025-JP

### E-41 — フリーミアム転換率【C】
一般に **2〜5%**（数%〜10%程度）。クレカ登録を伴う無料トライアル経由なら30%前後。
https://blog.hubspot.jp/freemium / https://repro.io/contents/4-tips-for-effective-freemiums/

参考【B】: デロイト トーマツ「国内消費者におけるメンタルヘルスに関する調査」（2024年4月、n=4,285）— 約6割が直近1年で心の不調。**メンタルヘルス関連サービスの利用実績は2割以下**で、原因は「機能イメージが十分に認知されていない」 https://www.deloitte.com/jp/ja/Industries/consumer-products/research/mental-health-survey.html

---

## 市場（グローバル）

### E-13 — サブスク継続率【B】
Adapty「State of In-App Subscriptions 2026」
https://adapty.io/state-of-in-app-subscriptions/

- グローバル平均: インストール→トライアル 10.9%、トライアル→有料 25.6%
- **Health & Fitness のトライアル→有料 35.0%（全カテゴリ最高）**
- **Health & Fitness の初回更新継続率 30.3%（全カテゴリ最低）**（最高 Utilities 58.1%）
- 380日継続: **年額 19.9% / 月額 14.2% / 週額 5.5%**
- Health & Fitness は**年額プランが売上の60.6%**
- 成長最速市場に日本が挙げられている

### E-18 — 離脱の理由【C】
「約52%が最初の数週間でメンタルウェルネスアプリの利用を停止。**約39%が『測定可能な改善がなかった』ことを理由に挙げる**」
https://www.globalgrowthinsights.com/market-reports/mental-health-apps-market-123828

> **信頼度C: 方法論が非公開。市場規模推計も他社と大きく乖離しています。社外資料への引用は避けてください。**

参考【B】: ウェルネスアプリ市場収益 2025年 $848M、**前年比 −6.2%（2年連続減）**。トップは Calm の $210M https://www.businessofapps.com/data/wellness-app-market/

### E-19 — Daylio【B】
累計 **1,900万DL**、4.74/5（44万件評価）。「2タップ記録」。**臨床エビデンスなし**
https://www.appbrain.com/app/daylio-journal-mood-tracker/net.daylio

### E-20 / E-47 — Finch（消費者D2Cの唯一の明確な成功例）【B】
累計 **1,250万DL超**、レーティング 4.9/5、**ARR $30M を VC資金なしで達成**。差別化要因は「kawaii 美学 + バーチャルペット機構」。構造は**気分トラッカー + ジャーナル + デイリープランナー**を、名前をつけて世話する鳥で包んだもの。
https://blog.sparrowapps.io/p/finch-how-a-self-care-app-hit-30m-arr-without-vc-money

> **示唆: 消費者D2Cで成功した唯一の明確な事例は「臨床的有効性」ではなく「愛着のあるキャラクターによる継続動機」で勝ちました。**

### E-12 — Apple Health の State of Mind【A】
Health アプリで毎日の気分をログし、**睡眠・運動・マインドフル時間との関係で変化を閲覧可能**。インタラクティブなチャートで「何が気分に影響しているか」の洞察。**OS標準・無料**。
https://support.apple.com/guide/iphone/log-your-state-of-mind-iph6a6decb13/ios

### E-28 — Apple Health+ の縮小【B】
2026年2月、Bloomberg の Mark Gurman 報道により **iOS 27 から Health+ は外れ、Project Mulberry（AI健康コーチ）は実質的に棚上げ**。中止ではなく縮小。
https://www.macrumors.com/2026/02/05/apple-reportedly-scales-back-ios-27-feature/

参考【A】: Fitbit の Gemini 搭載パーソナル健康コーチが2025年10月27日にリリース https://blog.google/products-and-platforms/devices/fitbit/personal-health-coach-public-preview/ ／ Oura が2026年2月に女性の健康に特化した自社LLMを投入 https://ouraring.com/blog/womens-health-ai-model/

### E-15 — AIセラピー規制【A】
- **イリノイ州 WOPR Act（HB 1806）**: 2025年8月4日署名。AIによるメンタルヘルス/治療的意思決定の提供を禁止。**「AI therapy」「chatbot counselor」「virtual psychotherapist」等の表示を、臨床医の直接的監督がない限り違法な誤認広告として扱う。1違反あたり最大$10,000** https://idfpr.illinois.gov/news/2025/gov-pritzker-signs-state-leg-prohibiting-ai-therapy-in-il.html
- **2026年7月時点: 完全禁止4州（イリノイ・ネバダ・ロードアイランド・メイン）、規制4州（ユタ・ニューヨーク・カリフォルニア・ネブラスカ）。2026年Q1だけで36州が70件超の法案を提出** https://psychology.com/ai-therapy/state-bans / https://www.multistate.ai/updates/vol-85-state-ai-chatbot-regulation-laws

### E-24 — FDA Digital Health Advisory Committee【A】
2025年11月6日開催。議題「Generative AI-Enabled Digital Mental Health Medical Devices」。仮想事例として成人MDD向け処方箋LLMセラピーチャットボットを検討。
https://www.fda.gov/advisory-committees/advisory-committee-calendar/november-6-2025-digital-health-advisory-committee-meeting-announcement-11062025

- **FDAはこれまで1,200超のAI医療機器を承認したが、メンタルヘルス領域では生成AI機器を1件も承認していない**
- 特定されたリスク: ハルシネーション、**シコファンシー（迎合）**、バイアス、モデルドリフト、**悪化や自殺念慮の検知失敗**
- 市販前エビデンスの推奨に **「有害事象の偽陰性を透明に測定すること」**、自殺念慮・自傷を捕捉する広範な有害事象定義、**臨床医監督下 → セミ自律への段階的検証**

### E-25 — Character.AI 訴訟【B】
2026年1月8日報道: **Google と Character.AI が複数の10代自殺関連訴訟について「settlement in principle（原則合意）」**。条件非開示、責任の認定なし。
https://fortune.com/2026/01/08/google-character-ai-settle-lawsuits-teenage-child-suicides-chatbots/
2025年10月、Character.AI は**18歳未満のAIペルソナとのオープンエンドチャットを禁止**し年齢確認を導入。

### E-26 — Woebot の終了【A/B】
**2025年6月30日に消費者向けアプリを終了。** 累計150万人以上が利用（実際は生成AIではなくルールベースのスクリプト型CBT）。創業者/CEO Alison Darcy: 終了理由は主に **FDAのマーケティング承認要件を満たすコストと困難**。使いたかったLLMを **FDAがまだ規制方法を決めていない**ため事業継続の圧力が高まった。現在はエンタープライズモデルへ完全ピボット。
https://www.statnews.com/2025/07/02/woebot-therapy-chatbot-shuts-down-founder-says-ai-moving-faster-than-regulators/

### E-32 — Slingshot AI / Ash の英国撤退【B】
2025年7月に Ash をローンチ（累計調達$93M、バリュエーション$220M）。**2026年1月23日付で英国市場から撤退。** CEO Daniel Reid Cahn: 「われわれのようなウェルビーイング製品には**明確な規制上の経路が存在せず、その明確性なしには自信をもって事業運営できない**」
https://www.statnews.com/2026/01/21/slingshot-therapy-chatbot-ash-uk-regulatory-concerns/

### E-43 — Kintsugi の廃業【B】
2026年2月9日、**7年・$30M** を投じた音声ベースのうつ病スクリーニング企業が商業運営を終了。**臨床的にバリデート済み、FDA De Novo クリアランス取得の直前、日本ではメンタルヘルススクリーニングのデフォルトツールとして展開されていた**にもかかわらず廃業。原因は **FDA規制ハードルのコストと期間**。
https://bhbusiness.com/2026/02/11/mental-health-voice-biomarker-kintsugi-closes-makes-all-technology-and-research-public/ / https://www.forbes.com/sites/victordey/2026/02/17/kintsugi-ceo-says-building-ai-for-healthcare-is-financially-unsustainable-for-startups/

### E-48 — Pear Therapeutics の破産【B】
DTxの世界的パイオニア。2023年4月 **Chapter 11申請、従業員の約92%をレイオフ**。2022年1〜9月の処方はわずか31,000件、うち実際に調剤されたのは58%。価格 3か月$1,300 が採用障壁。
https://insights.citeline.com/IV147722/Pear-Bankruptcy-Filing-Highlights-Reimbursement-Barriers-for-Digital-Therapeutics/

### E-44 — BetterHelp の減収【A/B】
**2026年通期売上見通し $770M〜$830M（前年比 −12.7%〜−19%）**。Q2 2026 は −12%（$212.6M）。原因は保険適用需要の伸びが cash pay ビジネスを侵食したこと。
https://www.healthcaredive.com/news/teladoc-lowers-revenue-guide-betterhelp-insurance-capacity-demand-q2-2026/826604/

### E-27 — 獲得コスト（CAC）【C】
テレヘルスD2Cの患者獲得コスト **$150〜$500**。DTC一般のブレンドCAC中央値 $60〜$120。有料ソーシャルCACは2020年比 **+30〜60%**。
https://www.brighterclick.com/blog-post/healthcare-marketing-trends / https://www.swell.is/content/dtc-ecommerce-statistics

### E-35 — VC の投資基準【B】
research2guidance「AI in Mental Health 2026: Clinical Infrastructure Wins the Funding Race – and Wellness Apps Are Priced Out」
https://research2guidance.com/ai-in-mental-health-2026-clinical-infrastructure-wins-the-funding-race-and-wellness-apps-are-priced-out/

- $20M超ラウンドに共通する3特性: ①**独自の臨床データとエビデンス**、②**B2B/B2B2C エコノミクス**、③**規制上の防御性**（EHR統合、CPTコード、FDAアラインメント）
- VCの発言: 「**We don't invest in an app without evidence of efficacy**」
- **「Human in the loop はもはや機能ではなく前提条件（precondition, not a feature）」**
- 資金が離れているカテゴリ: 汎用LLMチャットボット（default no）、瞑想/マインドフルネスアプリ（コモディティ化）、臨床統合のないコンパニオンボット（投資不可能）

### E-45 — 資金の流れ【B】
Rock Health: 2025年通年 米デジタルヘルス **$14.2B / 482件**（前年比+35%）。AI-enabled 企業が全ディールの50%・全資金の54%。**メンタルヘルスは7年連続で最も資金が集まる臨床領域**。
https://rockhealth.com/insights/2025-year-end-digital-health-funding-overview-a-tale-of-two-markets/ / https://hitconsultant.net/2026/07/13/rock-health-h1-2026-digital-health-funding-report/

### E-49 — CMS のDMHT償還【A】
2025年から HCPCS **G0552–G0554** で FDA基準を満たす Digital Mental Health Treatment 機器を Medicare 償還。**G0553: 月あたり最初の20分の治療管理で約 $20.06**、G0554: 追加20分ごとに約 $19.73。CY2026 最終規則で ADHD 向けに対象拡大。
https://www.aapc.com/blog/93026-medicare-implements-digital-mental-health-treatment-codes/

> **冷静な評価: 月$20〜$40の償還レートは、FDA承認取得コスト（Woebot・Kintsugi が払えなかった）を回収できる水準ではありません。「保険適用が開いた」という物語と実際の単価は乖離しています。**

参考【A】: 処方型DTx **Rejoyn**（Otsuka × Click Therapeutics）は2024年4月にFDAクリア、2025年6月に英国発売。**22歳以上・抗うつ薬服用中の外来患者に限定**。大手製薬のバランスシートが支えている点が Woebot / Kintsugi との違い。 https://www.otsuka-us.com/news/rejoyn-fda-authorized

---

## 引用してはいけないもの

以下は調査中に見つかったが、**社外資料に引用すべきでない**と判断したものです。

| 対象 | 理由 |
|---|---|
| gii.co.jp / globalresearch.co.jp / newscast.jp / researchnester.jp 等の市場規模データ | 海外レポートの翻訳転売。**同じ市場の数値が互いに数十倍単位で矛盾**。方法論非公開 |
| 「日本のメンタルヘルス市場 275億USD（約4兆円）」 | これは**精神科医療全体**の市場。セルフケアアプリ市場とは3桁違う可能性が高い |
| 「推し活市場 3.5兆円」 | 矢野経済研究所の1兆円と3倍以上乖離。定義が異なる（広義推計） |
| 一般アプリの30日継続率（29% / 43%等） | 出典間で数値が矛盾。根拠として使わない |
| ベンダー自称の継続率（SELF 45〜50%等） | 算出方法が非公開 |

---

## 調査で確認できなかったこと

| 項目 | 状態 |
|---|---|
| 日本国内メンタルヘルスアプリ市場の実額 | **信頼できる公開データが存在しない。** 国内専門のシード・プランニング調査は2022年3月版が最後で在庫終了 |
| E-29（implementation intentions のメタ分析） | 一次ソース未確認 |
| Awarefy for Biz の料金 | 非公開 |
| あすけん等の課金率・有料会員数 | 非開示 |
| ココロバランスの商標登録状況 | **未調査。法務確認が必要**（→ `01-concept.md#naming`） |
| 現行アプリの内部実装（柱の判定ロジック、充足度の定義、クライシス検知の有無） | ソースコード未参照（→ `00-current-state.md#3`） |
