'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { getSocket } from '../lib/socket';
import { ChatMessage } from '../types/socket';

interface ChatPanelProps {
  roomId: string;
  playerId: string;
}

const MAX_KEEP = 100;   // メモリに残す件数
const SHOW_LINES = 5;   // オーバーレイに出す直近の件数

// 部屋の中のチャット（TikTok Live風）。
// ・直近5件くらいを画面左下にオーバーレイ表示（タップはゲームに通す）
// ・入力欄はフッター固定。キーボードが出たら追従して上がる（対応端末のみ）
export function ChatPanel({ roomId, playerId }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [kbOffset, setKbOffset] = useState(0);

  // チャット受信
  useEffect(() => {
    const socket = getSocket();
    const onMessage = (msg: ChatMessage) => {
      setMessages((prev) => {
        const next = [...prev, msg];
        return next.length > MAX_KEEP ? next.slice(next.length - MAX_KEEP) : next;
      });
    };
    socket.on('chat:message', onMessage);
    return () => {
      socket.off('chat:message', onMessage);
    };
  }, []);

  // キーボード追従（VisualViewport が使える端末のみ。iOS Safari などで有効）
  useEffect(() => {
    const vv = typeof window !== 'undefined' ? window.visualViewport : null;
    if (!vv) return;
    const onResize = () => {
      const offset = window.innerHeight - (vv.height + vv.offsetTop);
      setKbOffset(offset > 0 ? offset : 0);
    };
    vv.addEventListener('resize', onResize);
    vv.addEventListener('scroll', onResize);
    onResize();
    return () => {
      vv.removeEventListener('resize', onResize);
      vv.removeEventListener('scroll', onResize);
    };
  }, []);

  const send = useCallback(() => {
    const text = draft.trim();
    if (!text) return;
    getSocket().emit('chat:send', { roomId, text });
    setDraft('');
  }, [draft, roomId]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
      e.preventDefault();
      send();
    }
  };

  const recent = messages.slice(-SHOW_LINES);

  return (
    <div
      className="fixed left-0 right-0 z-40 pointer-events-none"
      style={{ bottom: kbOffset }}
    >
      {/* 直近メッセージのオーバーレイ（ゲームの上に重ねる・タップは通す） */}
      <div className="px-3 pb-2 flex flex-col gap-1.5 justify-end">
        {recent.map((m) => {
          const mine = m.playerId === playerId;
          return (
            <div key={m.id} className="max-w-[80%] w-fit">
              <div className="inline-block rounded-2xl bg-black/55 backdrop-blur-sm px-3 py-1.5 text-sm text-white leading-snug">
                <span className={`font-semibold mr-1.5 ${mine ? 'text-amber-300' : 'text-sky-300'}`}>
                  {m.playerName}
                </span>
                <span className="break-words">{m.text}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* フッター固定の入力欄 */}
      <div
        className="pointer-events-auto flex items-center gap-2 px-3 py-2 bg-surface/95 backdrop-blur border-t border-line"
        style={{ paddingBottom: kbOffset > 0 ? 8 : 'calc(8px + env(safe-area-inset-bottom))' }}
      >
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          maxLength={200}
          placeholder="入力..."
          className="flex-1 min-w-0 px-4 py-2 rounded-full border border-line bg-surface-2 text-sm text-ink placeholder:text-muted focus:outline-none focus:border-accent"
        />
        <button
          onClick={send}
          disabled={!draft.trim()}
          aria-label="送信"
          className="shrink-0 w-9 h-9 rounded-full bg-ink text-white disabled:bg-line disabled:text-muted flex items-center justify-center active:scale-95 transition"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </button>
      </div>
    </div>
  );
}
