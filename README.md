#  LogisticsAI - Dynamic Route Optimization & Fleet Swarm Dashboard

LogisticsAI is a production-grade full-stack fleet logistics dashboard inspired by advanced modern enterprise services like Amazon Logistics. The application leverages **Ant Colony Optimization (ACO)** swarm intelligence algorithms to solve the Vehicle Routing Problem (VRP) and Travelling Salesperson Problem (TSP) in dynamic urban settings.

The platform marries advanced metaheuristics with a visually stunning, glassmorphic dark-theme user experience. Through a high-performance transparent **HTML5 Canvas overlay on Leaflet.js dark tiles**, operators can visually inspect simulated ant swarms exploring coordinate grids, leaving glowing neon pheromone trails, and converging on the shortest path.

---

## Key Technical Highlights

1. **Intelligent VRP ACO Engine**: Multi-vehicle fleet routing that balances distances, package priority classes (Critical, High, Medium, Low), customer demands, and carrying payload capacities.
2. **Dual-Layer Canvas Map Visualizer**: High-performance rendering featuring:
   - Draggable delivery markers that update spatial coordinates and trigger real-time path recalculations on-the-fly.
   - Click-to-drop coordinate pins that map pixel locations back to latitude/longitude.
   - Dozens of animated crawling particle "ants" traveling along paths.
   - Dynamic neon cyan/purple pheromone lines, scaling width and opacity with real-time learning updates.
   - Converged optimal routes highlighted in glowing emerald green with travel direction arrows.
3. **SQLite Database Persistence**: Complete CRUD SQLite schema storing registered users, dispatch orders, and logged historical optimized route calculations.
4. **Interactive Glassmorphic Interface**: Play, Pause, Speed slider (1x up to 10x), Parameter tuning tooltips, dynamic metrics cards, scrolling telemetry log stream, and a print-ready **PDF Manifest Export** sequenced in the exact order of optimal visit.

---

## Directory Architecture

```text
smart-logistics/
├── preview.html                 # Offline single-file zero-configuration demo
├── docker-compose.yml           # Unified services orchestration
├── README.md                    # System documentation and manuals
├── .env                         # Global configurations and keys
├── backend/
│   ├── Dockerfile               # Backend python container
│   ├── requirements.txt         # Pip package definitions
│   └── app/
│       ├── main.py              # FastAPI server boot and WS telemetry
│       ├── db.py                # SQLite database operations and schemas
│       ├── api/
│       │   ├── routes.py        # API endpoints (Auth, Deliveries, optimize)
│       │   └── schemas.py       # Pydantic validation structures
│       ├── auth/
│       │   └── auth.py          # Cryptography, bcrypt password hashing, role guards
│       └── ml/
│           └── ant_colony/
│               └── aco.py       # Python Ant Colony Optimization solver
└── frontend/
    ├── Dockerfile               # Frontend nginx build stage container
    ├── package.json             # NPM node dependencies
    ├── vite.config.js           # Vite configurator
    ├── tailwind.config.js       # Tailwind CSS configurations
    ├── postcss.config.js        # PostCSS directives
    ├── index.html               # Main HTML frame mount
    └── src/
        ├── main.jsx             # React mounting entry point
        ├── index.css            # Stylesheets, custom scrollbars, and keyframe animations
        ├── App.jsx              # Main tab controller, state, and Auth guards
        ├── pages/
        │   └── Dashboard.jsx    # Metrics deck, dispatches, event log stream, jsPDF exports
        └── components/
            ├── AcoSettings.jsx  # Swarm parameters sliders and tooltips
            └── AcoVisualizer.jsx# Leaflet + transparent Canvas overlay particle visualizer
```

---

## Global Environment Variables (`.env`)

Configure the `.env` file in the project's root folder:
```env
# Database Configuration
# Default sqlite file path
SQLITE_DB_PATH=backend/app/logistics.db

# JWT Security
JWT_SECRET=supersecurelogisticssecretkey128bit
ACCESS_TOKEN_EXPIRE_MINUTES=120

# API Configuration
REACT_APP_API_URL=http://localhost:8000
```

---

## Step-by-Step Local Boot Instructions

You can run this full-stack system in two ways depending on your installed tools:

### Option A: Standard Full-Stack Boot (No Docker Required)

Ensure you have **Python 3.10+** and **Node.js 18+** installed on your machine.

