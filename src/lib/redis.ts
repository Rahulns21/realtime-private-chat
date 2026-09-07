import { Redis } from "@upstash/redis";

export const redis = Redis.fromEnv();

export const setRoomTTL = async (roomId: string, ttl: number) => {
  const keys = [
    `meta:${roomId}`,
    `history:${roomId}`,
    `messages:${roomId}`,
    `${roomId}`,
  ];

  // pipeline for atomic operation
  const pipeline = redis.pipeline();
  for (const key of keys) {
    pipeline.expire(key, ttl);
  }
  await pipeline.exec();
}