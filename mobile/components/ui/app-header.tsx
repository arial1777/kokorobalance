import type { ReactNode } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from './icon';

interface AppHeaderProps {
  title: string;
  subtitle?: string;
  back?: boolean;
  right?: ReactNode;
}

export function AppHeader({ title, subtitle, back = false, right }: AppHeaderProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={{ paddingTop: insets.top }}
      className="border-b border-border bg-background"
    >
      <View className="h-14 flex-row items-center gap-3 px-4">
        {back ? (
          <Pressable
            onPress={() => router.back()}
            className="-ml-1 h-9 w-9 items-center justify-center rounded-xl active:bg-secondary"
          >
            <Icon name="arrow_back" size={20} color="#18130A" />
          </Pressable>
        ) : null}

        <View className="min-w-0 flex-1">
          {subtitle ? (
            <Text className="mb-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {subtitle}
            </Text>
          ) : null}
          <Text numberOfLines={1} className="text-base font-bold leading-tight text-foreground">
            {title}
          </Text>
        </View>

        {right ? <View>{right}</View> : null}
      </View>
    </View>
  );
}