#### 1. Setup & Launch the Backend Server
1. Open a terminal and navigate to the backend folder:
   ```bash
   cd C:\Users\Admin\.gemini\antigravity\scratch\smart-logistics\backend
   ```
2. Create and activate a Python virtual environment:
   ```bash
   # Windows PowerShell
   python -m venv venv
   .\venv\Scripts\Activate.ps1
   
   # Linux / macOS
   python3 -m venv venv
   source venv/bin/activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Start the FastAPI hot-reload server:
   ```bash
   uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
   ```
   *The interactive Swagger documentation will be available at `http://127.0.0.1:8000/docs`.*

#### 2. Setup & Launch the Frontend
1. Open a new terminal and navigate to the frontend folder:
   ```bash
   cd C:\Users\Admin\.gemini\antigravity\scratch\smart-logistics\frontend
   ```
2. Install node packages:
   ```bash
   npm install
   ```
3. Boot the Vite React developer server:
   ```bash
   npm run dev
   ```
4. Access the active dashboard by opening `http://localhost:3000` in your web browser.

---

### Option B: Docker Containerized Launch

Ensure **Docker Desktop** is running.
1. Open a terminal inside the project's root folder:
   ```bash
   cd C:\Users\Admin\.gemini\antigravity\scratch\smart-logistics
   ```
2. Build and spin up the containers in the background:
   ```bash
   docker-compose up --build -d
   ```
3. Open `http://localhost:3000` in your browser to view the application.

---

## Mathematical Formulation: Ant Colony System (ACS)

The core optimization engine resolves the Vehicle Routing Problem (VRP) by simulating cooperative artificial swarm intelligence.

### 1. The Decision Rule (Transition Probability)

At node $i$, an ant $k$ evaluates the transition probability $P_{ij}^k$ of choosing node $j$ next:

$$P_{ij}^k = \frac{[\tau_{ij}]^\alpha \cdot [\eta_{ij}]^\beta}{\sum_{l \in \text{allowed}_k} [\tau_{il}]^\alpha \cdot [\eta_{il}]^\beta}$$

Where:
- $\tau_{ij}$ represents the **Pheromone Concentration** on the edge $(i, j)$. Stronger trails denote historically highly-effective routes.
- $\eta_{ij}$ is the **Heuristic Desirability** defined as:
  $$\eta_{ij} = \frac{1 + (\text{priority}_j \times 0.15)}{d_{ij} \cdot t_{ij}}$$
  where $d_{ij}$ is the Haversine distance, $t_{ij}$ is traffic congestion, and critical priority levels decrease travel resistance, drawing ants in early.
- $\alpha$ (Alpha Slider) governs the weight of pheromones (learning rate).
- $\beta$ (Beta Slider) governs the weight of visibility (greedy distance minimization).

### 2. Pheromone Evaporation

To prevent the swarm from converging on sub-optimal pathways (local minima), a percentage of pheromones decays after each cycle:

$$\tau_{ij} \leftarrow (1 - \rho)\tau_{ij}$$

Where $\rho$ (Evaporation Rate Slider) is a decay factor between `0.0` and `1.0`.

### 3. Pheromone Deposit (Global Path Reinforcement)

All ants lay pheromones along the edges they traversed, inversely proportional to their total tour distance $L_k$:

$$\tau_{ij} \leftarrow \tau_{ij} + \sum_{k=1}^{m} \Delta\tau_{ij}^k$$

$$\Delta\tau_{ij}^k = \frac{Q}{L_k}$$

Where $Q$ is a deposit constant and $m$ is the swarm ant count.

### 4. Vehicle Routing Constraints (VRP)

During step selections, each ant maintains a strict capacity register representing cargo space limits:
- If `demands[node] > remaining_capacity`, that node is temporarily filtered out of the `allowed` choices list.
- If all unvisited nodes exceed cargo capacity, the ant is forced to return to the Depot ($0$) to replenish, and a new truck route is instantiated.

---

## Verification & Sandbox Controls

- **Default credentials**:
  - Dispatcher: `dispatcher@logistics.ai` / `supersecure123`
  - Driver: `driver@logistics.ai` / `supersecure123`
  - Administrator: `admin@logistics.ai` / `supersecure123`
- **Zero-Configuration failover**: If uvicorn is offline, the frontend automatically activates **Sandbox Mode**, carrying out the entire ACO mathematical pipeline inside the browser via client-side Javascript. You can inspect all visual elements and animations seamlessly!
