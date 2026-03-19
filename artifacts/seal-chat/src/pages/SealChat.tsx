/**
 * あざらしチャット - メインコンポーネント
 * Supabase Realtimeを使ったリアルタイムチャット広場
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabase";

// ==============================
// 定数・型定義
// ==============================

/** 同時接続の最大人数 */
const MAX_USERS = 10;

/** ランダムなユーザーIDを生成（セッションごとに一意） */
const MY_USER_ID = `seal_${Math.random().toString(36).slice(2, 8)}`;

/**
 * アバターカラーの定義（虹色7色 + 白・黒 = 合計9色）
 * body: アザラシの体色
 * border: ふちどり色
 * label: 表示名
 */
const AVATAR_COLORS: { label: string; body: string; border: string }[] = [
  { label: "赤",  body: "#FFB3B3", border: "#D04040" },
  { label: "橙",  body: "#FFD1A3", border: "#D07820" },
  { label: "黄",  body: "#FFF0A0", border: "#B8A000" },
  { label: "緑",  body: "#B3F0C8", border: "#2A9A55" },
  { label: "水色", body: "#B0E4FF", border: "#2288BB" },
  { label: "青",  body: "#B3C8FF", border: "#2244BB" },
  { label: "紫",  body: "#D8B3FF", border: "#7722BB" },
  { label: "白",  body: "#F8F8F8", border: "#AAAAAA" }, // 追加：白
  { label: "黒",  body: "#555555", border: "#111111" }, // 追加：黒
];

/** 吹き出し1件のデータ型 */
interface ChatMessage {
  id: string;      // 一意なID（ユーザーID + 送信時刻）
  text: string;    // メッセージ本文
  sentAt: number;  // 送信時刻（Unixミリ秒）
}

/** プレイヤーの状態型（Supabase Presenceで全員と共有） */
interface PlayerState {
  userId: string;
  name: string;
  x: number;
  y: number;
  messages: ChatMessage[];  // 最新3件のメッセージ
  colorIndex: number;       // AVATAR_COLORSのインデックス
  updatedAt: number;
}

// ==============================
// 入室画面コンポーネント
// ==============================

interface LobbyProps {
  /** 入室確定時のコールバック */
  onJoin: (name: string, colorIndex: number) => void;
  /** 満員かどうか */
  isFull: boolean;
}

