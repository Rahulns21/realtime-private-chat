"use client";

import { useUsername } from "@/hooks/use-username";
import { client } from "@/lib/client";
import { useMutation } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

const Page = () => {
  return (
    <Suspense>
      <Lobby />
    </Suspense>
  );
};

function Lobby() {
  const router = useRouter();
  const { username } = useUsername();
  const [roomInput, setRoomInput] = useState("");
  const [showJoinInput, setShowJoinInput] = useState(false);
  const [showJoinInputError, setShowJoinInputError] = useState(false);
  const [joinInputError, setJoinInputError] = useState<string | null>(null);

  const searchParams = useSearchParams();
  const wasDestroyed = searchParams.get("destroyed") === "true";
  const error = searchParams.get("error");

  const { mutate: createRoom } = useMutation({
    mutationFn: async () => {
      const res = await client.room.create.post();

      if (res.status === 200) {
        router.push(`/room/${res.data?.roomId}`);
      }
    },
  });

  const handleJoin = () => {
    const trimmed = roomInput.trim();
    if (!trimmed) return;

    let roomId = trimmed;

    if (trimmed.includes("/room/")) {
      const match = trimmed.match(/\/room\/([a-zA-Z0-9_-]+)/);
      if (match) {
        roomId = match[1];
      } else {
        alert("Invalid room link format");
        return;
      }
    }

    if (trimmed.startsWith("room/")) {
      roomId = trimmed.replace("room/", "");
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(roomId)) {
      setShowJoinInputError(true);
      setJoinInputError("Invalid room ID or link");
      return;
    }

    // clear error and navigate
    setShowJoinInputError(false);
    setJoinInputError(null);
    router.push(`/room/${roomId}`);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setRoomInput(e.target.value);
    if (showJoinInputError) {
      setShowJoinInputError(false);
      setJoinInputError(null);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        {wasDestroyed && (
          <div className="border border-red-900 bg-red-950/50 p-4 text-center">
            <p className="text-sm font-bold text-red-500 uppercase">
              ROOM DESTROYED
            </p>

            <p className="mt-1 text-xs text-zinc-500">
              All messages were permanently deleted.
            </p>
          </div>
        )}

        {error === "room-not-found" && (
          <div className="border border-red-900 bg-red-950/50 p-4 text-center">
            <p className="text-sm font-bold text-red-500 uppercase">
              ROOM NOT FOUND
            </p>

            <p className="mt-1 text-xs text-zinc-500">
              This room may have expired or never existed.
            </p>
          </div>
        )}

        {error === "room-full" && (
          <div className="border border-red-900 bg-red-950/50 p-4 text-center">
            <p className="text-sm font-bold text-red-500 uppercase">
              ROOM FULL
            </p>

            <p className="mt-1 text-xs text-zinc-500">
              This room is at maximum capacity.
            </p>
          </div>
        )}

        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-green-500">
            {">"}private_chat
          </h1>
          <p className="text-sm">A private, self-destrcuting chat room.</p>
        </div>

        <div className="border border-zinc-800 bg-zinc-900/50 p-6 backdrop-blur-md">
          <div className="space-y-5">
            <div className="space-y-2">
              <label className="flex items-center text-zinc-500">
                Your Identity
              </label>

              <div className="flex items-center gap-3">
                <div className="flex-1 border border-zinc-800 bg-zinc-950 p-3 font-mono text-sm text-zinc-400">
                  {username === null ? "Loading..." : username}
                </div>
              </div>
            </div>

            <button
              onClick={() => createRoom()}
              className="mt-2 w-full cursor-pointer bg-zinc-100 p-3 text-sm font-bold text-black transition-colors hover:bg-zinc-50 hover:text-black disabled:opacity-50"
            >
              CREATE SECURE ROOM
            </button>
          </div>

          <div className="mt-5 flex items-center gap-2 text-xs">
            <div className="h-px flex-1 bg-zinc-800" />
            <button
              onClick={() => setShowJoinInput(!showJoinInput)}
              className="cursor-pointer px-2 text-xs text-zinc-500 transition-colors hover:text-zinc-300"
            >
              {showJoinInput ? "✕ CLOSE" : "JOIN EXISTING ROOM"}
            </button>
            <div className="h-px flex-1 bg-zinc-800" />
          </div>

          {/* Join Room Input */}
          {showJoinInput && (
            <div className="mt-2">
              <div className="mt-5 flex gap-2 border border-zinc-800 bg-zinc-950/50">
                <input
                  type="text"
                  value={roomInput}
                  onChange={handleInputChange}
                  onKeyDown={(e) => e.key === "Enter" && handleJoin()}
                  placeholder="Paste room join link..."
                  className="flex-1 bg-transparent p-2 text-sm text-zinc-400 outline-none placeholder:text-zinc-600"
                  autoFocus
                />
                <button
                  onClick={handleJoin}
                  disabled={!roomInput.trim()}
                  className="transition-color cursor-pointer bg-white px-5 py-3 text-sm font-bold text-black uppercase disabled:cursor-not-allowed disabled:opacity-50"
                >
                  JOIN
                </button>
              </div>

              {/* Error message */}
              {showJoinInputError && joinInputError && (
                <div className="flex w-full justify-center">
                  <p className="mt-3 text-xs text-red-500">{joinInputError}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

export default Page;
