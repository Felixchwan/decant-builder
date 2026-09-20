import { describe, expect, it } from "vitest";

import {
  getNoteExplorerMatchesForNoteIds,
  sortNoteExplorerMatchesByProminence,
} from "../intelligence/buildNoteExplorerViewModel.js";
import { getAdjacentPerfume, getDetailNavigation, resolveDetailNavigationPerfumes } from "./detailNavigation.js";

const perfume = (id, extra = {}) => ({ id, ...extra });

const catalog = [
  perfume("a", { topNotes: ["basil"], noteProminence: { basil: 2 } }),
  perfume("b", { topNotes: ["basil"], baseNotes: ["musk"], noteProminence: { basil: 9, musk: 3 } }),
  perfume("c", { middleNotes: ["musk"], noteProminence: { musk: 8 } }),
  perfume("d", { generalNotes: ["basil", "musk"], noteProminence: { basil: 5, musk: 9 } }),
  perfume("e", { baseNotes: ["amber"] }),
];

// What the Note Explorer hands the runtime: the ids of the results exactly as
// displayed (filter, then optional sort).
const displayedIds = (noteIds, sortNoteId) => {
  const matches = getNoteExplorerMatchesForNoteIds({ catalogPerfumes: catalog, noteIds });
  const displayed = sortNoteId ? sortNoteExplorerMatchesByProminence(matches, sortNoteId) : matches;
  return displayed.map((match) => match.id);
};

const navigationIds = (noteIds, sortNoteId) =>
  resolveDetailNavigationPerfumes({ scopedPerfumeIds: displayedIds(noteIds, sortNoteId), catalog }).map(
    (item) => item.id
  );

describe("resolveDetailNavigationPerfumes", () => {
  it("falls back to the default collection when no scoped ids are given", () => {
    const fallback = [perfume("x"), perfume("y")];
    expect(resolveDetailNavigationPerfumes({ scopedPerfumeIds: null, catalog, fallbackPerfumes: fallback })).toBe(
      fallback
    );
    expect(resolveDetailNavigationPerfumes({ catalog, fallbackPerfumes: fallback })).toBe(fallback);
  });

  it("resolves scoped ids to catalog perfumes in exactly the given order, never re-sorting", () => {
    const resolved = resolveDetailNavigationPerfumes({ scopedPerfumeIds: ["d", "a", "c"], catalog });
    expect(resolved.map((item) => item.id)).toEqual(["d", "a", "c"]);
    expect(resolved[0]).toBe(catalog[3]);
  });

  it("drops ids that no longer resolve instead of throwing", () => {
    expect(resolveDetailNavigationPerfumes({ scopedPerfumeIds: ["a", "gone", "c"], catalog }).map((p) => p.id)).toEqual([
      "a",
      "c",
    ]);
  });

  it("treats an empty scoped snapshot as an empty collection, not a fallback", () => {
    const fallback = [perfume("x")];
    expect(resolveDetailNavigationPerfumes({ scopedPerfumeIds: [], catalog, fallbackPerfumes: fallback })).toEqual([]);
  });

  it("does not leave the scoped set even though the catalog is larger", () => {
    const resolved = resolveDetailNavigationPerfumes({ scopedPerfumeIds: ["b", "d"], catalog });
    expect(resolved).toHaveLength(2);
    expect(resolved.map((item) => item.id)).not.toContain("e");
  });
});

describe("getAdjacentPerfume", () => {
  const set = [perfume("a"), perfume("b"), perfume("c")];

  it("moves to the next and previous perfume", () => {
    expect(getAdjacentPerfume(set[1], set, 1).id).toBe("c");
    expect(getAdjacentPerfume(set[1], set, -1).id).toBe("a");
  });

  it("wraps at the boundaries (the modal's existing convention)", () => {
    expect(getAdjacentPerfume(set[2], set, 1).id).toBe("a");
    expect(getAdjacentPerfume(set[0], set, -1).id).toBe("c");
  });

  it("stays on the only perfume of a one-result set", () => {
    const single = [perfume("a")];
    expect(getAdjacentPerfume(single[0], single, 1).id).toBe("a");
    expect(getAdjacentPerfume(single[0], single, -1).id).toBe("a");
  });

  it("returns the current perfume for an empty or missing collection", () => {
    const current = perfume("a");
    expect(getAdjacentPerfume(current, [], 1)).toBe(current);
    expect(getAdjacentPerfume(current, undefined, -1)).toBe(current);
    expect(getAdjacentPerfume(null, set, 1)).toBeNull();
  });

  it("enters the set at its first or last member when the current perfume is not in it", () => {
    expect(getAdjacentPerfume(perfume("zzz"), set, 1).id).toBe("a");
    expect(getAdjacentPerfume(perfume("zzz"), set, -1).id).toBe("c");
  });
});

