import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface GeminiMessage {
  role: 'user' | 'assistant';
  content: string;
}

@Injectable()
export class GeminiService {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly projectId: string;
  private readonly location: string;

  constructor(config: ConfigService) {
    this.apiKey = config.get<string>('GEMINI_API_KEY') ?? '';
    this.model = config.get<string>('GEMINI_MODEL') ?? 'gemini-3.5-flash';
    this.projectId = config.get<string>('GEMINI_PROJECT_ID') ?? '';
    this.location = config.get<string>('GEMINI_LOCATION') ?? 'global';
  }

  async generate(systemPrompt: string, messages: GeminiMessage[]): Promise<string> {
    const host = this.location === 'global' ? 'aiplatform.googleapis.com' : `${this.location}-aiplatform.googleapis.com`;
    const url = `https://${host}/v1/projects/${this.projectId}/locations/${this.location}/publishers/google/models/${this.model}:generateContent?key=${this.apiKey}`;

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: messages.map((m) => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }],
        })),
      }),
    });

    if (!res.ok) {
      const errorBody = await res.text();
      throw new Error(`Gemini API error (${res.status}): ${errorBody}`);
    }

    const data = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    return data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  }
}
