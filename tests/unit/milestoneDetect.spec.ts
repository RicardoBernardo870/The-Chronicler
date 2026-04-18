import { describe, it, expect } from 'vitest'
import { detectCrossedMilestone } from '@/utils/milestoneDetect'

describe('detectCrossedMilestone', () => {
  // ── Basic forward moves that cross a bucket boundary ──────────────────────

  it('returns null for 0→5 (no 10% bucket crossed)', () => {
    expect(detectCrossedMilestone(0, 5)).toBeNull()
  })

  it('returns 10 for 5→10', () => {
    expect(detectCrossedMilestone(5, 10)).toBe(10)
  })

  it('returns 20 for 18→22 (crosses 20% bucket)', () => {
    expect(detectCrossedMilestone(18, 22)).toBe(20)
  })

  // ── Multi-milestone jump collapses to latest crossed ──────────────────────

  it('returns 30 for 8→35 (latest milestone crossed is 30)', () => {
    expect(detectCrossedMilestone(8, 35)).toBe(30)
  })

  it('returns 80 for 15→83 (latest milestone crossed is 80)', () => {
    expect(detectCrossedMilestone(15, 83)).toBe(80)
  })

  // ── 100% edge: no lore card fires at exactly 100% ─────────────────────────

  it('returns 90 for 85→95 (last valid milestone is 90)', () => {
    expect(detectCrossedMilestone(85, 95)).toBe(90)
  })

  it('returns 90 for 89→100 (caps at 90 — no card at book completion)', () => {
    expect(detectCrossedMilestone(89, 100)).toBe(90)
  })

  it('returns null for 95→100 (already past 90% bucket; newBucket=100 gets capped to 90 but prevBucket=90 too)', () => {
    // prevBucket = floor(95/10)*10 = 90
    // newBucket  = floor(100/10)*10 = 100, capped to 90
    // 90 <= 90, so no new crossing
    expect(detectCrossedMilestone(95, 100)).toBeNull()
  })

  // ── Backward / same-value moves ───────────────────────────────────────────

  it('returns null for backward move (25→15)', () => {
    expect(detectCrossedMilestone(25, 15)).toBeNull()
  })

  it('returns null for same-value save (20→20)', () => {
    expect(detectCrossedMilestone(20, 20)).toBeNull()
  })

  it('returns null for same-bucket save within a bucket (22→28)', () => {
    expect(detectCrossedMilestone(22, 28)).toBeNull()
  })

  // ── Exact milestone boundaries ────────────────────────────────────────────

  it('returns 10 for 0→10 (exact first milestone)', () => {
    expect(detectCrossedMilestone(0, 10)).toBe(10)
  })

  it('returns null for 10→19 (already in the 10% bucket, no new bucket crossed)', () => {
    expect(detectCrossedMilestone(10, 19)).toBeNull()
  })

  it('returns 20 for 10→20 (exact second milestone)', () => {
    expect(detectCrossedMilestone(10, 20)).toBe(20)
  })

  it('returns 90 for 80→90 (last valid milestone)', () => {
    expect(detectCrossedMilestone(80, 90)).toBe(90)
  })

  // ── Below minimum milestone ───────────────────────────────────────────────

  it('returns null for 0→9 (does not reach 10% bucket)', () => {
    expect(detectCrossedMilestone(0, 9)).toBeNull()
  })
})