function LobbyScreen({ onJoin, isFull }: LobbyProps) {
  const [name, setName] = useState("");
  const [colorIndex, setColorIndex] = useState(0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || isFull) return;
    onJoin(name.trim(), colorIndex);
  };

  return (
    <div style={{
      width: "100vw",
      height: "100vh",
      background: "linear-gradient(135deg, #FFF0F8 0%, #F0F0FF 50%, #F0FFF8 100%)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "'Kosugi Maru', 'Comic Sans MS', 'Hiragino Maru Gothic Pro', cursive",
    }}>
      <div style={{
        background: "rgba(255,255,255,0.93)",
        borderRadius: "28px",
        border: "3px solid #D0A8F0",
        padding: "36px 44px",
        minWidth: "360px",
        maxWidth: "460px",
        boxShadow: "4px 6px 0 rgba(180,140,220,0.18)",
        textAlign: "center",
      }}>
        {/* タイトル */}
        <div style={{ fontSize: "26px", fontWeight: "bold", color: "#7A45AA", marginBottom: "6px" }}>
          🦭 あざらしチャット 🦭
        </div>
        <div style={{ fontSize: "13px", color: "#AAA", marginBottom: "26px" }}>
          あなたのアザラシを設定してね
        </div>

        {/* 満員時の警告メッセージ */}
        {isFull && (
          <div style={{
            background: "#FFF0F0",
            border: "2px solid #FFAAAA",
            borderRadius: "14px",
            padding: "12px",
            marginBottom: "20px",
            color: "#CC4444",
            fontSize: "14px",
            lineHeight: "1.6",
          }}>
            🚫 広場が満員です（最大{MAX_USERS}人）<br />
            しばらくしてから入室してね
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* 名前入力フィールド */}
          <div style={{ marginBottom: "22px", textAlign: "left" }}>
            <label style={{ fontSize: "13px", color: "#666", display: "block", marginBottom: "6px" }}>
              🐾 あなたのお名前
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="名前を入力..."
              maxLength={12}
              disabled={isFull}
              autoFocus
              style={{
                width: "100%",
                padding: "10px 14px",
                borderRadius: "14px",
                border: "2.5px solid #C8A0E8",
                background: isFull ? "#F5F5F5" : "#FDFAFF",
                fontFamily: "inherit",
                fontSize: "15px",
                color: "#333",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>

          {/* アバター色の選択（9色グリッド） */}
          <div style={{ marginBottom: "26px", textAlign: "left" }}>
            <label style={{ fontSize: "13px", color: "#666", display: "block", marginBottom: "10px" }}>
              🌈 アザラシの色（全{AVATAR_COLORS.length}色）
            </label>
            {/* 5列 + 4列のグリッドレイアウト */}
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", justifyContent: "center" }}>
              {AVATAR_COLORS.map((c, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setColorIndex(i)}
                  disabled={isFull}
                  title={c.label}
                  style={{
                    width: "44px",
                    height: "44px",
                    borderRadius: "50%",
                    border: colorIndex === i
                      ? `4px solid ${c.border}`
                      : "2.5px solid rgba(0,0,0,0.15)",
                    background: c.body,
                    cursor: isFull ? "not-allowed" : "pointer",
                    transform: colorIndex === i ? "scale(1.2)" : "scale(1)",
                    transition: "transform 0.15s, border 0.15s",
                    boxShadow: colorIndex === i
                      ? `0 0 0 2px white, 0 0 0 5px ${c.border}`
                      : "0 1px 3px rgba(0,0,0,0.1)",
                    flexShrink: 0,
                  }}
                />
              ))}
            </div>
            {/* 選択中の色名 */}
            <div style={{ textAlign: "center", marginTop: "10px", fontSize: "12px", color: "#999" }}>
              選択中:&nbsp;
              <span style={{
                display: "inline-block",
                width: "14px",
                height: "14px",
                borderRadius: "50%",
                background: AVATAR_COLORS[colorIndex].body,
                border: `1.5px solid ${AVATAR_COLORS[colorIndex].border}`,
                verticalAlign: "middle",
                marginRight: "4px",
              }} />
              {AVATAR_COLORS[colorIndex].label}
            </div>
          </div>

          {/* 入室ボタン */}
          <button
            type="submit"
            disabled={!name.trim() || isFull}
            style={{
              width: "100%",
              padding: "13px",
              borderRadius: "20px",
              border: "none",
              background: !name.trim() || isFull
                ? "#DDD"
                : "linear-gradient(135deg, #C878E8, #7888E8)",
              color: "white",
              fontWeight: "bold",
              fontSize: "16px",
              cursor: !name.trim() || isFull ? "not-allowed" : "pointer",
              fontFamily: "inherit",
              boxShadow: !name.trim() || isFull
                ? "none"
                : "0 3px 10px rgba(140,100,220,0.4)",
              transition: "all 0.2s",
              letterSpacing: "0.04em",
            }}
          >
            {isFull ? "満員です 🚫" : "広場に入る 🦭"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ==============================
// アザラシSVGコンポーネント
// ==============================

/** 手描き風のアザラシアバター（SVG） */
function SealAvatar({ bodyColor, borderColor }: { bodyColor: string; borderColor: string }) {
  return (
    <svg
      width="72"
      height="82"
      viewBox="0 0 120 135"
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: "block", filter: "drop-shadow(1px 2px 3px rgba(0,0,0,0.13))" }}
    >
      {/* 胴体（楕円） */}
      <ellipse cx="60" cy="82" rx="42" ry="48" fill={bodyColor} stroke={borderColor} strokeWidth="3.5" />
      {/* 頭（楕円） */}
      <ellipse cx="60" cy="38" rx="34" ry="30" fill={bodyColor} stroke={borderColor} strokeWidth="3.5" />
      {/* 左目：白目 */}
      <ellipse cx="47" cy="32" rx="6" ry="7" fill="white" stroke={borderColor} strokeWidth="2" />
      {/* 左目：黒目 */}
      <ellipse cx="47" cy="33" rx="3.5" ry="4" fill="#222" />
      {/* 左目：ハイライト */}
      <circle cx="48.5" cy="31.5" r="1.5" fill="white" />
      {/* 右目：白目 */}
      <ellipse cx="73" cy="32" rx="6" ry="7" fill="white" stroke={borderColor} strokeWidth="2" />
      {/* 右目：黒目 */}
      <ellipse cx="73" cy="33" rx="3.5" ry="4" fill="#222" />
      {/* 右目：ハイライト */}
      <circle cx="74.5" cy="31.5" r="1.5" fill="white" />
      {/* 鼻 */}
      <ellipse cx="60" cy="46" rx="7" ry="4.5" fill="#555" stroke={borderColor} strokeWidth="1.5" />
      {/* 左ひげ（2本） */}
      <line x1="30" y1="46" x2="50" y2="46" stroke="#777" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="30" y1="42" x2="50" y2="44" stroke="#777" strokeWidth="1.5" strokeLinecap="round" />
      {/* 右ひげ（2本） */}
      <line x1="70" y1="46" x2="90" y2="46" stroke="#777" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="70" y1="44" x2="90" y2="42" stroke="#777" strokeWidth="1.5" strokeLinecap="round" />
      {/* 左ひれ */}
      <ellipse cx="22" cy="87" rx="14" ry="9" fill={bodyColor} stroke={borderColor} strokeWidth="2.5" transform="rotate(-30 22 87)" />
      {/* 右ひれ */}
      <ellipse cx="98" cy="87" rx="14" ry="9" fill={bodyColor} stroke={borderColor} strokeWidth="2.5" transform="rotate(30 98 87)" />
      {/* しっぽ */}
      <ellipse cx="60" cy="128" rx="22" ry="9" fill={bodyColor} stroke={borderColor} strokeWidth="2.5" />
    </svg>
  );
}

// ==============================
// 吹き出しスタックコンポーネント
// ==============================

/**
 * アザラシの頭上に最大3つの吹き出しを縦に積み上げて表示する。
 * - 古いメッセージが上、新しいメッセージが下
 * - 発言がなければ非表示
 * - 横幅はテキストに応じて自然に広がり、全角15文字相当（約220px）を上限に改行
 * - 吹き出しは丸い楕円形、尻尾も丸く温かいデザイン
 */
function SpeechBubbleStack({ messages }: { messages: ChatMessage[] }) {
  // メッセージが0件なら何も表示しない（仕様：発言なしは非表示）
  if (messages.length === 0) return null;

  return (
    <div style={{
      position: "absolute",
      // アザラシの頭上に配置（bottom: 100% = アバターの上端）
      bottom: "calc(100% + 4px)",
      left: "50%",
      transform: "translateX(-50%)",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: "4px",
      zIndex: 20,
      // nowrap の吹き出しが自然な幅を確保できるよう最大幅を明示
      maxWidth: "300px",
    }}>
      {/* 古い順（上）から新しい順（下）に表示 */}
      {messages.map((msg, i) => {
        // 一番古い吹き出し（最大3件時の先頭）を少し薄くして「古さ」を演出
        const isOldest = i === 0 && messages.length === 3;
        return (
          <div
            key={msg.id}
            style={{
              // 背景：白に少し透明度
              background: "rgba(255, 255, 255, 0.97)",
              // ふちどり：手書き風の濃いグレー
              border: "2.5px solid #666",
              // 全体的に丸い楕円形（手書き風の温かみ）
              borderRadius: "22px",
              // 上下左右の余白
              padding: "6px 14px",
              // フォント設定
              fontFamily: "'Kosugi Maru', 'Comic Sans MS', 'Hiragino Maru Gothic Pro', cursive",
              fontSize: "13px",
              color: "#333",
              lineHeight: "1.6",
              // inline-block でテキスト幅に自然にフィットさせる
              display: "inline-block",
              // アザラシの約4倍（72px × 4 ≈ 288px）を最大幅とする
              maxWidth: "300px",
              // nowrap で短いテキストは1行に収め、自然な横幅にする
              // → maxWidth を超えた長文だけ break-word で折り返す
              whiteSpace: "nowrap",
              overflowWrap: "break-word",
              wordBreak: "break-word",
              // 影で立体感を出す
              boxShadow: "1px 2px 4px rgba(0,0,0,0.10)",
              // 古いメッセージは薄く表示
              opacity: isOldest ? 0.65 : 1,
              transition: "opacity 0.8s ease",
              textAlign: "center",
            }}
          >
            {msg.text}
          </div>
        );
      })}

      {/* 吹き出しの丸い尻尾（SVGで描画、角を尖らせずやわらかく） */}
      <svg
        width="20"
        height="12"
        viewBox="0 0 20 12"
        style={{ display: "block", marginTop: "-2px" }}
      >
        {/* 楕円形の尻尾：丸く温かいデザイン */}
        <ellipse cx="8" cy="5" rx="8" ry="5" fill="rgba(255,255,255,0.97)" stroke="#666" strokeWidth="2.5" />
        {/* 内側の白（ふちどりを隠してなめらかに見せる） */}
        <ellipse cx="8" cy="4" rx="6" ry="4" fill="rgba(255,255,255,0.97)" stroke="none" />
      </svg>
    </div>
  );
}

// ==============================
// メインチャット画面コンポーネント
// ==============================

interface ChatAreaProps {
  myName: string;
  myColorIndex: number;
  /** 退室ボタンが押された時のコールバック */
  onLeave: () => void;
}

function ChatArea({ myName, myColorIndex, onLeave }: ChatAreaProps) {
  // 自分のアザラシの位置（画面全体に対する%単位）
  const [myPos, setMyPos] = useState({ x: 40, y: 40 });
  // 自分の吹き出しリスト（最大3件）
  const [myMessages, setMyMessages] = useState<ChatMessage[]>([]);
  // チャット入力欄の文字列
  const [inputValue, setInputValue] = useState("");
  // 他のプレイヤーの状態マップ（userId → PlayerState）
  const [players, setPlayers] = useState<Map<string, PlayerState>>(new Map());
  // Supabase接続済みかどうか
  const [connected, setConnected] = useState(false);
  // エラーメッセージ（接続失敗時など）
  const [error, setError] = useState<string | null>(null);

  // Supabaseチャンネルへの参照（非同期操作で使う）
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  // 位置情報のref（gameLoop内で最新値を参照するため）
  const posRef = useRef(myPos);
  // メッセージのref（gameLoop・タイマー内で最新値を参照するため）
  const messagesRef = useRef<ChatMessage[]>([]);
  // チャット入力欄のref（キーボード移動との競合回避）
  const inputRef = useRef<HTMLInputElement>(null);
  // 現在押されているキーのSet（ゲームループ用）
  const keysPressed = useRef<Set<string>>(new Set());
  // requestAnimationFrameのID（クリーンアップ用）
  const animFrameRef = useRef<number>(0);
  // 前回ブロードキャストした時刻（レートリミット用）
  const lastBroadcastRef = useRef<number>(0);

  const myColor = AVATAR_COLORS[myColorIndex] ?? AVATAR_COLORS[0];

  /**
   * Supabase Realtimeチャンネルへ接続し、Presenceを購読する。
   * 他のユーザーの入退室・状態変化をリアルタイムに検知する。
   */
  useEffect(() => {
    const channel = supabase.channel("azarashi-chat-room", {
      config: { presence: { key: MY_USER_ID } },
    });
    channelRef.current = channel;

    // 全員のPresence状態が同期された時（接続直後・誰かの変化後）
    channel.on("presence", { event: "sync" }, () => {
      const state = channel.presenceState<PlayerState>();
      const newPlayers = new Map<string, PlayerState>();
      for (const [userId, presences] of Object.entries(state)) {
        // 自分自身は除外して他プレイヤーのみ管理
        if (userId !== MY_USER_ID && presences.length > 0) {
          newPlayers.set(userId, presences[0] as PlayerState);
        }
      }
      setPlayers(newPlayers);
    });

    // 誰かが新たに入室した時
    channel.on("presence", { event: "join" }, ({ key, newPresences }) => {
      if (key === MY_USER_ID) return;
      setPlayers(prev => {
        const next = new Map(prev);
        if (newPresences.length > 0) next.set(key, newPresences[0] as PlayerState);
        return next;
      });
    });

    // 誰かが退室した時（アバターを画面から削除）
    channel.on("presence", { event: "leave" }, ({ key }) => {
      setPlayers(prev => {
        const next = new Map(prev);
        next.delete(key);
        return next;
      });
    });

    // チャンネルへの購読開始
    channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        setConnected(true);
        setError(null);
        // 自分の初期状態をブロードキャスト
        await channel.track({
          userId: MY_USER_ID,
          name: myName,
          x: posRef.current.x,
          y: posRef.current.y,
          messages: messagesRef.current,
          colorIndex: myColorIndex,
          updatedAt: Date.now(),
        } satisfies PlayerState);
      } else if (status === "CHANNEL_ERROR") {
        setError("接続エラーが発生しました");
        setConnected(false);
      }
    });

    // コンポーネントのクリーンアップ時にチャンネルを切断
    return () => {
      channel.unsubscribe();
    };
  }, [myName, myColorIndex]);

  /**
   * 現在の状態（位置・メッセージ）をSupabaseへブロードキャストする。
   * レートリミット: 50ms間隔（≒20fps）で制限してサーバー負荷を抑える。
   */
  const broadcastState = useCallback(async (
    x: number,
    y: number,
    messages: ChatMessage[],
  ) => {
    if (!channelRef.current || !connected) return;
    const now = Date.now();
    if (now - lastBroadcastRef.current < 50) return; // 50ms未満は無視
    lastBroadcastRef.current = now;
    await channelRef.current.track({
      userId: MY_USER_ID,
      name: myName,
      x,
      y,
      messages,
      colorIndex: myColorIndex,
      updatedAt: now,
    } satisfies PlayerState);
  }, [connected, myName, myColorIndex]);

  /**
   * アザラシの移動処理（requestAnimationFrameによるゲームループ）。
   * 毎フレーム押されているキーをチェックして位置を更新する。
   */
  useEffect(() => {
    const SPEED = 0.38;   // 1フレームの移動量（%単位）
    const MIN_X = 4;      // 左端の余白（%）
    const MAX_X = 92;     // 右端の上限（%）
    const MIN_Y = 4;      // 上端の余白（%）
    const MAX_Y = 88;     // 下端の上限（%）

    const gameLoop = () => {
      const keys = keysPressed.current;
      let { x, y } = posRef.current;
      let moved = false;

      // 上方向（↑ または W）
      if (keys.has("ArrowUp")    || keys.has("w") || keys.has("W")) { y = Math.max(MIN_Y, y - SPEED); moved = true; }
      // 下方向（↓ または S）
      if (keys.has("ArrowDown")  || keys.has("s") || keys.has("S")) { y = Math.min(MAX_Y, y + SPEED); moved = true; }
      // 左方向（← または A）
      if (keys.has("ArrowLeft")  || keys.has("a") || keys.has("A")) { x = Math.max(MIN_X, x - SPEED); moved = true; }
      // 右方向（→ または D）
      if (keys.has("ArrowRight") || keys.has("d") || keys.has("D")) { x = Math.min(MAX_X, x + SPEED); moved = true; }

      if (moved) {
        posRef.current = { x, y };
        setMyPos({ x, y });
        broadcastState(x, y, messagesRef.current);
      }

      animFrameRef.current = requestAnimationFrame(gameLoop);
    };

    animFrameRef.current = requestAnimationFrame(gameLoop);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [broadcastState]);

  /**
   * キーボードイベントの登録。
   * テキスト入力欄にフォーカスがある間は移動キーを無視する。
   */
  useEffect(() => {
    const MOVE_KEYS = ["ArrowUp","ArrowDown","ArrowLeft","ArrowRight","w","a","s","d","W","A","S","D"];
    const onKeyDown = (e: KeyboardEvent) => {
      // テキスト入力中は移動キーを無効化
      if (document.activeElement === inputRef.current) return;
      if (MOVE_KEYS.includes(e.key)) {
        e.preventDefault(); // ページスクロールを防ぐ
        keysPressed.current.add(e.key);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keysPressed.current.delete(e.key);
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  /**
   * 自分のメッセージを1秒ごとに確認し、
   * 送信から15秒経過したものを自動削除してブロードキャストする。
   */
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setMyMessages(prev => {
        // 15秒以内のメッセージのみ残す
        const next = prev.filter(m => now - m.sentAt < 15000);
        if (next.length !== prev.length) {
          // 変化があった場合のみrefを更新してブロードキャスト
          messagesRef.current = next;
          broadcastState(posRef.current.x, posRef.current.y, next);
        }
        return next;
      });
    }, 1000); // 1秒ごとにチェック
    return () => clearInterval(interval);
  }, [broadcastState]);

  /**
   * チャットメッセージの送信処理。
   * 最大3件まで積み上げ、超えた場合は一番古いメッセージを削除する。
   */
  const handleSend = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;
    const newMsg: ChatMessage = {
      id: `${MY_USER_ID}_${Date.now()}`,
      text: inputValue.trim(),
      sentAt: Date.now(),
    };
    setMyMessages(prev => {
      // 末尾に追加して最大3件に切り詰める（古いものが消える）
      const next = [...prev, newMsg].slice(-3);
      messagesRef.current = next;
      broadcastState(posRef.current.x, posRef.current.y, next);
      return next;
    });
    setInputValue(""); // 入力欄をクリア
  }, [inputValue, broadcastState]);

  /**
   * 退室処理：チャンネルから切断してロビー画面に戻る。
   */
  const handleLeave = useCallback(async () => {
    if (channelRef.current) {
      // Presenceから自分を削除してから切断
      await channelRef.current.untrack();
      channelRef.current.unsubscribe();
      channelRef.current = null;
    }
    onLeave(); // 親コンポーネントに通知してロビーへ遷移
  }, [onLeave]);

  // 参加者数（自分を含む）
  const totalUsers = players.size + 1;

  // 背景の装飾用ドット（固定のランダム配置）
  const bgDots = Array.from({ length: 30 }, (_, i) => ({
    x: (i * 137.5) % 100,
    y: (i * 97.3) % 100,
    r: 1.5 + (i % 3),
    opacity: 0.05 + (i % 5) * 0.013,
  }));

  return (
    <div style={{
      width: "100vw",
      height: "100vh",
      background: "linear-gradient(135deg, #FFF8F0 0%, #FFF0F8 50%, #F0EEFF 100%)",
      display: "flex",
      flexDirection: "column",
      overflow: "hidden",
      fontFamily: "'Kosugi Maru', 'Comic Sans MS', 'Hiragino Maru Gothic Pro', cursive",
      userSelect: "none",
    }}>

      {/* ─── ヘッダーエリア ─── */}
      <div style={{
        position: "relative",
        textAlign: "center",
        padding: "8px 0 2px",
        flexShrink: 0,
      }}>
        {/* 退室ボタン（左上に固定） */}
        <button
          onClick={handleLeave}
          style={{
            position: "absolute",
            left: "12px",
            top: "8px",
            padding: "5px 12px",
            borderRadius: "14px",
            border: "2px solid #D0A0D8",
            background: "rgba(255,255,255,0.85)",
            color: "#8844AA",
            fontSize: "12px",
            cursor: "pointer",
            fontFamily: "inherit",
            fontWeight: "bold",
            boxShadow: "0 1px 4px rgba(0,0,0,0.1)",
            transition: "all 0.15s",
          }}
          onMouseEnter={e => (e.currentTarget.style.background = "#F8E8FF")}
          onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.85)")}
        >
          ← 退室する
        </button>

        {/* タイトル */}
        <div style={{
          fontSize: "20px",
          fontWeight: "bold",
          color: "#7A45AA",
          letterSpacing: "0.05em",
          textShadow: "1px 1px 0 rgba(180,130,220,0.2)",
        }}>
          🦭 あざらしチャット 🦭
        </div>
      </div>

      {/* 接続状態・参加人数バー */}
      <div style={{
        textAlign: "center",
        fontSize: "11px",
        color: connected ? "#2A9A55" : "#E05050",
        marginBottom: "2px",
        flexShrink: 0,
      }}>
        {error
          ? `⚠️ ${error}`
          : connected
            ? `✓ 接続中 ｜ ${myName}（${myColor.label}）｜ 参加者: ${totalUsers} / ${MAX_USERS}人`
            : "Supabaseに接続中..."}
      </div>

      {/* 操作ガイド */}
      <div style={{ textAlign: "center", fontSize: "10px", color: "#CCC", marginBottom: "3px", flexShrink: 0 }}>
        矢印キー / WASD で移動 ｜ 下のボックスでチャット
      </div>

      {/* ─── ゲームエリア（アザラシが動き回るフィールド） ─── */}
      <div style={{
        flex: 1,
        position: "relative",
        overflow: "hidden",
        margin: "0 8px",
        borderRadius: "18px",
        border: "2.5px solid #D0B8EC",
        background: "linear-gradient(160deg, #FFFCFE 0%, #F5F0FF 100%)",
        boxShadow: "inset 0 2px 10px rgba(150,110,200,0.07)",
      }}>
        {/* 背景の装飾SVG（ドット＋絵文字） */}
        <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}>
          {bgDots.map((d, i) => (
            <circle key={i} cx={`${d.x}%`} cy={`${d.y}%`} r={d.r} fill="#B090D0" opacity={d.opacity} />
          ))}
          <text x="3%"  y="93%" fontSize="18" opacity="0.22">🌸</text>
          <text x="87%" y="91%" fontSize="22" opacity="0.18">🌿</text>
          <text x="50%" y="95%" fontSize="16" opacity="0.16">🌼</text>
          <text x="13%" y="89%" fontSize="15" opacity="0.16">🌷</text>
          <text x="75%" y="88%" fontSize="17" opacity="0.18">🍀</text>
        </svg>

        {/* ─── 他プレイヤーのアザラシを描画 ─── */}
        {Array.from(players.values()).map((player) => {
          const pColor = AVATAR_COLORS[player.colorIndex] ?? AVATAR_COLORS[0];
          // 描画タイミングで15秒フィルタを再適用（遅延なく消す）
          const now = Date.now();
          const visibleMsgs = (player.messages ?? [])
            .filter(m => now - m.sentAt < 15000)
            .slice(-3); // 最大3件

          return (
            <div
              key={player.userId}
              style={{
                position: "absolute",
                left: `${player.x}%`,
                top: `${player.y}%`,
                transform: "translate(-50%, -50%)",
                // スムーズな移動アニメーション（Supabaseからの更新に追従）
                transition: "left 0.08s linear, top 0.08s linear",
                zIndex: 5,
              }}
            >
              <div style={{ position: "relative", display: "inline-flex", flexDirection: "column", alignItems: "center" }}>
                {/* 吹き出しスタック（アバターの上） */}
                <SpeechBubbleStack messages={visibleMsgs} />
                {/* アザラシ本体 */}
                <SealAvatar bodyColor={pColor.body} borderColor={pColor.border} />
                {/* ユーザー名（アバターの真下に表示・重ならないよう明示的に配置） */}
                <div style={{
                  marginTop: "3px",
                  fontSize: "11px",
                  color: pColor.border,
                  fontWeight: "bold",
                  textShadow: "0 1px 3px white, 0 0 4px white",
                  whiteSpace: "nowrap",
                  lineHeight: "1",
                  textAlign: "center",
                  width: "100%",
                }}>
                  {player.name}
                </div>
              </div>
            </div>
          );
        })}

        {/* ─── 自分のアザラシを描画 ─── */}
        <div
          style={{
            position: "absolute",
            left: `${myPos.x}%`,
            top: `${myPos.y}%`,
            transform: "translate(-50%, -50%)",
            // 自分は瞬時に移動（遅延なし）
            transition: "none",
            zIndex: 10,
          }}
        >
          <div style={{ position: "relative", display: "inline-flex", flexDirection: "column", alignItems: "center" }}>
            {/* 自分の吹き出しスタック */}
            <SpeechBubbleStack messages={myMessages} />
            {/* 自分のアザラシ本体 */}
            <SealAvatar bodyColor={myColor.body} borderColor={myColor.border} />
            {/* 自分の名前（⭐付きでアバターの真下） */}
            <div style={{
              marginTop: "3px",
              fontSize: "11px",
              color: myColor.border,
              fontWeight: "bold",
              textShadow: "0 1px 3px white, 0 0 4px white",
              whiteSpace: "nowrap",
              lineHeight: "1",
              textAlign: "center",
              width: "100%",
            }}>
              {myName} ⭐
            </div>
          </div>
        </div>
      </div>

      {/* ─── チャット入力欄（画面最下部） ─── */}
      <form
        onSubmit={handleSend}
        style={{
          display: "flex",
          gap: "8px",
          padding: "9px 12px",
          background: "rgba(255,255,255,0.88)",
          borderTop: "2px solid #DCC0F0",
          flexShrink: 0,
        }}
      >
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="メッセージを入力してEnter ✍️"
          maxLength={20}
          style={{
            flex: 1,
            padding: "9px 16px",
            borderRadius: "20px",
            border: "2.5px solid #C0A0E0",
            background: "#FDFAFF",
            fontFamily: "inherit",
            fontSize: "14px",
            color: "#333",
            outline: "none",
            boxShadow: "inset 0 1px 3px rgba(150,110,200,0.1)",
          }}
        />
        <button
          type="submit"
          style={{
            padding: "9px 18px",
            borderRadius: "20px",
            border: "none",
            background: "linear-gradient(135deg, #C870E8, #8080E8)",
            color: "white",
            fontWeight: "bold",
            fontSize: "14px",
            cursor: "pointer",
            fontFamily: "inherit",
            boxShadow: "0 2px 6px rgba(130,90,220,0.38)",
          }}
        >
          送信 🐾
        </button>
      </form>
    </div>
  );
}

