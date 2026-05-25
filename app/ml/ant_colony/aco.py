import random
import numpy as np
from typing import List, Dict, Tuple, Any

class AntColonyOptimizer:
    """
    Ant Colony Optimization (ACO) engine optimized for dynamic urban logistics.
    Balances distance, traffic congestion, delivery priority weights, and vehicle load capacities.
    """
    def __init__(
        self, 
        distances: np.ndarray,
        demands: List[float],
        capacities: List[float],
        priorities: List[int],  # 1 = Low, 2 = Medium, 3 = High, 4 = Critical
        traffic_matrix: np.ndarray = None,
        alpha: float = 1.0,      # Pheromone importance
        beta: float = 2.0,       # Heuristic importance (visibility)
        rho: float = 0.1,        # Pheromone evaporation rate
        Q: float = 100.0,        # Pheromone deposit factor
        num_ants: int = 20,
        num_iterations: int = 50
    ):
        self.distances = distances
        self.demands = demands
        self.capacities = capacities
        self.priorities = priorities
        self.num_nodes = len(distances)
        
        # If no traffic matrix is specified, assume ideal conditions (matrix of 1.0)
        self.traffic_matrix = traffic_matrix if traffic_matrix is not None else np.ones_like(distances)
        
        self.alpha = alpha
        self.beta = beta
        self.rho = rho
        self.Q = Q
        self.num_ants = num_ants
        self.num_iterations = num_iterations
        
        # Initialize symmetric pheromone matrix
        self.pheromones = np.ones((self.num_nodes, self.num_nodes)) * 0.1

    def _get_transition_probability(
        self, 
        current_node: int, 
        unvisited: List[int], 
        remaining_capacity: float
    ) -> np.ndarray:
        """
        Calculates transition probability from current_node to all unvisited nodes.
        Filters out nodes that exceed remaining capacity.
        Incorporates distance, traffic severity, and priority values in the visibility heuristic.
        """
        probabilities = np.zeros(self.num_nodes)
        
        for node in unvisited:
            # Capacity check
            if self.demands[node] > remaining_capacity:
                continue
                
            # Visibility heuristic incorporates distance, traffic intensity, and priority level
            # 1. Base travel time factor = distance * traffic_severity (higher is worse)
            base_cost = self.distances[current_node][node] * self.traffic_matrix[current_node][node]
            # 2. Priority boost: Critical tasks reduce path resistance to pull ants in early
            priority_boost = 1.0 + (self.priorities[node] * 0.15)
            
            # Heuristic calculation (eta)
            # Visibility is inversely proportional to adjusted travel cost
            eta = priority_boost / max(0.0001, base_cost)
            
            # Pheromone value (tau)
            tau = self.pheromones[current_node][node]
            
            probabilities[node] = (tau ** self.alpha) * (eta ** self.beta)
            
        prob_sum = np.sum(probabilities)
        if prob_sum > 0:
            return probabilities / prob_sum
        else:
            # Fallback: Equal probability if all parameters are zero
            valid_nodes = [node for node in unvisited if self.demands[node] <= remaining_capacity]
            if not valid_nodes:
                return np.zeros(self.num_nodes)
            p = np.zeros(self.num_nodes)
            p[valid_nodes] = 1.0 / len(valid_nodes)
            return p

    def _construct_ant_route(self) -> Dict[str, Any]:
        """
        Constructs a complete delivery schedule for all vehicles.
        Ants construct routes sequentially based on capacities.
        """
        all_routes = []
        unvisited = list(range(1, self.num_nodes)) # Depot is 0
        total_distance = 0.0
        
        # Vehicle pointer
        veh_idx = 0
        
        while unvisited and veh_idx < len(self.capacities):
            route = [0] # Start at depot
            rem_capacity = self.capacities[veh_idx]
            current = 0
            
            while unvisited:
                # Calculate selection odds
                probs = self._get_transition_probability(current, unvisited, rem_capacity)
                if np.sum(probs) == 0:
                    # Capacity limit reached for this vehicle, return to depot
                    break
                    
                # select next delivery destination via roulette wheel selector
                next_node = int(np.random.choice(range(self.num_nodes), p=probs))
                
                route.append(next_node)
                unvisited.remove(next_node)
                rem_capacity -= self.demands[next_node]
                total_distance += self.distances[current][next_node]
                current = next_node
                
            # Return vehicle to Central Depot
            route.append(0)
            total_distance += self.distances[current][0]
            all_routes.append(route)
            veh_idx += 1
            
        # Penalize if some dispatches could not be served due to vehicle constraints
        unserved_penalty = len(unvisited) * 100.0
        
        return {
            "routes": all_routes,
            "distance": total_distance + unserved_penalty,
            "unserved_count": len(unvisited)
        }

    def optimize(self) -> Dict[str, Any]:
        """
        Main optimization pipeline running iteratively over swarm cycles.
        """
        best_solution = None
        best_distance = float('inf')
        history = []

        for iteration in range(self.num_iterations):
            solutions = []
            
            for ant in range(self.num_ants):
                sol = self._construct_ant_route()
                solutions.append(sol)
                
                if sol["distance"] < best_distance:
                    best_distance = sol["distance"]
                    best_solution = sol
                    
            # Evaporate pheromones
            self.pheromones *= (1.0 - self.rho)
            
            # Reinforce paths of best solutions
            for sol in solutions:
                # Add pheromones proportional to route quality
                deposit = self.Q / max(0.1, sol["distance"])
                for route in sol["routes"]:
                    for i in range(len(route) - 1):
                        u, v = route[i], route[i+1]
                        self.pheromones[u][v] += deposit
                        self.pheromones[v][u] += deposit # Symmetric path reinforcement
                        
            history.append(best_distance)
            
        return {
            "optimal_routes": best_solution["routes"] if best_solution else [],
            "distance_km": best_distance,
            "unserved_deliveries": best_solution["unserved_count"] if best_solution else 0,
            "convergence_history": history
        }
