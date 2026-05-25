# Context and Role
As a Senior Full-Stack Engineer and UX/UI Designer specializing in logistics technology and interactive data visualizations, you are responsible for designing and implementing a high-performance, visually stunning **Route Optimization & Package Delivery Dashboard**. The core feature of the application is a live, interactive visual simulation of the **Ant Colony Optimization (ACO)** machine learning/metaheuristic algorithm to solve the Travelling Salesperson Problem (TSP) and Vehicle Routing Problem (VRP) for package deliveries.

The application must combine mathematical rigor with a premium, engaging frontend experience, allowing logistics managers to visualize how artificial "ants" explore paths, deposit pheromones, and converge on the absolute shortest delivery route in real time.

# Objective
Develop a complete full-stack web application for Route Package Delivery that:
1. **Manages Deliveries**: Allows users to dynamically add delivery packages with locations (via interactive map clicks or text search), priority levels, and sizes.
2. **Runs the ACO Routing Algorithm**: Applies an Ant Colony Optimization (ACO) algorithm (either via a performant backend endpoint or an optimized frontend Web Worker) to compute the most efficient delivery route.
3. **Visualizes the Simulation**: Provides a real-time, animated visualization of the ACO process (ants crawling, pheromone trails updating, and path convergence).
4. **Calculates Key Metrics**: Shows real-time comparisons between the ACO-optimized route and baseline routes (e.g., Random, Greedy/Nearest Neighbor) in terms of distance, estimated travel time, fuel usage, and carbon footprint reduction.

# UI, UX, and Animation Requirements
### Premium Interactive Map & Canvas
*   **Dual-Layer Visualizer**: A beautiful primary map view (using Leaflet, Mapbox, or an interactive high-performance HTML5 Canvas) representing the delivery zone.
*   **Node Customization**: Clear visual differentiation between the **Start/End Depot** (e.g., animated glowing gold warehouse icon) and **Delivery Stops** (e.g., vibrant colored pins styled by package priority).
*   **Interactive Controls**: Ability to click on the map to instantly drop a delivery stop, drag existing stops to recalculate on-the-fly, or delete stops.

### ACO Live Animation & Visualization
*   **Animated Ants**: Render dozens of tiny, glowing moving particles ("ants") traveling along paths between delivery stops during the exploration phase.
*   **Dynamic Pheromone Trails**: Draw lines connecting all nodes. The opacity and color of these lines must dynamically scale in real-time based on the pheromone concentration ($\tau_{ij}$) (e.g., dim/translucent dark lines for cold paths, turning into thick, neon-glowing cyan/purple lines for strong, high-pheromone paths).
*   **Optimal Path Highlighting**: Once the algorithm converges, animate a bright, pulsing neon green path outlining the final chosen route with custom arrows indicating the direction of travel.

### Responsive Glassmorphic Dashboard
*   **Control Panel Sidebar**: A sleek, dark-mode-first sidebar using glassmorphic styling (`backdrop-blur`), smooth transitions, and high contrast.
*   **Simulation Control Deck**: Play, Pause, Step-by-Step, Reset, and an interactive Speed Slider (from 1x up to 50x simulation speed).
*   **Parameter Tuning Controls**: Beautifully styled sliders and tooltips to tweak the ACO mathematical variables on-the-fly:
    *   **Ant Count** ($m$)
    *   **Pheromone Influence** ($\alpha$)
    *   **Heuristic Distance Influence** ($\beta$)
    *   **Evaporation Rate** ($\rho$)
*   **Micro-interactions**: Use Framer Motion for staggered list entrances of packages, hover expansions on delivery cards, and smooth modal transitions.

