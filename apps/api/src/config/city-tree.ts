import { Zone, ZONES, DISTANCE_MATRIX } from './zones.js';

export interface DirectedTreeEdge {
  from: Zone;
  to: Zone;
  distanceKm: number;
}

export interface TreeNode {
  zone: Zone;
  parent: Zone | null;
  distanceToParent: number;
  depth: number;
  distFromRoot: number;
  children: Zone[];
}

export interface TreeRoute {
  from: Zone;
  to: Zone;
  lca: Zone;
  path: Zone[];
  edges: DirectedTreeEdge[];
  totalDistanceKm: number;
}

/**
 * DhakaCityTree models the connectivity of Dhaka City as a Spanning Tree.
 *
 * Properties:
 * - Acyclic, connected graph of N zones and N - 1 bidirectional edges.
 * - Single root at a central transit hub (default: MOHAKHALI).
 * - Guaranteed unique directed path between any two zones via their Lowest Common Ancestor (LCA).
 * - Provides O(depth) route finding and O(1) path overlap comparisons for ride sharing.
 */
/**
 * Canonical Dhaka City Tree Topology:
 * Rooted at central transit hub: MOHAKHALI.
 * Connects all 7 zones with exactly 6 edges:
 * - MOHAKHALI <-> BANANI (2 km) <-> UTTARA (10 km)
 * - MOHAKHALI <-> MOTIJHEEL (9 km)
 * - MOHAKHALI <-> DHANMONDI (8 km)
 * - MOHAKHALI <-> GULSHAN (1 km) <-> BASHUNDHARA (5 km)
 */
export const DHAKA_TREE_EDGES: Array<{ from: Zone; to: Zone; distanceKm: number }> = [
  { from: 'MOHAKHALI', to: 'BANANI', distanceKm: 2 },
  { from: 'BANANI', to: 'UTTARA', distanceKm: 10 },
  { from: 'MOHAKHALI', to: 'MOTIJHEEL', distanceKm: 9 },
  { from: 'MOHAKHALI', to: 'DHANMONDI', distanceKm: 8 },
  { from: 'MOHAKHALI', to: 'GULSHAN', distanceKm: 1 },
  { from: 'GULSHAN', to: 'BASHUNDHARA', distanceKm: 5 },
];

export class DhakaCityTree {
  private nodes: Map<Zone, TreeNode> = new Map();
  public readonly root: Zone;

  constructor(rootZone: Zone = 'MOHAKHALI') {
    this.root = rootZone;
    this.buildTree(rootZone);
  }

  /**
   * Constructs the rooted tree from the canonical Dhaka City Tree topology.
   */
  private buildTree(root: Zone): void {
    const adjacency = new Map<Zone, Array<{ to: Zone; weight: number }>>();

    for (const zone of ZONES) {
      adjacency.set(zone, []);
    }

    for (const edge of DHAKA_TREE_EDGES) {
      adjacency.get(edge.from)!.push({ to: edge.to, weight: edge.distanceKm });
      adjacency.get(edge.to)!.push({ to: edge.from, weight: edge.distanceKm });
    }

    // Build rooted tree structure via BFS from the chosen root
    const queue: Zone[] = [root];
    const visitedBfs = new Set<Zone>([root]);

    this.nodes.set(root, {
      zone: root,
      parent: null,
      distanceToParent: 0,
      depth: 0,
      distFromRoot: 0,
      children: [],
    });

    while (queue.length > 0) {
      const current = queue.shift()!;
      const currentNode = this.nodes.get(current)!;
      const neighbors = adjacency.get(current) || [];

      for (const neighbor of neighbors) {
        if (!visitedBfs.has(neighbor.to)) {
          visitedBfs.add(neighbor.to);
          currentNode.children.push(neighbor.to);

          this.nodes.set(neighbor.to, {
            zone: neighbor.to,
            parent: current,
            distanceToParent: neighbor.weight,
            depth: currentNode.depth + 1,
            distFromRoot: currentNode.distFromRoot + neighbor.weight,
            children: [],
          });

          queue.push(neighbor.to);
        }
      }
    }
  }

  /**
   * Retrieves a node by zone name.
   */
  public getNode(zone: Zone): TreeNode {
    const node = this.nodes.get(zone);
    if (!node) {
      throw new Error(`Zone ${zone} is not part of the city tree.`);
    }
    return node;
  }

  /**
   * Returns all tree nodes.
   */
  public getAllNodes(): TreeNode[] {
    return Array.from(this.nodes.values());
  }

