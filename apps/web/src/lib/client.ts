import { treaty } from "@elysiajs/eden";
import type { App } from "@profile/api";

const base = import.meta.env.PUBLIC_API_URL ?? "http://localhost:3000";
export const api = treaty<App>(base);
