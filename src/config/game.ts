/**
 * Game flow URLs. NEXT_PUBLIC_* values are inlined by Next at build time, so
 * each one must be read via a literal `process.env.X` property access.
 * No other file may hardcode these URLs.
 */
export const GAME_CONFIG = {
  MAGIC_BOX_EXTERNAL_URL: process.env.NEXT_PUBLIC_MAGIC_BOX_EXTERNAL_URL ?? "/portal",
  STARTING_PAGE_URL: process.env.NEXT_PUBLIC_STARTING_PAGE_URL ?? "/register",
  INTRODUCTION_URL: process.env.NEXT_PUBLIC_INTRODUCTION_URL ?? "/portal?section=introduction",
  RETURN_TO_GAME_URL: process.env.NEXT_PUBLIC_RETURN_TO_GAME_URL ?? "/play",
} as const;
