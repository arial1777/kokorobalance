import { View, Text } from 'react-native';

/**
 * ペアで共有されるもの／されないものの説明（09-spec-pair.md PR-03 / PR-A-10）。
 * 成立時に**両者へ同じ内容**を出す。共有されないものを先に、具体的に書く。
 */
export function PairSharingNotice() {
  return (
    <View className="rounded-2xl bg-secondary/50 p-4">
      <Text className="mb-2 text-xs font-semibold text-foreground">相手に見えないもの</Text>
      <View className="mb-3 gap-1">
        {[
          '柱の名前（「Aさん」「木曜のバンド」など）',
          '点検やふりかえりに書いたメモ',
          '壁打ちの内容',
          '柱の本数や構成の割合',
        ].map((t) => (
          <Text key={t} className="text-xs leading-relaxed text-muted-foreground">
            ・{t}
          </Text>
        ))}
      </View>
      <Text className="mb-2 text-xs font-semibold text-foreground">相手に見えるもの</Text>
      <View className="gap-1">
        {[
          'あなたの表示名',
          '今週の点検をしたかどうか',
          '柱の色（最大5つ・名前は出ません）',
          '揺れそうな日が近いこと（日付のみ。タイトルは選んだときだけ）',
        ].map((t) => (
          <Text key={t} className="text-xs leading-relaxed text-muted-foreground">
            ・{t}
          </Text>
        ))}
      </View>
    </View>
  );
}
