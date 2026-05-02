import { defineStore } from "pinia";
import { ref } from "vue";
import { supabase } from "@/services/supabase";
import { useAuthStore } from "@/stores/auth";
import { useProgressStore } from "@/stores/progress";
import { mapReadingDna, type ReadingDna, type ReadingDnaRow } from "@/types";

/**
 * 016 — Reading DNA store.
 *
 * Threshold-gated AI invocation: client decides whether to call the edge
 * function so we never burn an AI call on a page-load that wouldn't change
 * the persisted DNA. Generation rule:
 *   - no row AND finishedBooks ≥ 3                     → generate
 *   - row AND (finishedSinceGen ≥ 3 OR daysSinceGen ≥ 90) → regenerate
 *   - otherwise                                        → no AI call
 *
 * On generation failure, the previous DNA is preserved (FR-014).
 */

const FINISHED_THRESHOLD = 2;
const DAYS_THRESHOLD = 90;

export type ReadingDnaStatus = "idle" | "loading" | "generating" | "error";

export const useReadingDnaStore = defineStore("readingDna", () => {
  const dna = ref<ReadingDna | null>(null);
  const status = ref<ReadingDnaStatus>("idle");
  const fetchedForUserId = ref<string | null>(null);

  const fetchDna = async (options: { force?: boolean } = {}): Promise<void> => {
    const authStore = useAuthStore();
    if (!authStore.user) return;
    const userId = authStore.user.id;

    if (fetchedForUserId.value && fetchedForUserId.value !== userId) {
      dna.value = null;
      fetchedForUserId.value = null;
    }

    if (!options.force && fetchedForUserId.value === userId) return;

    status.value = "loading";
    const { data, error } = await supabase
      .from("reading_dna")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) {
      // PGRST116 = no row found — treat as null, not error.
      console.warn("[readingDna] fetch failed", error);
      status.value = "idle";
      return;
    }
    dna.value = data ? mapReadingDna(data as ReadingDnaRow) : null;
    fetchedForUserId.value = userId;
    status.value = "idle";
  };

  const _shouldGenerate = (booksFinished: number): boolean => {
    if (booksFinished < FINISHED_THRESHOLD) return false;
    if (!dna.value) return true;
    const finishedSince = booksFinished - dna.value.booksFinishedAtGeneration;
    if (finishedSince >= FINISHED_THRESHOLD) return true;
    const daysSince =
      (Date.now() - new Date(dna.value.generatedAt).getTime()) / 86_400_000;
    return daysSince >= DAYS_THRESHOLD;
  };

  const maybeGenerateDna = async (booksFinished: number): Promise<void> => {
    const authStore = useAuthStore();
    if (!authStore.user) return;
    if (!_shouldGenerate(booksFinished)) return;

    const progressStore = useProgressStore();
    const books = progressStore.completedBooks.map((b) => ({
      title: b.book.title,
      author: b.book.author,
    }));
    if (books.length === 0) return;

    status.value = "generating";

    try {
      const { data, error } = await supabase.functions.invoke(
        "generate-reading-dna",
        { body: { books } },
      );
      if (error || !data) {
        // FR-014 — preserve previous DNA, surface 'error' only if we have nothing
        console.warn("[readingDna] generation failed", error);
        status.value = dna.value ? "idle" : "error";
        return;
      }

      // UPSERT into reading_dna
      const row: Partial<ReadingDnaRow> = {
        user_id: authStore.user.id,
        personality: data.personality,
        mood_tone: data.moodSignature.tone,
        mood_emojis: data.moodSignature.emojis,
        suggestions: data.suggestions,
        books_finished_at_generation:
          data.booksFinishedAtGeneration ?? booksFinished,
        generated_at: data.generatedAt ?? new Date().toISOString(),
      };
      const { error: upsertErr } = await supabase
        .from("reading_dna")
        .upsert(row, { onConflict: "user_id" });
      if (upsertErr) {
        console.warn("[readingDna] upsert failed", upsertErr);
        status.value = dna.value ? "idle" : "error";
        return;
      }

      // Refetch to get the canonical row
      await fetchDna({ force: true });
    } catch (err) {
      console.warn("[readingDna] unexpected error", err);
      status.value = dna.value ? "idle" : "error";
    }
  };

  return {
    dna,
    status,
    fetchDna,
    maybeGenerateDna,
  };
});
