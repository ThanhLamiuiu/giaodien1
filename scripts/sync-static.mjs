// Copies the pure HTML/CSS/JS prototype from room-allocation/ into public/
// so the Next.js shell can serve it at /room-allocation/index.html.
// room-allocation/ stays the single source of truth.
import { cpSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

const src = resolve("room-allocation");
const dest = resolve("public/room-allocation");

mkdirSync(dest, { recursive: true });
cpSync(src, dest, { recursive: true });
console.log(`[sync-static] room-allocation/ -> public/room-allocation/`);
