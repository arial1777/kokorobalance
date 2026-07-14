import { View, Text, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useToastStore } from '@/store/toast';

export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);
  const insets = useSafeAreaInsets();

  if (toasts.length === 0) return null;

  return (
    <View
      pointerEvents="box-none"
      className="absolute inset-x-0 items-center gap-2 px-4"
      style={{ bottom: insets.bottom + 84 }}
    >
      {toasts.map((t) => (
        <Pressable
          key={t.id}
          onPress={() => dismiss(t.id)}
          className={`w-full max-w-sm rounded-xl px-4 py-3 shadow-lg ${
            t.variant === 'error' ? 'bg-rose-500' : 'bg-foreground'
          }`}
        >
          <Text className="text-sm font-medium text-white">{t.message}</Text>
        </Pressable>
      ))}
    </View>
  );
}
