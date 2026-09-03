import { redis } from "@/lib/redis";
import { Elysia } from "elysia";
import { nanoid } from "nanoid";

const MINUTES: number = 10;
const ROOM_TTL_SECONDS: number = 60 * MINUTES;

export const rooms = new Elysia({ prefix: "/room" }).post(
  "/create",
  async () => {
    const roomId = nanoid();
    const metaKey = `meta:${roomId}`;

    await redis.hset(metaKey, {
      connected: [],
      createdAt: Date.now(),
    });

    await redis.expire(metaKey, ROOM_TTL_SECONDS);

    return { roomId };
  }
);

export const app = new Elysia({ prefix: "/api" }).use(rooms);

export const GET = app.fetch;
export const POST = app.fetch;
