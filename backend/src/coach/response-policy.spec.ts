import { containsForbiddenStats, exceedsLength, isRepeatedStockPhrase, selectResponseType } from './response-policy';

describe('selectResponseType', () => {
  it('明示的にアドバイスを求める発話は型C', () => {
    expect(selectResponseType('どうしたらいいですか', 3, false)).toBe('C');
    expect(selectResponseType('アドバイスをください', 0, false)).toBe('C');
  });

  it('揺れそうな日がD-7以内かつ2往復目以降は型D', () => {
    expect(selectResponseType('最近どうも落ち着かなくて', 2, true)).toBe('D');
  });

  it('揺れが近くても1往復目は型Dにしない', () => {
    expect(selectResponseType('最近どうも落ち着かなくて', 0, true)).not.toBe('D');
  });

  it('1往復目の短い曖昧な発話は型B', () => {
    expect(selectResponseType('しんどい', 0, false)).toBe('B');
  });

  it('該当しない場合は型A', () => {
    expect(selectResponseType('今日は友達とカフェに行って、その後映画も見て、とても楽しい一日でした', 0, false)).toBe('A');
  });
});

describe('containsForbiddenStats', () => {
  it('パーセント・回数・pt・本数の引用を検出する', () => {
    expect(containsForbiddenStats('今週は20%でした')).toBe(true);
    expect(containsForbiddenStats('週0.3回のペースです')).toBe(true);
    expect(containsForbiddenStats('3pt増えました')).toBe(true);
    expect(containsForbiddenStats('柱が3本あります')).toBe(true);
  });

  it('カレンダー上の残り日数の言及は対象外', () => {
    expect(containsForbiddenStats('あと5日ですね')).toBe(false);
  });

  it('数値を含まない文は検出しない', () => {
    expect(containsForbiddenStats('よく話してくれましたね')).toBe(false);
  });
});

describe('isRepeatedStockPhrase', () => {
  it('直前の応答と完全一致する場合に検出する', () => {
    expect(isRepeatedStockPhrase('無理をなさらないでくださいね', '無理をなさらないでくださいね')).toBe(true);
  });

  it('直前の応答がない場合は検出しない', () => {
    expect(isRepeatedStockPhrase('無理をなさらないでくださいね', null)).toBe(false);
  });

  it('内容が異なる場合は検出しない', () => {
    expect(isRepeatedStockPhrase('そうなんですね', '無理をなさらないでくださいね')).toBe(false);
  });
});

describe('exceedsLength', () => {
  it('200文字を超える場合にtrueを返す', () => {
    expect(exceedsLength('あ'.repeat(201))).toBe(true);
    expect(exceedsLength('あ'.repeat(200))).toBe(false);
  });
});