  /**
   * Finds the Lowest Common Ancestor (LCA) of two zones.
   */
  public findLCA(zoneA: Zone, zoneB: Zone): Zone {
    let nodeA = this.getNode(zoneA);
    let nodeB = this.getNode(zoneB);

    // Align both nodes to the same depth
    while (nodeA.depth > nodeB.depth && nodeA.parent) {
      nodeA = this.getNode(nodeA.parent);
    }
    while (nodeB.depth > nodeA.depth && nodeB.parent) {
      nodeB = this.getNode(nodeB.parent);
    }

    // Walk up until they converge
    while (nodeA.zone !== nodeB.zone) {
      if (!nodeA.parent || !nodeB.parent) {
        break;
      }
      nodeA = this.getNode(nodeA.parent);
      nodeB = this.getNode(nodeB.parent);
    }

    return nodeA.zone;
  }

  /**
   * Returns true if `potentialAncestor` is an ancestor of `descendant` (or the same node).
   */
  public isAncestor(potentialAncestor: Zone, descendant: Zone): boolean {
    let curr: Zone | null = descendant;
    while (curr) {
      if (curr === potentialAncestor) return true;
      curr = this.getNode(curr).parent;
    }
    return false;
  }

  /**
   * Generates the unique directed route, directed edges, and total distance
   * between two zones on the tree.
   */
  public getRoute(from: Zone, to: Zone): TreeRoute {
    if (from === to) {
      return {
        from,
        to,
        lca: from,
        path: [from],
        edges: [],
        totalDistanceKm: 0,
      };
    }

    const lca = this.findLCA(from, to);

    // 1. Upward leg: from -> LCA
    const upNodes: Zone[] = [];
    let curr: Zone | null = from;
    while (curr && curr !== lca) {
      upNodes.push(curr);
      curr = this.getNode(curr).parent;
    }
    upNodes.push(lca);

    // 2. Downward leg: LCA -> to
    const downNodes: Zone[] = [];
    curr = to;
    while (curr && curr !== lca) {
      downNodes.push(curr);
      curr = this.getNode(curr).parent;
    }

    // Combined ordered path: upNodes + reversed downNodes
    const fullPath = [...upNodes, ...downNodes.reverse()];

    // Generate directed edges and sum distances
    const edges: DirectedTreeEdge[] = [];
    let totalDistanceKm = 0;

    for (let i = 0; i < fullPath.length - 1; i++) {
      const u = fullPath[i];
      const v = fullPath[i + 1];
      const uNode = this.getNode(u);
      const vNode = this.getNode(v);

      // Edge weight between parent and child
      const distanceKm =
        uNode.parent === v
          ? uNode.distanceToParent
          : vNode.parent === u
          ? vNode.distanceToParent
          : DISTANCE_MATRIX[u][v];

      edges.push({ from: u, to: v, distanceKm });
      totalDistanceKm += distanceKm;
    }

    return {
      from,
      to,
      lca,
      path: fullPath,
      edges,
      totalDistanceKm,
    };
  }

  /**
   * Calculates the exact tree distance between any two zones in O(1)
   * using precalculated distFromRoot and LCA.
   */
  public getDistance(from: Zone, to: Zone): number {
    if (from === to) return 0;
    const lca = this.findLCA(from, to);
    const nodeFrom = this.getNode(from);
    const nodeTo = this.getNode(to);
    const nodeLca = this.getNode(lca);

    return nodeFrom.distFromRoot + nodeTo.distFromRoot - 2 * nodeLca.distFromRoot;
  }

  /**
   * Computes the directed tree edges shared by two routes in the exact same direction.
   */
  public getSharedEdges(routeA: TreeRoute, routeB: TreeRoute): DirectedTreeEdge[] {
    const setA = new Set(routeA.edges.map((e) => `${e.from}->${e.to}`));
    return routeB.edges.filter((e) => setA.has(`${e.from}->${e.to}`));
  }

  /**
   * Calculates what percentage (0.0 to 1.0) of candidateRoute's distance
   * is covered by baseRoute in the same direction.
   */
  public getOverlapRatio(baseRoute: TreeRoute, candidateRoute: TreeRoute): number {
    if (candidateRoute.totalDistanceKm === 0) return 1.0;
    const sharedEdges = this.getSharedEdges(baseRoute, candidateRoute);
    const sharedDistance = sharedEdges.reduce((sum, e) => sum + e.distanceKm, 0);
    return Math.min(1.0, sharedDistance / candidateRoute.totalDistanceKm);
  }

  /**
   * Checks whether candidateRoute is a strict contiguous sub-path of baseRoute.
   * (e.g., Rider A travels A -> B -> C -> D, and Rider B travels B -> C).
   */
  public isSubRoute(baseRoute: TreeRoute, candidateRoute: TreeRoute): boolean {
    if (candidateRoute.path.length > baseRoute.path.length) return false;
    const baseStr = baseRoute.path.join(',');
    const candStr = candidateRoute.path.join(',');
    return baseStr.includes(candStr);
  }
}

/**
 * Singleton instance of the Dhaka City Tree rooted at Mohakhali.
 */
export const dhakaTree = new DhakaCityTree('MOHAKHALI');

