import { describe, expect, it } from "vitest";
import * as fc from "fast-check";
import { CursorPagination } from "./pagination";

type Item = { id: string; createdAt: string };

const itemArbitrary = fc.record({
  id: fc.uuid(),
  createdAt: fc.integer({ min: 0, max: 10_000 }).map((offset) =>
    new Date(Date.UTC(2025, 0, 1, 0, 0, 0, offset)).toISOString()
  ),
});

const uniqueItems = fc.array(itemArbitrary, { maxLength: 150 }).map((items) => {
  const seen = new Set<string>();
  return items.filter((item) => !seen.has(item.id) && seen.add(item.id));
});

function collectPages(items: Item[], limit: number): Item[] {
  const collected: Item[] = [];
  let cursor: string | undefined;
  do {
    const page = CursorPagination.paginateByCreatedAt(items, { limit, cursor });
    collected.push(...page.items);
    cursor = page.nextCursor;
  } while (cursor);
  return collected;
}

describe("CursorPagination properties", () => {
  it("covers every item exactly once for generated page sizes and cursors", () => {
    fc.assert(fc.property(uniqueItems, fc.integer({ min: 1, max: 100 }), (items, limit) => {
      const pages = collectPages(items, limit);
      const expectedIds = [...items]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime() || a.id.localeCompare(b.id))
        .map((item) => item.id);
      expect(pages.map((item) => item.id)).toEqual(expectedIds);
      expect(new Set(pages.map((item) => item.id)).size).toBe(pages.length);
    }));
  });

  it("keeps offset fallback within the generated ordered result", () => {
    fc.assert(fc.property(uniqueItems, fc.integer({ min: 0, max: 150 }), fc.integer({ min: 1, max: 50 }), (items, offset, limit) => {
      const page = CursorPagination.paginateByCreatedAt(items, { offset, limit });
      expect(page.items.length).toBeLessThanOrEqual(limit);
      expect(page.items.every((item) => items.some((candidate) => candidate.id === item.id))).toBe(true);
    }));
  });

  it("returns an empty page for empty results regardless of page size", () => {
    fc.assert(fc.property(fc.integer({ min: 1, max: 100 }), (limit) => {
      const result = CursorPagination.paginateByCreatedAt([], { limit });
      expect(result.items).toEqual([]);
      expect(result.hasMore).toBe(false);
      expect(result.nextCursor).toBeUndefined();
    }));
  });
});
