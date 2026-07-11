import { Injectable } from '@nestjs/common';

/**
 * 希死念慮・自傷を示唆する入力の検知（v2 §7.2）。
 * まずキーワードで判定し、AIコーチのシステムプロンプト側の指示と二重防御にする。
 * 記録メモなど他の入力にも将来適用できるよう独立サービスとして持つ。
 */
@Injectable()
export class CrisisDetectorService {
  /** 直接的な表現（即時にクライシス扱い） */
  private static readonly HARD_KEYWORDS = [
    '死にたい',
    '死のう',
    '死んだほうが',
    '死んだ方が',
    '自殺',
    '自傷',
    'リストカット',
    'リスカ',
    'OD',
    'オーバードーズ',
    '消えたい',
    '消えてしまいたい',
    'いなくなりたい',
    '生きていたくない',
    '生きるのをやめ',
    '生きる意味がない',
    '終わりにしたい',
    '楽になりたい',
    '首を吊',
    '飛び降り',
  ];

  detect(message: string): boolean {
    const normalized = message.normalize('NFKC').toLowerCase();
    return CrisisDetectorService.HARD_KEYWORDS.some((kw) =>
      normalized.includes(kw.toLowerCase()),
    );
  }

  /** クライシス検知時の固定応答（相談窓口の案内） */
  buildCrisisReply(): string {
    return [
      '話してくれてありがとうございます。いま、とてもつらい状況なのですね。あなたの気持ちはとても大切です。',
      '',
      '私はAIで、専門的な支援はできません。つらい気持ちが続くときは、ひとりで抱えずに、専門の相談窓口に話してみてください。',
      '',
      '📞 よりそいホットライン 0120-279-338（24時間・無料）',
      '📞 いのちの電話 0570-783-556（10時〜22時）',
      '📞 こころの健康相談統一ダイヤル 0570-064-556',
      '',
      'あなたが少しでも安心して過ごせることが、いちばん大切です。',
    ].join('\n');
  }
}
