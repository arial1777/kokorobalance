/**
 * ペアで共有されるもの／されないものの説明（09-spec-pair.md PR-03 / PR-A-10）。
 * 成立時に**両者へ同じ内容**を出す。共有されないものを先に、具体的に書く。
 */
export function PairSharingNotice() {
  return (
    <div className="bg-secondary/50 rounded-2xl p-4 text-xs leading-relaxed">
      <p className="font-semibold text-foreground mb-2">相手に見えないもの</p>
      <ul className="text-muted-foreground space-y-1 mb-3">
        <li>・柱の名前（「Aさん」「木曜のバンド」など）</li>
        <li>・点検やふりかえりに書いたメモ</li>
        <li>・壁打ちの内容</li>
        <li>・柱の本数や構成の割合</li>
      </ul>
      <p className="font-semibold text-foreground mb-2">相手に見えるもの</p>
      <ul className="text-muted-foreground space-y-1">
        <li>・あなたの表示名</li>
        <li>・今週の点検をしたかどうか</li>
        <li>・柱の色（最大5つ・名前は出ません）</li>
        <li>・揺れそうな日が近いこと（日付のみ。タイトルは選んだときだけ）</li>
      </ul>
    </div>
  );
}
