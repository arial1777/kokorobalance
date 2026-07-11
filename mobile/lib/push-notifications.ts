import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { api } from './api';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/**
 * 通知許可を確認・要求し、Expoプッシュトークンをバックエンドに登録する。
 * シミュレータや許可拒否時はfalseを返すが、呼び出し側はこれをエラー扱いしない
 * （バックエンドは未登録ユーザーへメールにフォールバックするため）。
 */
export async function registerForPushNotifications(): Promise<boolean> {
  if (!Device.isDevice) return false;

  const existing = await Notifications.getPermissionsAsync();
  let granted = existing.granted;
  if (!granted) {
    const requested = await Notifications.requestPermissionsAsync();
    granted = requested.granted;
  }
  if (!granted) return false;

  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });

  await api.post('/profile/push-token', { token });
  return true;
}