describe("getDetailNavigation", () => {
  it("reports index, neighbours and that navigation is available for several results", () => {
    const set = [perfume("a"), perfume("b"), perfume("c")];
    const navigation = getDetailNavigation(set[0], set);
    expect(navigation.index).toBe(0);
    expect(navigation.canNavigate).toBe(true);
    expect(navigation.previous.id).toBe("c");
    expect(navigation.next.id).toBe("b");
  });

  it("offers no navigation for a one-result set", () => {
    const set = [perfume("a")];
    const navigation = getDetailNavigation(set[0], set);
    expect(navigation.canNavigate).toBe(false);
    expect(navigation.next.id).toBe("a");
    expect(navigation.previous.id).toBe("a");
  });

  it("is safe for an empty set, a missing collection and a perfume outside the set", () => {
    expect(getDetailNavigation(perfume("a"), [])).toMatchObject({
      index: -1,
      canNavigate: false,
      previous: null,
      next: null,
    });
    expect(getDetailNavigation(perfume("a"), undefined).canNavigate).toBe(false);
    expect(getDetailNavigation(perfume("zzz"), [perfume("a"), perfume("b")])).toMatchObject({
      index: -1,
      canNavigate: true,
      previous: null,
      next: null,
    });
    expect(getDetailNavigation(null, [perfume("a")]).index).toBe(-1);
  });
});

describe("Note Explorer result-scoped detail navigation", () => {
  it("navigation collection equals the current result set, in catalog order by default", () => {
    expect(displayedIds(["basil"])).toEqual(["a", "b", "d"]);
    expect(navigationIds(["basil"])).toEqual(displayedIds(["basil"]));
  });

  it("preserves the displayed sort order rather than recomputing one", () => {
    expect(displayedIds(["basil"], "basil")).toEqual(["b", "d", "a"]);
    expect(navigationIds(["basil"], "basil")).toEqual(["b", "d", "a"]);
  });

  it("changing the sort before opening changes the arrow-navigation order", () => {
    const catalogOrder = navigationIds(["musk"]);
    const prominenceOrder = navigationIds(["musk"], "musk");
    expect(catalogOrder).toEqual(["b", "c", "d"]);
    expect(prominenceOrder).toEqual(["d", "c", "b"]);
    expect(prominenceOrder).not.toEqual(catalogOrder);
  });

  it("multi-note AND filtering determines the navigation subset", () => {
    expect(navigationIds(["basil", "musk"])).toEqual(["b", "d"]);
    expect(navigationIds(["basil", "musk", "amber"])).toEqual([]);
  });

  it("repeated next/previous never leaves the filtered set and visits it in displayed order", () => {
    const scoped = resolveDetailNavigationPerfumes({ scopedPerfumeIds: displayedIds(["basil"], "basil"), catalog });
    const allowed = new Set(scoped.map((item) => item.id));

    let current = scoped[0];
    const forward = [current.id];
    for (let step = 0; step < scoped.length * 2; step += 1) {
      current = getAdjacentPerfume(current, scoped, 1);
      forward.push(current.id);
      expect(allowed.has(current.id)).toBe(true);
    }
    expect(forward.slice(0, scoped.length)).toEqual(scoped.map((item) => item.id));
    expect(forward[scoped.length]).toBe(scoped[0].id);

    const backward = [];
    for (let step = 0; step < scoped.length * 2; step += 1) {
      current = getAdjacentPerfume(current, scoped, -1);
      backward.push(current.id);
      expect(allowed.has(current.id)).toBe(true);
    }
    expect(backward.slice(0, scoped.length - 1)).toEqual([...scoped.map((item) => item.id)].reverse().slice(0, scoped.length - 1));
  });

  it("a one-result set is safe: navigation is not offered and arrows would stay put", () => {
    const scoped = resolveDetailNavigationPerfumes({ scopedPerfumeIds: displayedIds(["amber"]), catalog });
    expect(scoped.map((item) => item.id)).toEqual(["e"]);
    expect(getDetailNavigation(scoped[0], scoped).canNavigate).toBe(false);
    expect(getAdjacentPerfume(scoped[0], scoped, 1).id).toBe("e");
  });

  it("an empty result set is safe", () => {
    const scoped = resolveDetailNavigationPerfumes({ scopedPerfumeIds: displayedIds(["nonexistent"]), catalog });
    expect(scoped).toEqual([]);
    expect(getDetailNavigation(catalog[0], scoped).canNavigate).toBe(false);
  });

  it("is a snapshot: later changes to the catalog list do not alter an already-taken id snapshot", () => {
    const snapshot = displayedIds(["basil"]);
    const before = resolveDetailNavigationPerfumes({ scopedPerfumeIds: snapshot, catalog }).map((item) => item.id);
    const laterCatalog = [...catalog, perfume("f", { topNotes: ["basil"] })];
    const after = resolveDetailNavigationPerfumes({ scopedPerfumeIds: snapshot, catalog: laterCatalog }).map(
      (item) => item.id
    );
    expect(after).toEqual(before);
  });
});