# ML & Algorithm Requirements (Ant Colony Optimization - ACO)
The core optimization engine must implement the mathematical rules of the Ant Colony System:
1.  **Distance Matrix**: Construct a complete weighted graph representing the distance (Euclidean or routing distance) between all pairs of coordinates.
2.  **Transition Probability Rule**: The probability $P_{ij}^k$ of ant $k$ moving from node $i$ to node $j$ must follow:
    $$P_{ij}^k = \frac{[\tau_{ij}]^\alpha \cdot [\eta_{ij}]^\beta}{\sum_{l \in \text{allowed}_k} [\tau_{il}]^\alpha \cdot [\eta_{il}]^\beta}$$
    where $\tau_{ij}$ is the pheromone level on edge $(i, j)$, and $\eta_{ij} = 1 / d_{ij}$ is the heuristic desirability (inverse of the distance between node $i$ and $j$).
3.  **Pheromone Evaporation**: After each iteration, update pheromones across all edges:
    $$\tau_{ij} \leftarrow (1 - \rho)\tau_{ij}$$
4.  **Pheromone Deposit**: Ants deposit pheromones on the edges they traversed, inversely proportional to their total tour length $L_k$:
    $$\tau_{ij} \leftarrow \tau_{ij} + \sum_{k=1}^{m} \Delta\tau_{ij}^k, \quad \text{where } \Delta\tau_{ij}^k = \frac{Q}{L_k}$$
5.  **Convergence Analytics**: Track the best distance achieved per iteration and output this data into a line chart (using Recharts or Chart.js) to show the user how the algorithm improves over time.

# Backend & API Requirements
*   **Optimization Endpoint**: A secure POST `/api/route/optimize` endpoint:
    *   **Inputs**: Array of delivery coordinates `[{lat, lng, id}]`, and parameters `{alpha, beta, evaporationRate, antCount, iterations}`.
    *   **Outputs**: Fully sorted array of nodes representing the optimal route, total route distance, estimated duration, and historical step-by-step pheromone data for visual playback.
*   **Database Schema**: A lightweight schema (SQLite, PostgreSQL, or MongoDB) to save and retrieve:
    *   `Deliveries`: Unique ID, package label, customer details, priority, weight, delivery status (`Pending`, `In-Transit`, `Delivered`).
    *   `OptimizedRoutes`: Timestamp, parameters used, total distance saved, coordinate sequence.
*   **Rate Limiting & Security**:
    *   Implement basic rate-limiting on the optimize API to prevent server crashes on extreme node sizes (e.g., cap max nodes to 25 for quick frontend preview, or use a background queue for larger counts).
    *   Sanitize coordinate inputs to prevent injection vulnerabilities.

# Output & Verification Requirements
*   **Real-time Optimization Metrics Deck**:
    *   **Total Distance Saved**: A visual comparison meter showing the optimized distance vs. the initial unoptimized entry sequence.
    *   **ETA Dashboard**: Dynamic arrival times calculated for each delivery stop.
    *   **Analytics Panel**: Interlocking graphs showing iteration vs. best route distance, demonstrating convergence.
*   **PDF Manifest Export**: A "Get Delivery Manifest" button to export a print-ready manifest listing the sequence of stops, package descriptions, and delivery order.
*   **Robust State Management**: Seamlessly handle edge cases such as single-node entries, disconnected graphs, or changing coordinates mid-simulation.

# Error Handling and Documentation
*   Provide informative user-facing alerts when coordinates are invalid or isolated.
*   Gracefully manage cases where a route cannot be resolved or if the algorithm fails to converge within the allotted iterations.
*   **Documentation Output**: Include a clear markdown readme detailing:
    *   The application folder layout.
    *   How to configure local environmental files (`.env`).
    *   Step-by-step local boot instructions.
    *   A breakdown of the mathematical implementation of the ACO algorithm in the code.

# Technology Stack
*   **Frontend**: React.js / Next.js (TypeScript preferred), Framer Motion (for interface transitions), HTML5 Canvas / Leaflet.js (for map & particle rendering), Tailwind CSS.
*   **Backend**: Node.js + Express (or Next.js API Routes), mathjs / custom matrix library for calculations.
*   **Database**: SQLite / LocalStorage / PostgreSQL.
*   **Dependencies**: `dotenv` for environment management, `recharts` for optimization tracking charts.