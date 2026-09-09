import { Message, realtime } from "@/lib/realtime";
import { delRoom, redis, setRoomTTL } from "@/lib/redis";
import { Elysia } from "elysia";
import { nanoid } from "nanoid";
import { z } from "zod";
import { authMiddleware } from "./auth";

const MINUTES: number = 1;
export const ROOM_TTL_SECONDS: number = 60 * MINUTES;

export const rooms = new Elysia({ prefix: "/room" })
  .post("/create", async ({ cookie }) => {
    const roomId = nanoid();
    const metaKey = `meta:${roomId}`;

    const creatorToken = nanoid();

    await redis.hset(metaKey, {
      connected: [creatorToken],
      createdAt: Date.now(),
    });

    await redis.expire(metaKey, ROOM_TTL_SECONDS);

    cookie["x-auth-token"]?.set({
      value: creatorToken,
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax", 
      maxAge: ROOM_TTL_SECONDS,
      path: "/",
    });

    return { roomId };
  })
  .post(
    "/join",
    async ({ query, cookie, set }) => {
      const { roomId } = query;

      // check if room exists
      const exists = await redis.exists(`meta:${roomId}`);
      if (!exists) {
        set.status = 404;
        return { error: "Room not found" };
      }

      // check room capacity
      const connected = await redis.hget<string[]>(
        `meta:${roomId}`,
        "connected"
      );

      if (connected && connected.length >= 2) {
        set.status = 409;
        return { error: "Room is full" };
      }

      const token = nanoid();

      await redis.hset(`meta:${roomId}`, {
        connected: [...(connected || []), token],
      });

      cookie["x-auth-token"]?.set({
        value: token,
        httpOnly: false,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax", 
        maxAge: ROOM_TTL_SECONDS,
        path: "/",
      });

      const remaining = await redis.ttl(`meta:${roomId}`);
      await setRoomTTL(roomId, remaining > 0 ? remaining : ROOM_TTL_SECONDS);

      return { success: true, token };
    },
    {
      query: z.object({ roomId: z.string() }),
    }
  )
  .use(authMiddleware)
  .get(
    "/ttl",
    async ({ auth }) => {
      const ttl = await redis.ttl(`meta:${auth.roomId}`);
      return { ttl: ttl > 0 ? ttl : 0 };
    },
    { query: z.object({ roomId: z.string() }) }
  )
  .delete(
    "/",
    async ({ auth }) => {
      await realtime
        .channel(auth.roomId)
        .emit("chat.destroy", { isDestroyed: true });
      await delRoom(auth.roomId);
    },
    {
      query: z.object({ roomId: z.string() }),
    }
  );

export const messages = new Elysia({ prefix: "/messages" })
  .use(authMiddleware)
  .post(
    "/",
    async ({ body, auth }) => {
      const { sender, text } = body;
      const { roomId } = auth;

      const roomExists = await redis.exists(`meta:${roomId}`);

      if (!roomExists) {
        throw new Error("Room does not exist");
      }

      const message: Message = {
        id: nanoid(),
        sender,
        text,
        timeStamp: Date.now(),
        roomId,
      };

      // add message to history
      await redis.rpush(`messages:${roomId}`, {
        ...message,
        token: auth.token,
      });
      await realtime.channel(roomId).emit("chat.message", message);

      // housekeeping
      const remaining = await redis.ttl(`meta:${roomId}`);
      await setRoomTTL(roomId, remaining);
    },
    {
      query: z.object({ roomId: z.string() }),
      body: z.object({
        sender: z.string().max(100),
        text: z.string().max(1000),
      }),
    }
  )
  .get(
    "/",
    async ({ auth }) => {
      const messages = await redis.lrange<Message>(
        `messages:${auth.roomId}`,
        0,
        -1
      );

      return {
        messages: messages.map((m) => ({
          ...m,
          token: m.token === auth.token ? auth.token : undefined,
        })),
      };
    },
    { query: z.object({ roomId: z.string() }) }
  );

export const app = new Elysia({ prefix: "/api" }).use(rooms).use(messages);

export const GET = app.fetch;
export const POST = app.fetch;
export const DELETE = app.fetch;
