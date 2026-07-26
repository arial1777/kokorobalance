import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** JST基準の今日の日付（YYYY-MM-DD）。UTCベースのtoISOString()は朝9時前に前日になるため使わない */
export function todayJST(): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Tokyo' }).format(new Date())
}

/** 4時始まりの「今日」（YYYY-MM-DD）。深夜0時〜3:59は前日として扱う。記録・AIコーチの日次リセット用 */
export function activeDayJST(): string {
  const shifted = new Date(Date.now() - 4 * 60 * 60 * 1000)
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Tokyo' }).format(shifted)
}

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
