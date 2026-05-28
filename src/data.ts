export interface PredefinedSyllabus {
  id: string;
  name: string;
  category: string;
  icon: string;
  description: string;
  documentText: string;
}

export const PREDEFINED_SYLLABI: PredefinedSyllabus[] = [
  {
    id: "cloud-native",
    name: "Kubernetes & Cloud Native Architectures",
    category: "DevOps & SRE",
    icon: "Cloud",
    description: "Multi-cluster topology, custom controllers, scheduling constraints, network policies, service meshes, SecOps, and container security boundaries.",
    documentText: `Syllabus: Cloud Native Systems & Kubernetes Orchestration.
Major Skills:
1. Multi-Cluster Orchestration and Federation architectures.
2. Custom Resource Definitions (CRDs) and custom operators with go-client patterns.
3. Pod Scheduling constraints: NodeSelector, Taints, Tolerations, NodeAffinity, and PodAntiAffinity.
4. Kubernetes Networking: Calico vs Flannel, Network Policies, Ingress Controllers, Gateway API, and Istio Service Mesh.
5. Container Security: AppArmor profiles, Seccomp policies, ReadOnly root filesystems, runAsNonRoot, and Pod Security Standards (PSS).
6. Resource Boundaries: CPU/Memory Request/Limit definitions, Vertical Pod Autoscaling (VPA), Horizontal Pod Autoscaling (HPA), and Karpenter Node Auto-provisioning.
7. Secrets Management: KMS Secrets Encryption at Rest, SealedSecrets, and Vault Workload Identity mappings.
8. Cost Optimization: Spot Instance utilization strategies, Descheduler policies to combat fragmentation, and OpenCost/Kubecost telemetry pipelines.`
  },
  {
    id: "react-architecture",
    name: "React 19 & Frontend Systems Design",
    category: "Frontend Engineering",
    icon: "Layers",
    description: "React Server Components (RSC), hydration dynamics, transitions API, Compiler (React Forget), actions, and high-performance offline prefetching.",
    documentText: `Syllabus: React 19 Advanced Architecture & Client Systems.
Major Skills:
1. React Server Components (RSC) vs Client Components: serialization boundaries, stream rendering, and server actions.
2. React 19 Hooks: useActionState, useFormStatus, useOptimistic, and the 'use' API for resources/promises.
3. Hydration Tactics: selective hydration, lazy bundling boundaries, Suspense boundary fallback optimization.
4. React Compiler (React Forget) mechanics: auto-memoization, dependency-array elimination, and cache invalidation.
5. High Performance Rendering: Virtualized grids (e.g., react-window), debouncing strategies, and requestAnimationFrame throttling.
6. Offline Synchronization: service workers, client-side caching (IndexedDB/localStorage), and background sync techniques.
7. Advanced State Engines: Zustand transient updates, XState finite state machines, and fine-grained reactivity.
8. Core CSS & Web Performance: Tailwind CSS v4 performance characteristics, font preloading, and Layout Stability (CLS) mitigations.`
  },
  {
    id: "system-design",
    name: "High-Performance Distributed Systems",
    category: "Backend & Systems",
    icon: "Cpu",
    description: "High-concurrency event loops, Redis/Memcached cache coherence, distributed consensus, write-ahead logs, and database sharding patterns.",
    documentText: `Syllabus: High-Performance Backends & Distributed Systems.
Major Skills:
1. Event-Loop Internals: Node.js worker pools, libuv thread scheduling, and asynchronous context namespaces.
2. Cache Coherence & Hydration: Redis Write-Through vs Write-Behind strategies, Cache Stampede mitigations, and Bloom Filter optimizations.
3. Database Sharding & Partitioning: consistent hashing rings, schema normalization vs denormalization tradeoffs, and query index tuning.
4. Distributed Consensus: Raft vs Paxos principles, split-brain resolutions, and quorum replication boundaries.
5. High-Throughput Messaging: Apache Kafka partitions, consumer group rebalancing, event sourcing, and write-ahead logs.
6. API Engineering: gRPC HTTP/2 multiplexing, GraphQL query parsing, query depth analyzers, and Rate Limiting (Token Bucket & Leaky Bucket algorithms).
7. Resilience Patterns: Circuit Breakers, Exponential Backoffs with jitter, Bulkheads, and fallback caches.
8. Cryptography and Identity: JWT asymmetric signing (RS256), OAuth PKCE token exchange, and OWASP Top 10 API Security controls.`
  },
  {
    id: "rust-systems",
    name: "Systems Programming & Rust Safety",
    category: "Low-Level Systems",
    icon: "Terminal",
    description: "Ownership & Borrowing correctness, data race prevention, raw pointers, custom memory allocators (jemalloc), and unsafe block audits.",
    documentText: `Syllabus: Systems Programming & Memory Safety with Rust.
Major Skills:
1. Ownership and Lifetime Borrow-checking mechanics.
2. Fearless Concurrency: Send & Sync trait boundaries, Arc and Mutex contention, and lock-free thread-safe queues.
3. Memory Representation: Stack vs Heap layout, Box, Rc, Cell, and RefCell runtime overheads.
4. Unsafe Rust: inline assembly, raw pointer dereferencing, and FFI bindings with safe wrappers.
5. Performance Compilations: SIMD vectorization, compilation flags optimization, and custom memory memory allocators.
6. Rust Macro Metaprogramming: Declarative macro syntax and Procedural macros (Derive, Attribute, Function-like).
7. Error Handling: Result, Option, anyhow crate boundaries, and backtrace propagation.
8. Asynchronous Runtime Mechanics: Future poll models, Pin/Unpin pinning wrappers, and Tokio thread-pool executor metrics.`
  }
];
