import { treaty } from "@elysia/eden";
import type { app } from "../app/api/[[...slugs]]/route";

export const client = treaty<typeof app>(
  typeof window !== "undefined" ? window.location.origin : "http://localhost:3000"
).api;