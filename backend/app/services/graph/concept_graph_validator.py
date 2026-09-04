"""
Knowledge Graph Validation & Cycle Detection Engine — SentiNews Learn V0.4 / CG-01 / Master Prompt
Enforces strict Directed Acyclic Graph (DAG) invariants on all prerequisite relationships:
1. Kahn's Algorithm for Topological Sort & Fast Cycle Detection.
2. DFS Diagnostic Path Generation for actionable, human-readable error messages (Senior Review Directive 4).
3. Dangling Node Detection & Orphan Auditing.
4. Pre-commit Prospective Edge Validation.
"""
from typing import List, Dict, Set, Tuple, Optional, Any
from dataclasses import dataclass, field
import uuid


@dataclass
class ValidationReport:
    is_valid: bool
    cycles_detected: List[List[str]] = field(default_factory=list)
    cycle_descriptions: List[str] = field(default_factory=list)
    missing_prerequisites: List[Tuple[str, str]] = field(default_factory=list)
    unreachable_nodes: List[str] = field(default_factory=list)
    total_nodes: int = 0
    total_edges: int = 0
    topological_order: List[str] = field(default_factory=list)


class ConceptGraphValidator:
    """
    Validates concept prerequisite graphs to ensure zero circular dependencies
    and strict DAG compliance before seeding or publishing curriculum data.
    """

    @classmethod
    def validate_graph(
        cls,
        nodes: List[Dict[str, Any]],
        prerequisite_edges: List[Tuple[str, str]],
    ) -> ValidationReport:
        """
        nodes: list of dicts with at least 'slug' or 'id' (str)
        prerequisite_edges: list of (source_slug, target_slug) where source is prerequisite for target (source -> target)
        """
        canonical_map: Dict[str, str] = {}
        for n in nodes:
            canon = str(n.get("slug") or n.get("id"))
            canonical_map[canon] = canon
            if "id" in n and n["id"]:
                canonical_map[str(n["id"])] = canon
            if "slug" in n and n["slug"]:
                canonical_map[str(n["slug"])] = canon

        node_set: Set[str] = set(canonical_map.values())
        adjacency: Dict[str, Set[str]] = {slug: set() for slug in node_set}
        in_degree: Dict[str, int] = {slug: 0 for slug in node_set}
        missing_prereqs: List[Tuple[str, str]] = []

        total_edges = 0
        for prereq, target in prerequisite_edges:
            prereq_raw = str(prereq)
            target_raw = str(target)
            if prereq_raw not in canonical_map or target_raw not in canonical_map:
                missing_prereqs.append((prereq_raw, target_raw))
                continue
            prereq_canon = canonical_map[prereq_raw]
            target_canon = canonical_map[target_raw]
            if target_canon not in adjacency[prereq_canon]:
                adjacency[prereq_canon].add(target_canon)
                in_degree[target_canon] += 1
                total_edges += 1

        # 1. Kahn's Algorithm for Topological Sort & Cycle Detection
        queue = [slug for slug, deg in in_degree.items() if deg == 0]
        in_degree_copy = dict(in_degree)
        topological_order: List[str] = []

        while queue:
            curr = queue.pop(0)
            topological_order.append(curr)
            for neighbor in adjacency.get(curr, []):
                in_degree_copy[neighbor] -= 1
                if in_degree_copy[neighbor] == 0:
                    queue.append(neighbor)

        has_cycle = len(topological_order) < len(node_set)
        cycles: List[List[str]] = []
        cycle_descriptions: List[str] = []

        # 2. If cycle detected, generate actionable DFS diagnostic paths (Directive 4)
        if has_cycle:
            visited: Dict[str, int] = {slug: 0 for slug in node_set}  # 0=unvisited, 1=visiting, 2=visited
            path: List[str] = []

            def dfs(u: str):
                visited[u] = 1
                path.append(u)
                for v in sorted(adjacency.get(u, [])):
                    if visited.get(v, 0) == 1:
                        cycle_start = path.index(v)
                        cycle_path = path[cycle_start:] + [v]
                        cycles.append(cycle_path)
                        cycle_descriptions.append(" → ".join(cycle_path))
                    elif visited.get(v, 0) == 0:
                        dfs(v)
                path.pop()
                visited[u] = 2

            for node in sorted(node_set):
                if visited[node] == 0:
                    dfs(node)

        is_valid = (not has_cycle) and len(missing_prereqs) == 0

        return ValidationReport(
            is_valid=is_valid,
            cycles_detected=cycles,
            cycle_descriptions=cycle_descriptions,
            missing_prerequisites=missing_prereqs,
            total_nodes=len(node_set),
            total_edges=total_edges,
            topological_order=topological_order if is_valid else [],
        )

    @classmethod
    def validate_prospective_edge(
        cls,
        existing_nodes: List[Dict[str, Any]],
        existing_edges: List[Tuple[str, str]],
        new_source: str,
        new_target: str,
    ) -> Tuple[bool, Optional[str]]:
        """
        Pre-commit validation of a new prerequisite edge without modifying database state.
        Returns (is_allowed, error_message).
        """
        # Reject self-reference
        if new_source == new_target:
            return False, f"Self-referential prerequisite rejected: '{new_source}' cannot depend on itself."

        candidate_edges = list(existing_edges) + [(new_source, new_target)]
        report = cls.validate_graph(existing_nodes, candidate_edges)

        if not report.is_valid:
            if report.cycle_descriptions:
                cycle_str = report.cycle_descriptions[0]
                return False, f"Circular prerequisite detected: {cycle_str}"
            if report.missing_prerequisites:
                missing = report.missing_prerequisites[0]
                return False, f"Referenced concept does not exist: {missing[0]} -> {missing[1]}"
            return False, "Invalid graph modification: Prerequisite DAG invariants violated."

        return True, None
