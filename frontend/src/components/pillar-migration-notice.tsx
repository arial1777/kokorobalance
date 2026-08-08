'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Icon } from '@/components/ui/icon';
import type { Profile } from '@/types';

/**
 * 柱の再定義の移行通知（07-spec-pillars.md §5、P-A-12）。一度閉じたら二度と出さない。
 * 「柱が減った」と受け取られる変更なので、必ず理由を添えて説明する。
 */
export function PillarMigrationNotice({ profile }: { profile: Profile | undefined }) {
  const qc = useQueryClient();

  const dismissMutation = useMutation({
    mutationFn: () => api.patch<Profile>('/profile', { pillarNoticeDismissed: true }),
    onSuccess: (updated) => qc.setQueryData(['profile'], updated),
  });

  if (!profile || profile.pillarNoticeDismissedAt) return null;

  return (
    <div className="bg-white rounded-2xl border border-border shadow-sm p-5">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">
          <Icon name="info" className="text-lg text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground mb-1.5">柱の考え方を見直しました</p>
          <p className="text-xs text-muted-foreground leading-relaxed mb-2">
            ひとりで完結するもの（睡眠・筋トレなど）は「習慣」に整理しました。
            <span className="font-semibold text-foreground">減ったわけではありません。</span>
            人や居場所とのつながりだけを「柱」と呼ぶことにしたのは、そこにいちばん確かな研究の裏付けがあるからです。
          </p>
          <p className="text-xs text-muted-foreground leading-relaxed mb-3">
            よければ、居場所を1つ登録してみませんか？
          </p>
          <div className="flex items-center gap-3">
            <Link
              href="/settings"
              className="text-xs font-semibold text-accent hover:underline"
              onClick={() => dismissMutation.mutate()}
            >
              柱を見に行く
            </Link>
            <button
              type="button"
              onClick={() => dismissMutation.mutate()}
              disabled={dismissMutation.isPending}
              className="text-xs text-muted-foreground disabled:opacity-40"
            >
              閉じる
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
