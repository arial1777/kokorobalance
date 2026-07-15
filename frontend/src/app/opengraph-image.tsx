import { ImageResponse } from 'next/og';
import { RING_LOGO_DATA_URI } from '@/lib/brand';

export const alt = 'ココロバランス | 心の支えは、1本より3本。';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

async function loadGoogleFont(text: string, weight: 400 | 700) {
  const url = `https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@${weight}&text=${encodeURIComponent(text)}`;
  const css = await (await fetch(url)).text();
  const match = /src: url\(([^)]+)\) format\('(?:opentype|truetype)'\)/.exec(css);
  if (!match) throw new Error('Failed to resolve Noto Sans JP font resource');
  const fontResponse = await fetch(match[1]);
  return fontResponse.arrayBuffer();
}

export default async function Image() {
  const title = 'ココロバランス';
  const tagline = '心の支えは、1本より3本。';
  const sub = '心のポートフォリオを可視化するセルフケア支援アプリ';

  const text = `${title}${tagline}${sub}`;
  const [notoBold, notoRegular] = await Promise.all([
    loadGoogleFont(text, 700),
    loadGoogleFont(text, 400),
  ]);

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '64px',
          background: 'linear-gradient(135deg, #1A3352 0%, #0F1F35 100%)',
          fontFamily: '"Noto Sans JP"',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={RING_LOGO_DATA_URI} width={44} height={44} alt="" />
          <span style={{ fontSize: 28, fontWeight: 700, color: '#FAFAF7' }}>{title}</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <span style={{ fontSize: 60, fontWeight: 700, color: '#FAFAF7', lineHeight: 1.35 }}>
            {tagline}
          </span>
          <span style={{ fontSize: 26, fontWeight: 400, color: 'rgba(250,250,247,0.7)' }}>
            {sub}
          </span>
        </div>
        <span style={{ fontSize: 22, fontWeight: 400, color: 'rgba(250,250,247,0.6)' }}>
          kokorobalance.app
        </span>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: 'Noto Sans JP', data: notoBold, weight: 700, style: 'normal' },
        { name: 'Noto Sans JP', data: notoRegular, weight: 400, style: 'normal' },
      ],
    }
  );
}
