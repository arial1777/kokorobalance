import { api } from './api';

/** KPI計測イベント送信。fire-and-forgetで失敗してもUXに影響させない。 */
export function track(eventName: string, properties: Record<string, unknown> = {}): void {
  api.post('/events', { eventName, properties }).catch(() => {});
}
