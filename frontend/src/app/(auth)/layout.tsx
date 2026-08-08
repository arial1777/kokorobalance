import type { Metadata } from 'next';

/**
 * /login と /signup はランディングから強くリンクされているので Google に必ず発見される。
 * robots.txt でブロックすると noindex を読んでもらえずURLだけ索引される恐れがあるため、
 * クロールは許可した上で noindex を返して確実に索引から外す。
 * ログイン済みユーザーには middleware が /dashboard へリダイレクトする点も同様。
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
