import { sanitizeEventProperties } from './event-properties';

describe('sanitizeEventProperties', () => {
  it('自由記述の本文を落とす（ME-01）', () => {
    const result = sanitizeEventProperties({
      note: '今日はしんどかった',
      moodNote: '誰にも言えないこと',
      content: '壁打ちで話した内容',
      reply: 'AIの応答',
    });
    expect(result).toEqual({});
  });

  it('柱のラベルを落とし、kind だけを残す（ME-02）', () => {
    const result = sanitizeEventProperties({
      name: '木曜のバンド',
      label: 'Aさん',
      categoryName: 'ないしょの相手',
      pillarLabel: 'ひみつ',
      kind: 'place',
      categoryId: '3f2504e0-4f89-11d3-9a0c-0305e82c3301',
    });
    expect(result).toEqual({
      kind: 'place',
      categoryId: '3f2504e0-4f89-11d3-9a0c-0305e82c3301',
    });
  });

  it('揺れイベントのタイトルを落とす', () => {
    const result = sanitizeEventProperties({ title: '推しの卒業ライブ', category: 'oshi' });
    expect(result).toEqual({ category: 'oshi' });
  });

  it('許可リストにないキーは通さない', () => {
    expect(sanitizeEventProperties({ somethingNew: 'value' })).toEqual({});
  });

  it('長すぎる文字列は自由記述とみなして落とす', () => {
    const result = sanitizeEventProperties({ category: 'あ'.repeat(41), kind: 'habit' });
    expect(result).toEqual({ kind: 'habit' });
  });

  it('配列・オブジェクトは中に本文が混ざりうるので通さない', () => {
    const result = sanitizeEventProperties({
      category: ['oshi', '本文が混ざる'],
      kind: { nested: '本文' },
      count: 3,
    });
    expect(result).toEqual({ count: 3 });
  });

  it('数値・真偽値・列挙値は通す', () => {
    const result = sanitizeEventProperties({
      count: 5,
      granted: true,
      wasSupported: 'yes',
      source: 'pair',
    });
    expect(result).toEqual({ count: 5, granted: true, wasSupported: 'yes', source: 'pair' });
  });

  it('null / undefined は保存しない', () => {
    expect(sanitizeEventProperties({ kind: null, category: undefined, count: 0 })).toEqual({ count: 0 });
  });
});
