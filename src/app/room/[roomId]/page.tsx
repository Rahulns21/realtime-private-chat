"use client";

import { ROOM_TTL_SECONDS } from "@/app/api/[[...slugs]]/route";
import { useUsername } from "@/hooks/use-username";
import { client } from "@/lib/client";
import { ROUTES } from "@/lib/constants";
import { useRealtime } from "@/lib/realtime-client";
import { formatTimeRemaining } from "@/lib/utils";
import { useMutation, useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const Page = () => {
  const params = useParams();
  const roomId = params.roomId as string;
  const router = useRouter();
  const { username } = useUsername();

  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const [copyStatus, setCopyStatus] = useState("COPY");

  // --- TIMER STATE ---
  const [timeRemaining, setTimeRemaining] = useState<number>(ROOM_TTL_SECONDS);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const expiryTimeRef = useRef<number>(0);

  // 1. TTL Query
  const {
    data: ttlData,
    isLoading: isTtlLoading,
    error: ttlError,
    refetch: refetchTtl,
  } = useQuery({
    queryKey: ["ttl", roomId],
    queryFn: async () => {
      const res = await client.room.ttl.get({
        query: { roomId },
      });
      return res.data;
    },
    refetchInterval: 30000,
    retry: false,
  });

  const isAuthenticated = !ttlError && !isTtlLoading && ttlData?.ttl !== undefined;

  // 2. Sync expiry time with server
  useEffect(() => {
    if (isAuthenticated && ttlData?.ttl !== undefined && ttlData.ttl > 0) {
      const newExpiry = Date.now() + ttlData.ttl * 1000;
      if (Math.abs(newExpiry - expiryTimeRef.current) > 3000) {
        expiryTimeRef.current = newExpiry;
      }
    }
  }, [ttlData, isAuthenticated]);

  // 3. Timer using expiry time
  useEffect(() => {
    if (!isAuthenticated) return;

    const updateTimer = () => {
      const remaining = Math.max(0, Math.floor((expiryTimeRef.current - Date.now()) / 1000));
      setTimeRemaining(remaining);

      if (remaining <= 0) {
        if (timerRef.current) clearInterval(timerRef.current);
        router.push("/?destroyed=true");
      }
    };

    updateTimer();
    timerRef.current = setInterval(updateTimer, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isAuthenticated, router]);

  // 4. Redirect on expiry
  useEffect(() => {
    if (isAuthenticated && timeRemaining <= 0) {
      router.push("/?destroyed=true");
    }
  }, [timeRemaining, router, isAuthenticated]);

  // 5. Sync on tab focus
  useEffect(() => {
    if (!isAuthenticated) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        refetchTtl();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [isAuthenticated, refetchTtl]);

  // 6. Join mutation
  const { mutate: joinRoom, isPending: isJoining } = useMutation({
    mutationFn: async () => {
      const res = await client.room.join.post(null, {
        query: { roomId },
      });
      return res.data;
    },
    onSuccess: () => {
      window.location.reload();
    },
    onError: (error: Error & { status?: number }) => {
      if (error.message?.includes("full") || error.status === 409) {
        router.push("/?error=room-full");
      } else {
        router.push("/?error=room-not-found");
      }
    },
  });

  // 7. Messages query
  const { data: messages, refetch: refetchMessages } = useQuery({
    queryKey: ["messages", roomId],
    queryFn: async () => {
      const res = await client.messages.get({ query: { roomId } });
      return res.data;
    },
    enabled: isAuthenticated,
  });

  // 8. Realtime
  useRealtime({
    channels: [roomId],
    events: ["chat.message", "chat.destroy"],
    onData: ({ event }) => {
      if (event === "chat.message") {
        refetchMessages();
      }
      if (event === "chat.destroy") {
        router.push(ROUTES.ROOM_DESTROYED);
      }
    },
    enabled: isAuthenticated,
  });

  // 9. Destroy mutation
  const { mutate: destroyRoom } = useMutation({
    mutationFn: async () => {
      await client.room.delete(null, { query: { roomId } });
    },
  });

  // 10. Send message mutation
  const { mutate: sendMessage, isPending: isSending } = useMutation({
    mutationFn: async ({ text }: { text: string }) => {
      if (!username) throw new Error("Username is not loaded");
      await client.messages.post(
        { sender: username, text },
        { query: { roomId } }
      );
    },
  });

  // 11. Copy link
  const copyLink = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url);
    setCopyStatus("COPIED!");
    setTimeout(() => setCopyStatus("COPY"), 500);
  };

  // 12. Loading state
  if (isTtlLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-black">
        <p className="text-zinc-500">Loading...</p>
      </div>
    );
  }

  // 13. JOIN SCREEN
  if (!isAuthenticated) {
    return (
      <main className="flex h-dvh max-h-dvh flex-col items-center justify-center bg-black p-4">
        <div className="w-full max-w-md space-y-8">
          <div className="space-y-2 text-center">
            <h1 className="text-2xl font-bold tracking-tight text-green-500">
              {">"}private_chat
            </h1>
            <p className="text-sm text-zinc-400">
              You&apos;ve been invited to a private room
            </p>
          </div>

          <div className="border border-zinc-800 bg-zinc-900/50 p-6 backdrop-blur-md">
            <div className="space-y-5">
              <div className="space-y-2">
                <label className="flex items-center text-zinc-500">Room ID</label>
                <div className="border border-zinc-800 bg-zinc-950 p-3 font-mono text-sm text-zinc-400">
                  {roomId}
                </div>
              </div>

              <div className="space-y-2">
                <label className="flex items-center text-zinc-500">Your Identity</label>
                <div className="border border-zinc-800 bg-zinc-950 p-3 font-mono text-sm text-zinc-400">
                  {username || "Loading..."}
                </div>
              </div>

              <button
                onClick={() => joinRoom()}
                disabled={isJoining || !username}
                className="mt-2 w-full cursor-pointer bg-green-500 p-3 text-sm font-bold text-black transition-colors hover:bg-green-400 disabled:opacity-50"
              >
                {isJoining ? "Joining..." : "JOIN ROOM"}
              </button>
            </div>
          </div>
        </div>
      </main>
    );
  }

  // 14. CHAT UI
  return (
    <main className="flex h-dvh max-h-dvh flex-col overflow-hidden bg-black">
      <header className="flex flex-col gap-3 border-b border-zinc-800 bg-zinc-900/30 p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex flex-col">
            <span className="text-[10px] text-zinc-500 uppercase sm:text-xs">Room ID</span>
            <div className="flex items-center gap-2">
              <span className="max-w-30 truncate text-sm font-bold text-green-500 sm:max-w-50">
                {roomId}
              </span>
              <button
                onClick={copyLink}
                className="cursor-pointer rounded bg-zinc-800 px-2 py-0.5 text-[10px] whitespace-nowrap text-zinc-400 transition-colors hover:bg-zinc-700 hover:text-zinc-200"
              >
                {copyStatus}
              </button>
            </div>
          </div>

          <div className="hidden h-8 w-px bg-zinc-800 sm:block" />

          <div className="flex flex-col">
            <span className="text-[10px] text-zinc-500 uppercase sm:text-xs">Self-Destruct</span>
            <span
              className={`flex items-center gap-2 text-sm font-bold ${
                timeRemaining < 60 ? "text-red-500" : "text-amber-500"
              }`}
            >
              {formatTimeRemaining(timeRemaining)}
            </span>
          </div>
        </div>

        <button
          onClick={() => destroyRoom()}
          className="group flex w-full cursor-pointer items-center justify-center gap-2 rounded bg-zinc-800 px-4 py-2 text-xs font-bold text-zinc-400 uppercase transition-all hover:bg-red-600 hover:text-white disabled:opacity-50 max-sm:bg-red-600 max-sm:text-white sm:w-auto sm:px-6 sm:py-1.5"
        >
          <span className="group-hover:animate-pulse">💣</span>
          <span className="sm:inline">Destroy Now</span>
        </button>
      </header>

      <div className="min-h-0 flex-1 scrollbar-thin overflow-y-auto p-4">
        {messages?.messages.length === 0 && (
          <div className="flex h-full items-center justify-center">
            <p className="font-mono text-sm text-zinc-600">
              No messages yet, start the conversation.
            </p>
          </div>
        )}

        {messages?.messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${msg.sender === username ? "items-end" : "items-start"} mb-3 px-2`}
          >
            <div className="group max-w-[80%]">
              <div
                className={`mb-1 flex items-baseline gap-3 ${
                  msg.sender === username ? "justify-end" : "justify-start"
                }`}
              >
                <span
                  className={`text-xs font-bold ${msg.sender === username ? "text-green-500" : "text-blue-500"}`}
                >
                  {msg.sender === username ? "YOU" : msg.sender}
                </span>
                <span className="text-[10px] text-zinc-600">
                  {format(msg.timeStamp, "HH:mm")}
                </span>
              </div>
              <p className="text-sm leading-relaxed break-all text-zinc-300">
                {msg.text}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="pb-safe border-t border-zinc-800 bg-zinc-900/30 p-4">
        <div className="flex gap-4">
          <div className="group relative flex-1">
            <span className="absolute top-1/2 left-4 -translate-y-1/2 animate-pulse text-green-500">
              {">"}
            </span>
            <input
              autoFocus
              type="text"
              value={input}
              onKeyDown={(e) => {
                if (e.key === "Enter" && input.trim()) {
                  sendMessage({ text: input });
                  inputRef.current?.focus();
                  setInput("");
                }
              }}
              placeholder="Type message..."
              onChange={(e) => setInput(e.target.value)}
              className="w-full border border-zinc-800 bg-black py-3 pr-4 pl-8 text-sm text-zinc-100 transition-colors placeholder:text-zinc-700 focus:border-zinc-700 focus:outline-none"
            />
          </div>

          <button
            onClick={() => {
              sendMessage({ text: input });
              inputRef.current?.focus();
              setInput("");
            }}
            disabled={!input.trim() || isSending}
            className="cursor-pointer bg-zinc-800 px-6 text-sm font-bold text-zinc-400 uppercase transition-all hover:text-zinc-200 disabled:cursor-not-allowed disabled:opacity-50 max-sm:bg-green-500 max-sm:text-white"
          >
            Send
          </button>
        </div>
      </div>
    </main>
  );
};

export default Page;