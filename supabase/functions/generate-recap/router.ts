import type { Mode, RequestBody } from "./types.ts";

export const resolveMode = (body: RequestBody): Mode => {
  if (body.mode === "recap_image") return "recap_image";
  if (body.mode === "passport_summary") return "passport_summary";
  if (body.currentPage === 0) return "blurb";
  return "recap";
};
