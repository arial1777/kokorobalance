import { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Modal,
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { track } from '@/lib/analytics';
import { Icon } from '@/components/ui/icon';
import { AppHeader } from '@/components/ui/app-header';
import type { AiCoachMessage, ChatResult, CoachQuota, Profile } from '@/types';

const WEB_URL = process.env.EXPO_PUBLIC_WEB_URL ?? 'https://kokorobalance.example.com';

export default function CoachPage() {
  const qc = useQueryClient();
  const [input, setInput] = useState('');
  const [consentOpen, setConsentOpen] = useState(false);
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  const { data: profile } = useQuery<Profile>({
    queryKey: ['profile'],
    queryFn: () => api.get<Profile>('/profile'),
  });

  const { data: quota } = useQuery<CoachQuota>({
    queryKey: ['coach-quota'],
    queryFn: () => api.get<CoachQuota>('/coach/quota'),
  });

  const { data: messages = [], isLoading } = useQuery<AiCoachMessage[]>({
    queryKey: ['coach-messages'],
    queryFn: () => api.get<AiCoachMessage[]>('/coach/messages'),
  });

  const chatMutation = useMutation({
    mutationFn: (message: string) => api.post<ChatResult>('/coach/chat', { message }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['coach-messages'] });
      qc.invalidateQueries({ queryKey: ['coach-quota'] });
      track('coach_chat_sent');
      setInput('');
    },
    onError: (err: Error & { status?: number }, message) => {
      if (err.status === 428) {
        setPendingMessage(message);
        setConsentOpen(true);
      }
      if (err.status === 403) track('coach_quota_exhausted');
      qc.invalidateQueries({ queryKey: ['coach-quota'] });
    },
  });

  const consentMutation = useMutation({
    mutationFn: () => api.post('/profile/ai-consent'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['profile'] });
      setConsentOpen(false);
      if (pendingMessage) {
        chatMutation.mutate(pendingMessage);
        setPendingMessage(null);
      }
    },
  });

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [messages, chatMutation.isPending]);

  function handleSend() {
    const message = input.trim();
    if (!message) return;
    if (profile && !profile.aiConsentAt) {
      setPendingMessage(message);
      setConsentOpen(true);
      return;
    }
    chatMutation.mutate(message);
  }

  const isFree = quota?.plan !== 'pro';
  const exhausted = isFree && quota?.remaining === 0;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 bg-background">
      <AppHeader
        title="AIコーチ"
        subtitle="心のバランス相談"
        right={
          quota ? (
            isFree ? (
              <View className="rounded-full bg-secondary px-2.5 py-1">
                <Text className="text-[11px] font-semibold text-muted-foreground">今月あと{quota.remaining}回</Text>
              </View>
            ) : (
              <View className="rounded-full bg-accent/10 px-2.5 py-1">
                <Text className="text-[11px] font-semibold text-accent">Pro</Text>
              </View>
            )
          ) : undefined
        }
      />

      <ScrollView ref={scrollRef} contentContainerClassName="gap-4 px-4 py-4">
        {isLoading && <Text className="text-center text-sm text-muted-foreground">読み込み中...</Text>}
        {messages.length === 0 && !isLoading && (
          <View className="mt-12 items-center">
            <View className="mb-3 h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
              <Icon name="smart_toy" filled size={28} color="#1A3352" />
            </View>
            <Text className="text-sm text-muted-foreground">何でも話しかけてください</Text>
            {isFree && quota && (
              <Text className="mt-2 text-xs text-muted-foreground">無料プランでは月{quota.limit}回まで話せます</Text>
            )}
          </View>
        )}
        {messages.map((msg) => (
          <View key={msg.id} className={`flex-row ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <View
              className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
                msg.role === 'user'
                  ? 'rounded-br-sm bg-primary'
                  : msg.isCrisis
                    ? 'rounded-bl-sm border border-sky-200 bg-sky-50 shadow-sm'
                    : 'rounded-bl-sm border border-border bg-white shadow-sm'
              }`}
            >
              <Text className={`text-sm leading-relaxed ${msg.role === 'user' ? 'text-white' : 'text-foreground'}`}>
                {msg.content}
              </Text>
            </View>
          </View>
        ))}
        {chatMutation.isPending && (
          <View className="flex-row justify-start">
            <View className="rounded-2xl rounded-bl-sm border border-border bg-white px-4 py-2.5 shadow-sm">
              <Text className="text-sm text-muted-foreground">考え中...</Text>
            </View>
          </View>
        )}

        {exhausted && (
          <View className="items-center rounded-2xl border border-border bg-white p-5 shadow-sm">
            <Text className="mb-1 text-sm font-semibold text-foreground">今月の無料分を使い切りました</Text>
            <Text className="mb-3 text-center text-xs leading-relaxed text-muted-foreground">
              Proプランなら回数無制限で、週間レポートのAIコメントも読めます
            </Text>
            <Pressable
              onPress={() => WebBrowser.openBrowserAsync(`${WEB_URL}/pricing`)}
              className="rounded-xl bg-accent px-5 py-2.5 shadow-sm"
            >
              <Text className="text-sm font-semibold text-white">Proプランを見る</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>

      <View className="border-t border-border bg-background px-4 pb-3 pt-2">
        <View className="flex-row gap-2 rounded-2xl border border-border bg-white p-2 shadow-sm">
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder={exhausted ? '今月の無料分を使い切りました' : '今日の気持ちを話してみて...'}
            editable={!exhausted}
            placeholderTextColor="#6B584880"
            className="flex-1 px-2 text-sm text-foreground"
          />
          <Pressable
            onPress={handleSend}
            disabled={!input.trim() || chatMutation.isPending || exhausted}
            className={`flex-row items-center gap-1 rounded-xl bg-accent px-4 py-2 ${
              !input.trim() || chatMutation.isPending || exhausted ? 'opacity-40' : ''
            }`}
          >
            <Icon name="send" filled size={16} color="#FFFFFF" />
            <Text className="text-sm font-semibold text-white">送信</Text>
          </Pressable>
        </View>
        <Text className="mt-1.5 text-center text-[10px] leading-relaxed text-muted-foreground">
          AIコーチは医療行為・診断ではありません。つらいときは{' '}
          <Text className="text-accent" onPress={() => WebBrowser.openBrowserAsync(`${WEB_URL}/support-resources`)}>
            相談窓口
          </Text>
          （よりそいホットライン 0120-279-338・24時間無料）へ
        </Text>
      </View>

      <Modal visible={consentOpen} transparent animationType="fade">
        <View className="flex-1 items-center justify-center bg-black/40 px-6">
          <View className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <View className="mb-4 h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
              <Icon name="shield" filled size={24} color="#1A3352" />
            </View>
            <Text className="mb-2 text-lg font-bold text-foreground">AIコーチを始める前に</Text>
            <Text className="mb-4 text-sm leading-relaxed text-muted-foreground">
              AIコーチとの会話内容と、あなたの心のデータ（ポートフォリオ・柱・揺らぎ）は、応答生成のためにAI（Google
              Cloud上のClaude）へ送信されます。
            </Text>
            <View className="mb-5 gap-1.5">
              <Text className="text-xs leading-relaxed text-muted-foreground">
                ・データが広告や第三者提供に使われることはありません
              </Text>
              <Text className="text-xs leading-relaxed text-muted-foreground">・AIコーチは医療行為・診断を行いません</Text>
              <Text className="text-xs leading-relaxed text-muted-foreground">・同意はいつでも設定から取り消せます</Text>
            </View>
            <View className="flex-row gap-2">
              <Pressable
                onPress={() => {
                  setConsentOpen(false);
                  setPendingMessage(null);
                }}
                className="flex-1 rounded-xl border border-border py-2.5"
              >
                <Text className="text-center text-sm font-semibold text-muted-foreground">キャンセル</Text>
              </Pressable>
              <Pressable
                onPress={() => consentMutation.mutate()}
                disabled={consentMutation.isPending}
                className={`flex-1 rounded-xl bg-accent py-2.5 ${consentMutation.isPending ? 'opacity-50' : ''}`}
              >
                <Text className="text-center text-sm font-semibold text-white">
                  {consentMutation.isPending ? '設定中…' : '同意して始める'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}
