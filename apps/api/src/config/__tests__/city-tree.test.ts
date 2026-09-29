import { describe, it, expect } from 'vitest';
import { DhakaCityTree, dhakaTree } from '../city-tree.js';
import { ZONES } from '../zones.js';

describe('DhakaCityTree - Phase 1 Spanning Tree Core', () => {
  it('connects all 7 Dhaka zones into a valid spanning tree with exactly 6 edges', () => {
    const nodes = dhakaTree.getAllNodes();
    expect(nodes).toHaveLength(ZONES.length);

    // Count edges in rooted tree: exactly N - 1 nodes have a parent
    const nodesWithParent = nodes.filter((n) => n.parent !== null);
    expect(nodesWithParent).toHaveLength(ZONES.length - 1);

    // Root node has no parent and depth 0
    const rootNode = dhakaTree.getNode('MOHAKHALI');
    expect(rootNode.parent).toBeNull();
    expect(rootNode.depth).toBe(0);
    expect(rootNode.distFromRoot).toBe(0);
  });

  it('correctly calculates Lowest Common Ancestor (LCA)', () => {
    // Both Mohakhali & Gulshan: Mohakhali is parent of Gulshan, so LCA is Mohakhali
    expect(dhakaTree.findLCA('GULSHAN', 'MOHAKHALI')).toBe('MOHAKHALI');

    // Dhanmondi and Uttara: They join at the central hub Mohakhali
    expect(dhakaTree.findLCA('DHANMONDI', 'UTTARA')).toBe('MOHAKHALI');

    // Same node LCA is itself
    expect(dhakaTree.findLCA('BANANI', 'BANANI')).toBe('BANANI');
  });

  it('computes unique paths and positive distances between any two distinct zones', () => {
    for (const from of ZONES) {
      for (const to of ZONES) {
        const route = dhakaTree.getRoute(from, to);
        expect(route.from).toBe(from);
        expect(route.to).toBe(to);

        if (from === to) {
          expect(route.path).toEqual([from]);
          expect(route.totalDistanceKm).toBe(0);
          expect(route.edges).toHaveLength(0);
        } else {
          expect(route.path[0]).toBe(from);
          expect(route.path[route.path.length - 1]).toBe(to);
          expect(route.totalDistanceKm).toBeGreaterThan(0);
          expect(route.edges).toHaveLength(route.path.length - 1);

          // Fast O(1) distance matches path traversal distance
          const o1Distance = dhakaTree.getDistance(from, to);
          expect(route.totalDistanceKm).toBe(o1Distance);
        }
      }
    }
  });

  describe('Route Overlap and Sub-Route Matching', () => {
    it('detects when candidate route is an exact sub-route of a base route', () => {
      // Base: Uttara -> Banani -> Mohakhali -> Motijheel
      const baseRoute = dhakaTree.getRoute('UTTARA', 'MOTIJHEEL');
      // Candidate: Banani -> Mohakhali
      const candRoute = dhakaTree.getRoute('BANANI', 'MOHAKHALI');

      expect(dhakaTree.isSubRoute(baseRoute, candRoute)).toBe(true);
      expect(dhakaTree.getOverlapRatio(baseRoute, candRoute)).toBe(1.0);

      const shared = dhakaTree.getSharedEdges(baseRoute, candRoute);
      expect(shared).toHaveLength(1);
      expect(shared[0]).toMatchObject({ from: 'BANANI', to: 'MOHAKHALI' });
    });

    it('rejects opposite-direction rides even along the same road segment', () => {
      // Southbound: Banani -> Mohakhali
      const southbound = dhakaTree.getRoute('BANANI', 'MOHAKHALI');
      // Northbound: Mohakhali -> Banani
      const northbound = dhakaTree.getRoute('MOHAKHALI', 'BANANI');

      expect(dhakaTree.isSubRoute(southbound, northbound)).toBe(false);
      expect(dhakaTree.getSharedEdges(southbound, northbound)).toHaveLength(0);
      expect(dhakaTree.getOverlapRatio(southbound, northbound)).toBe(0);
    });

    it('returns 0 overlap for completely disjoint tree branches', () => {
      // Branch 1: Mohakhali -> Banani
      const branch1 = dhakaTree.getRoute('MOHAKHALI', 'BANANI');
      // Branch 2: Dhanmondi -> Motijheel
      const branch2 = dhakaTree.getRoute('DHANMONDI', 'MOTIJHEEL');

      expect(dhakaTree.getSharedEdges(branch1, branch2)).toHaveLength(0);
      expect(dhakaTree.getOverlapRatio(branch1, branch2)).toBe(0);
      expect(dhakaTree.isSubRoute(branch1, branch2)).toBe(false);
    });
  });
});

