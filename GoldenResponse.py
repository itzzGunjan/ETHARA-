import json
import math
import random
from typing import Dict, List, Any, Tuple


class ACORouteOptimizer:
    """
    Production-grade Ant Colony Optimization (ACO)
    route optimization simulator for intelligent
    package delivery systems.
    """

    INITIAL_PHEROMONE = 1.0
    EVAPORATION_RATE = 0.15
    ALPHA = 1.0
    BETA = 2.0
    ITERATIONS = 25

    def __init__(self) -> None:
        self.delivery_nodes: List[Dict[str, Any]] = []
        self.pheromones: Dict[Tuple[str, str], float] = {}

    def load_delivery_data(
        self,
        delivery_nodes: List[Dict[str, Any]]
    ) -> None:
        """
        Load and validate delivery nodes.
        Removes duplicate entries safely.
        """

        if not isinstance(delivery_nodes, list):
            raise ValueError(
                "Delivery nodes must be provided as a list."
            )

        validated_nodes = []
        seen_node_ids = set()

        for node in delivery_nodes:

            if not self._is_valid_node(node):
                continue

            node_id = node["id"]

            if node_id in seen_node_ids:
                continue

            seen_node_ids.add(node_id)
            validated_nodes.append(node)

        self.delivery_nodes = validated_nodes

    def initialize_pheromones(self) -> None:
        """
        Initialize pheromone levels
        between all node pairs.
        """

        for node_a in self.delivery_nodes:
            for node_b in self.delivery_nodes:

                if node_a["id"] == node_b["id"]:
                    continue

                edge = (
                    node_a["id"],
                    node_b["id"]
                )

                self.pheromones[edge] = (
                    self.INITIAL_PHEROMONE
                )

    def calculate_route_cost(
        self,
        node_a: Dict[str, Any],
        node_b: Dict[str, Any]
    ) -> float:
        """
        Calculate weighted route cost using:
        - Euclidean distance
        - Traffic multiplier
        - Priority multiplier
        """

        distance = math.sqrt(
            (node_a["x"] - node_b["x"]) ** 2 +
            (node_a["y"] - node_b["y"]) ** 2
        )

        traffic_multiplier = node_b["traffic"]

        priority_multiplier = (
            1 / max(node_b["priority"], 1)
        )

        weighted_cost = (
            distance *
            traffic_multiplier *
            priority_multiplier
        )

        return round(weighted_cost, 2)

    def run_aco_optimization(self) -> List[List[str]]:
        """
        Execute simplified Ant Colony Optimization.
        """

        if not self.delivery_nodes:
            return []

        best_route = []
        best_cost = float("inf")

        for _ in range(self.ITERATIONS):

            current_route = self._construct_route()

            current_cost = self._calculate_total_route_cost(
                current_route
            )

            if current_cost < best_cost:
                best_cost = current_cost
                best_route = current_route

            self._update_pheromones(
                current_route,
                current_cost
            )

        return [best_route]

    def generate_report(self) -> Dict[str, Any]:
        """
        Generate analytics report.
        """

        optimized_routes = self.run_aco_optimization()

        total_distance = 0.0

        if optimized_routes:

            route = optimized_routes[0]

            for index in range(len(route) - 1):

                node_a = self._get_node_by_id(
                    route[index]
                )

                node_b = self._get_node_by_id(
                    route[index + 1]
                )

                total_distance += (
                    self.calculate_route_cost(
                        node_a,
                        node_b
                    )
                )

        average_delivery_time = round(
            total_distance / max(
                len(self.delivery_nodes),
                1
            ),
            2
        )

        fuel_efficiency_score = round(
            max(0, 100 - total_distance),
            2
        )

        return {
            "optimized_routes": optimized_routes,
            "total_distance": round(
                total_distance,
                2
            ),
            "average_delivery_time": (
                average_delivery_time
            ),
            "fuel_efficiency_score": (
                fuel_efficiency_score
            ),
            "successful_deliveries": (
                len(self.delivery_nodes)
            )
        }

    def export_json(
        self,
        filepath: str
    ) -> None:
        """
        Export optimization report to JSON.
        """

        report = self.generate_report()

        with open(
            filepath,
            "w",
            encoding="utf-8"
        ) as json_file:

            json.dump(
                report,
                json_file,
                indent=4
            )

    def _construct_route(self) -> List[str]:
        """
        Construct delivery route using
        pheromone-guided probabilistic selection.
        """

        unvisited_nodes = (
            self.delivery_nodes.copy()
        )

        current_node = random.choice(
            unvisited_nodes
        )

        route = [current_node["id"]]

        unvisited_nodes.remove(current_node)

        while unvisited_nodes:

            next_node = self._select_next_node(
                current_node,
                unvisited_nodes
            )

            route.append(next_node["id"])

            unvisited_nodes.remove(next_node)

            current_node = next_node

        return route

    def _select_next_node(
        self,
        current_node: Dict[str, Any],
        candidates: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Select next node using pheromone
        probability weighting.
        """

        probabilities = []

        total_weight = 0.0

        for candidate in candidates:

            edge = (
                current_node["id"],
                candidate["id"]
            )

            pheromone = self.pheromones.get(
                edge,
                self.INITIAL_PHEROMONE
            )

            distance_cost = (
                self.calculate_route_cost(
                    current_node,
                    candidate
                )
            )

            heuristic = (
                1 / max(distance_cost, 0.1)
            )

            weight = (
                (pheromone ** self.ALPHA) *
                (heuristic ** self.BETA)
            )

            probabilities.append(
                (candidate, weight)
            )

            total_weight += weight

        random_pick = random.uniform(
            0,
            total_weight
        )

        cumulative_weight = 0.0

        for candidate, weight in probabilities:

            cumulative_weight += weight

            if cumulative_weight >= random_pick:
                return candidate

        return candidates[0]

    def _update_pheromones(
        self,
        route: List[str],
        route_cost: float
    ) -> None:
        """
        Apply pheromone evaporation and reinforcement.
        """

        for edge in self.pheromones:

            self.pheromones[edge] *= (
                1 - self.EVAPORATION_RATE
            )

        pheromone_boost = (
            1 / max(route_cost, 1)
        )

        for index in range(len(route) - 1):

            edge = (
                route[index],
                route[index + 1]
            )

            self.pheromones[edge] += (
                pheromone_boost
            )

    def _calculate_total_route_cost(
        self,
        route: List[str]
    ) -> float:
        """
        Calculate total route cost.
        """

        total_cost = 0.0

        for index in range(len(route) - 1):

            node_a = self._get_node_by_id(
                route[index]
            )

            node_b = self._get_node_by_id(
                route[index + 1]
            )

            total_cost += (
                self.calculate_route_cost(
                    node_a,
                    node_b
                )
            )

        return round(total_cost, 2)

    def _get_node_by_id(
        self,
        node_id: str
    ) -> Dict[str, Any]:
        """
        Retrieve node by ID.
        """

        for node in self.delivery_nodes:

            if node["id"] == node_id:
                return node

        raise ValueError(
            f"Node '{node_id}' not found."
        )

    @staticmethod
    def _is_valid_node(
        node: Dict[str, Any]
    ) -> bool:
        """
        Validate delivery node safely.
        """

        required_fields = {
            "id",
            "x",
            "y",
            "traffic",
            "priority"
        }

        if not isinstance(node, dict):
            return False

        if not required_fields.issubset(
            node.keys()
        ):
            return False

        try:
            float(node["x"])
            float(node["y"])

            if float(node["traffic"]) <= 0:
                return False

            if int(node["priority"]) <= 0:
                return False

        except (
            ValueError,
            TypeError
        ):
            return False

        return True


def print_summary(
    report: Dict[str, Any]
) -> None:
    """
    Print readable optimization summary.
    """

    print("\n=== ACO Optimization Report ===")

    print(
        f"Optimized Routes: "
        f"{report['optimized_routes']}"
    )

    print(
        f"Total Distance: "
        f"{report['total_distance']}"
    )

    print(
        f"Average Delivery Time: "
        f"{report['average_delivery_time']}"
    )

    print(
        f"Fuel Efficiency Score: "
        f"{report['fuel_efficiency_score']}"
    )

    print(
        f"Successful Deliveries: "
        f"{report['successful_deliveries']}"
    )


if __name__ == "__main__":

    sample_delivery_nodes = [
        {
            "id": "PKG-001",
            "x": 10,
            "y": 20,
            "traffic": 1.2,
            "priority": 1
        },
        {
            "id": "PKG-002",
            "x": 25,
            "y": 18,
            "traffic": 1.5,
            "priority": 2
        },
        {
            "id": "PKG-003",
            "x": 42,
            "y": 35,
            "traffic": 1.1,
            "priority": 3
        },
        {
            "id": "PKG-004",
            "x": 18,
            "y": 40,
            "traffic": 1.3,
            "priority": 2
        }
    ]

    optimizer = ACORouteOptimizer()

    optimizer.load_delivery_data(
        sample_delivery_nodes
    )

    optimizer.initialize_pheromones()

    generated_report = (
        optimizer.generate_report()
    )

    optimizer.export_json(
        "aco_optimization_report.json"
    )

    print_summary(generated_report)