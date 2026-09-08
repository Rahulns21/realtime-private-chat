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

  const { data: ttlData } = useQuery({
    queryKey: ["ttl", roomId],
    queryFn: async () => {
      const res = await client.room.ttl.get({
        query: { roomId },
      });
      return res.data;
    },
    initialData: { ttl: ROOM_TTL_SECONDS },
    refetchInterval: 1000,
  });

  const timeRemaining = ttlData?.ttl ?? 0;

  useEffect(() => {
    if (timeRemaining === null || timeRemaining < 0) return;

    if (timeRemaining === 0) {
      router.push("/?destroyed=true");
      return;
    }
  }, [timeRemaining, router]);

  const { data: messages, refetch } = useQuery({
    queryKey: ["messages", roomId],
    queryFn: async () => {
      const res = await client.messages.get({ query: { roomId } });
      return res.data;
    },
  });

  useRealtime({
    channels: [roomId],
    events: ["chat.message", "chat.destroy"],
    onData: ({ event }) => {
      if (event === "chat.message") {
        refetch();
      }

      if (event === "chat.destroy") {
        router.push(ROUTES.ROOM_DESTROYED);
      }
    },
  });

  const { mutate: destroyRoom } = useMutation({
    mutationFn: async () => {
      await client.room.delete(null, {
        query: { roomId },
      });
    },
  });

  const { mutate: sendMessage, isPending: isSending } = useMutation({
    mutationFn: async ({ text }: { text: string }) => {
      if (!username) {
        throw new Error("Username is not loaded, try refreshing the page");
      }

      await client.messages.post(
        { sender: username, text },
        { query: { roomId } }
      );
    },
  });

  const copyLink = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url);
    setCopyStatus("COPIED!");
    setTimeout(() => setCopyStatus("COPY"), 500);
  };

  return (
    <main className="flex h-screen max-h-screen flex-col overflow-hidden">
      <header className="flex flex-col gap-3 border-b border-zinc-800 bg-zinc-900/30 p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
  {/* Left section */}
  <div className="flex items-center justify-between gap-4">
    <div className="flex flex-col">
      <span className="text-[10px] text-zinc-500 uppercase sm:text-xs">Room ID</span>
      <div className="flex items-center gap-2">
        <span className="truncate text-sm font-bold text-green-500 max-w-30 sm:max-w-50">
          {roomId}
        </span>
        <button
          onClick={copyLink}
          className="cursor-pointer rounded bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-400 transition-colors hover:bg-zinc-700 hover:text-zinc-200 whitespace-nowrap"
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
          timeRemaining !== null && timeRemaining < 60 ? "text-red-500" : "text-amber-500"
        }`}
      >
        {timeRemaining !== null ? formatTimeRemaining(timeRemaining) : "--:--"}
      </span>
    </div>
  </div>

  {/* Destroy button */}
  <button
    onClick={() => destroyRoom()}
    className="group flex w-full cursor-pointer items-center justify-center gap-2 rounded bg-zinc-800 px-4 py-2 text-xs font-bold text-zinc-400 uppercase transition-all hover:bg-red-600 hover:text-white disabled:opacity-50 sm:w-auto sm:px-6 sm:py-1.5"
  >
    <span className="group-hover:animate-pulse">💣</span>
    <span className="sm:inline">Destroy Now</span>
  </button>
</header>

      {/* MESSAGES */}
      <div className="flex-1 scrollbar-thin space-y-4 overflow-y-auto p-4">
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
            className={`flex flex-col ${msg.sender === username ? "items-end" : "items-start"} px-2`}
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

      <div className="border-t border-zinc-800 bg-zinc-900/30 p-4">
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
                  // TODO: send message
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
            className="cursor-pointer bg-zinc-800 px-6 text-sm font-bold text-zinc-400 uppercase transition-all hover:text-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </div>
    </main>
  );
};

export default Page;
