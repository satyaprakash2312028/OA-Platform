# Codephilia: High-Performance Online Judge & OA Platform (Backend)

Codephilia is an industry-grade, horizontally scalable Online Assessment (OA) platform and competitive programming judge. Built to handle massive concurrent traffic spikes (e.g., during live contests) and computationally expensive code-execution tasks, the backend architecture prioritizes asynchronous decoupling, sub-millisecond data retrieval, and secure, sandboxed execution.

---

## 📑 Table of Contents
1. [Macro Architecture](#-1-macro-architecture-the-birds-eye-view)
2. [The Execution Engine & Sandbox](#-2-the-execution-engine-security--decoupling)
3. [Performance Optimization & Caching](#-3-deep-dive-performance-optimization--caching-strategies)
4. [Real-Time Telemetry](#-4-real-time-telemetry-socketio)
5. [Directory & Component Map](#-5-architecture-directory-map)
6. [Local Setup & Deployment](#-6-local-development--deployment-strategy)

---

## 🏗️ 1. Macro Architecture: The Bird's Eye View

The system completely decouples the **REST API (User Interactions)** from the **Execution Engine (Code Compilation & Testing)**. This ensures that even if thousands of students submit code simultaneously during a placement drive, the primary web server remains highly responsive and never drops a connection.

```mermaid
graph TD
    %% Define Nodes
    Client[Client Browser / SPA]
    Gateway[Express API / Load Balancer]
    Sockets[Socket.io Real-Time Engine]
    
    subgraph Data Persistence & Caching
        Mongo[(MongoDB Atlas\nSource of Truth)]
        Redis[(Redis Cluster\nHigh-Speed Access Layer)]
    end
    
    subgraph Asynchronous Message Broker
        Queue[[RabbitMQ / BullMQ\nSubmission Queue]]
    end
    
    subgraph Execution Pool
        Worker1[Worker Node 1\nDocker Sandbox]
        Worker2[Worker Node 2\nDocker Sandbox]
    end

    %% Define Connections
    Client -- HTTP GET/POST --> Gateway
    Client -- WebSocket Transport --> Sockets
    
    Gateway -- Mongoose Exec Hijacking --> Mongo
    Gateway -- Cache-Aside & O(1) Checks --> Redis
    Gateway -- Enqueues Task --> Queue
    
    Queue -- Consumes Task --> Worker1
    Queue -- Consumes Task --> Worker2
    
    Worker1 -- POST /internal/verdict --> Gateway
    Gateway -- Emits 'statusUpdate' --> Sockets