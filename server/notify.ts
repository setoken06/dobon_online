import { GameHistoryEntry } from '../src/types/room';

// 対戦結果を Discord の webhook に通知する。
// webhook URL は環境変数 DISCORD_RESULT_WEBHOOK から読む（未設定なら何もしない）。
// 通知の失敗はゲーム進行に一切影響させない（投げっぱなし・例外は握りつぶす）。
export async function notifyGameResult(entry: GameHistoryEntry): Promise<void> {
  const url = process.env.DISCORD_RESULT_WEBHOOK;
  if (!url) return;
  try {
    const yen = (n: number) => n.toLocaleString('ja-JP');

    const tags: string[] = [];
    if (entry.isDobonGaeshi) tags.push('ドボン返し');
    if (entry.isWorst) tags.push('ワースト');
    if (entry.isOnanii) tags.push('オナニー(ツモドボン自滅)');

    const winnerLines = entry.winners
      .map((w) => `🏆 ${w.playerName}　+${yen(w.score)}点`)
      .join('\n');
    const loserLine = entry.loserName
      ? `😵 ${entry.loserName}　-${yen(entry.totalScore)}点`
      : '';

    const content = [
      '🀄 **ドボン結果**',
      winnerLines,
      loserLine,
      tags.length ? `（${tags.join(' / ')}）` : '',
    ].filter(Boolean).join('\n');

    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    });
  } catch {
    // 通知失敗は無視
  }
}
