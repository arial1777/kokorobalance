import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleAuth } from 'google-auth-library';

export interface GeminiMessage {
  role: 'user' | 'assistant';
  content: string;
}

@Injectable()
export class GeminiService {
  private readonly model: string;
  private readonly projectId: string;
  private readonly location: string;
  // Vertex AI の generateContent は API キーでなく OAuth2 を要求するため、
  // ADC(ローカルは gcloud auth application-default login、Cloud Runはアタッチされたサービスアカウント)経由でトークンを取得する
  private readonly auth = new GoogleAuth({ scopes: 'https://www.googleapis.com/auth/cloud-platform' });

  constructor(config: ConfigService) {
    this.model = config.get<string>('GEMINI_MODEL') ?? 'gemini-3.5-flash';
    this.projectId = config.get<string>('GEMINI_PROJECT_ID') ?? '';
    this.location = config.get<string>('GEMINI_LOCATION') ?? 'global';
  }

  async generate(
    systemPrompt: string,
    messages: GeminiMessage[],
    options?: { responseMimeType?: string; timeoutMs?: number },
  ): Promise<string> {
    const host = this.location === 'global' ? 'aiplatform.googleapis.com' : `${this.location}-aiplatform.googleapis.com`;
    const url = `https://${host}/v1/projects/${this.projectId}/locations/${this.location}/publishers/google/models/${this.model}:generateContent`;
    const accessToken = await this.auth.getAccessToken();

    const controller = new AbortController();
    const timeout = options?.timeoutMs
      ? setTimeout(() => controller.abort(), options.timeoutMs)
      : null;

    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: messages.map((m) => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: m.content }],
          })),
          ...(options?.responseMimeType && {
            generationConfig: { responseMimeType: options.responseMimeType },
          }),
        }),
        signal: controller.signal,
      });
    } finally {
      if (timeout) clearTimeout(timeout);
    }

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
