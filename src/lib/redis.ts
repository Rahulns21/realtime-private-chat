import { Redis } from "@upstash/redis";

export const redis = Redis.fromEnv();

export const setRoomTTL = async (roomId: string, ttl: number) => {
  const keys = [
    `${roomId}`,
    `meta:${roomId}`,
    `messages:${roomId}`,
  ];

  // pipeline for atomic operation
  const pipeline = redis.pipeline();
  for (const key of keys) {
    pipeline.expire(key, ttl);
  }
  await pipeline.exec();
}

export const delRoom = async (roomId: string) => {
  const keys = [
    `${roomId}`,
    `meta:${roomId}`,
    `messages:${roomId}`,
  ];

  // pipeline for atomic operation
  const pipeline = redis.pipeline();
  for (const key of keys) {
    pipeline.del(key);
  }
  await pipeline.exec();
}