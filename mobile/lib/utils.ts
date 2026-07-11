/** JST基準の今日の日付（YYYY-MM-DD）。UTCベースのtoISOString()は朝9時前に前日になるため使わない */
export function todayJST(): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Tokyo' }).format(new Date());
}