// ==============================
// アプリのルートコンポーネント
// ==============================

/**
 * アプリ全体を管理するルートコンポーネント。
 * - joinState が null → ロビー画面（名前・色選択）
 * - joinState が設定済み → チャット広場画面
 */
export default function SealChat() {
  // 入室情報（null = ロビー表示中、設定済み = チャット中）
  const [joinState, setJoinState] = useState<{ name: string; colorIndex: number } | null>(null);
  // 広場が満員かどうか（ロビーで表示用）
  const [isFull, setIsFull] = useState(false);

  /**
   * ロビー表示中のみ：広場の人数を監視して満員チェックを行う。
   * （入室後は不要なため、joinStateが設定されたら購読を解除）
   */
  useEffect(() => {
    if (joinState) return; // 入室後は監視不要

    const checkChannel = supabase.channel("azarashi-chat-room");
    checkChannel.on("presence", { event: "sync" }, () => {
      const state = checkChannel.presenceState();
      const userCount = Object.keys(state).length;
      setIsFull(userCount >= MAX_USERS);
    });
    checkChannel.subscribe();

    return () => { checkChannel.unsubscribe(); };
  }, [joinState]);

  /** 入室ボタンが押された時：名前と色をセットしてチャット画面へ遷移 */
  const handleJoin = (name: string, colorIndex: number) => {
    setJoinState({ name, colorIndex });
  };

  /** 退室ボタンが押された時：joinStateをリセットしてロビーへ戻る */
  const handleLeave = () => {
    setJoinState(null);
  };

  // ロビー画面（入室前）
  if (!joinState) {
    return <LobbyScreen onJoin={handleJoin} isFull={isFull} />;
  }

  // チャット広場（入室後）
  return (
    <ChatArea
      myName={joinState.name}
      myColorIndex={joinState.colorIndex}
      onLeave={handleLeave}
    />
  );
}
