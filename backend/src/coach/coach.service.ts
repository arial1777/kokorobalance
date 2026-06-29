import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { AiCoachMessage } from './ai-coach-message.entity';
import { PortfolioService } from '../portfolio/portfolio.service';

const STUB_REPLIES = [
  'ポートフォリオを確認しました。最近は特定のカテゴリに偏りが出てきていますね。今週は普段やらないことを一つ試してみませんか？',
  'よく話してくれました。心のバランスを保つには、小さな楽しみを複数持つことが大切です。今日は5分だけ好きな音楽を聴いてみてください。',
  '記録を見ると、少し特定のカテゴリへの依存が増えています。友達に連絡を一本入れてみるのはいかがでしょうか？',
  'ありがとうございます。今のポートフォリオは悪くないですが、健康カテゴリが少し薄いですね。明日の朝、10分だけ散歩してみましょう。',
];

@Injectable()
export class CoachService {
  private readonly isStub: boolean;
  private stubReplyIndex = 0;

  constructor(
    @InjectRepository(AiCoachMessage)
    private readonly messageRepo: Repository<AiCoachMessage>,
    private readonly portfolioService: PortfolioService,
    private readonly config: ConfigService,
  ) {
    this.isStub = config.get<string>('AI_STUB') === 'true' || config.get<string>('NODE_ENV') !== 'production';
  }

  getMessages(userId: string): Promise<AiCoachMessage[]> {
    return this.messageRepo.find({
      where: { userId },
      order: { createdAt: 'ASC' },
      take: 50,
    });
  }

  async chat(userId: string, userMessage: string): Promise<{ reply: string; messageId: string }> {
    const reply = this.isStub
      ? await this.stubReply()
      : await this.callVertexAI(userId, userMessage);

    await this.messageRepo.save([
      this.messageRepo.create({ userId, role: 'user', content: userMessage }),
      this.messageRepo.create({ userId, role: 'assistant', content: reply }),
    ]);

    const saved = await this.messageRepo.findOne({
      where: { userId, role: 'assistant', content: reply },
      order: { createdAt: 'DESC' },
    });

    return { reply, messageId: saved!.id };
  }

  private async stubReply(): Promise<string> {
    // 一定間隔でローテーションするだけのスタブ
    const reply = STUB_REPLIES[this.stubReplyIndex % STUB_REPLIES.length];
    this.stubReplyIndex++;
    return reply;
  }

  private async callVertexAI(userId: string, userMessage: string): Promise<string> {
    // 本番のみ動的 import でロード（ローカルでは呼ばれない）
    const { default: AnthropicVertex } = await import('@anthropic-ai/vertex-sdk');

    const client = new AnthropicVertex({
      projectId: this.config.get<string>('VERTEX_PROJECT_ID') ?? 'orange-note-dev',
      region: this.config.get<string>('VERTEX_REGION') ?? 'us-east5',
    });

    const portfolio = await this.portfolioService.getPortfolio(userId, 30);
    const history = await this.messageRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: 10,
    });

    const systemPrompt = `あなたはメンタルヘルスの心のバランスコーチです。
ユーザーの心のポートフォリオデータをもとに、共感的で具体的なアドバイスを日本語で返してください。

## 現在のポートフォリオ（過去30日）
${portfolio.breakdown.map((b) => `- ${b.categoryName}: ${b.percentage}%`).join('\n')}

## 分散指数スコア: ${portfolio.diversityScore}点
${portfolio.alert.exists ? `## 偏りアラート: ${portfolio.alert.message}` : ''}

## ルール
- 200文字以内で簡潔に返答する
- 具体的な行動を1つ提案する
- 医療・診断的なアドバイスはしない
- 必ず共感を示してから提案する`;

    const messages = history
      .reverse()
      .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));
    messages.push({ role: 'user', content: userMessage });

    const response = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 300,
      system: systemPrompt,
      messages,
    });

    return response.content[0].type === 'text' ? response.content[0].text : '';
  }
}
