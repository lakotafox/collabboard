# AI Cost Analysis

CollabBoard -- Real-Time Collaborative Whiteboard

---

## Development and Testing Costs

| Category | Model | Estimated Cost |
|---|---|---|
| Architecture planning | Claude Opus (via Claude Code) | ~$5-8 |
| Code generation | Claude Opus (via Claude Code) | ~$8-12 |
| Debugging and deployment | Claude Opus (via Claude Code) | ~$3-5 |
| AI agent testing (API calls) | Claude Haiku 4.5 | ~$0.05 |
| **Total development AI spend** | | **~$15-25** |

Notes:
- Claude Code (Opus) is the dominant cost -- used for all planning, generation, and debugging
- Haiku 4.5 API calls during testing were minimal: a handful of test commands to verify tool use
- Chrome MCP usage has no additional API cost (runs through the existing Claude Code session)

---

## Production Cost Model

### Pricing Basis: Claude Haiku 4.5
- Input tokens: $1.00 per million tokens
- Output tokens: $5.00 per million tokens
- Source: Anthropic API pricing

### Usage Assumptions
- 5 AI commands per user per session (average)
- 3 sessions per user per month
- 15 AI commands per user per month
- ~1,200 input tokens per command (system prompt + tool definitions + user message + board context)
- ~200 output tokens per command (tool call response)

### Per-Command Cost Breakdown
```
Input:  1,200 tokens x ($1.00 / 1,000,000) = $0.0012
Output:   200 tokens x ($5.00 / 1,000,000) = $0.0010
Total per command: ~$0.002
```

### Per-User Monthly Cost
```
15 commands x $0.002 = $0.03 per user per month
```

---

## Scaling Projections

| Scale | Monthly AI Commands | AI API Cost | Infrastructure (Fly.io) | Total Monthly Cost |
|---|---|---|---|---|
| 100 users | 1,500 | $3 | $0 (free tier) | $3 |
| 1,000 users | 15,000 | $30 | $5 | $35 |
| 10,000 users | 150,000 | $300 | $25 | $325 |
| 100,000 users | 1,500,000 | $3,000 | $150 | $3,150 |

---

## Infrastructure Cost Notes

### Fly.io Free Tier (Current)
- 3 shared-cpu-1x VMs with 256MB RAM each
- Sufficient for MVP and demo traffic
- Auto-stop/start keeps costs at $0 during idle periods

### At 1,000 Users
- Single shared VM is likely sufficient
- Add a health check and auto-restart policy
- Consider adding a volume for basic state persistence

### At 10,000 Users
- Need horizontal scaling: multiple server instances behind Fly.io load balancer
- Add Redis (Fly.io Redis or Upstash) for pub/sub across instances
- WebSocket connections distributed across machines; Redis handles cross-instance broadcast
- Estimated infra: $20-30/month (2-3 VMs + Redis)

### At 100,000 Users
- Dedicated VMs (performance-2x or larger)
- Load balancing with sticky sessions for WebSocket affinity
- Postgres for persistent board state (Fly.io Postgres or external)
- Redis cluster for pub/sub and session state
- Consider CDN for static assets
- Estimated infra: $100-200/month (dedicated VMs + Postgres + Redis + bandwidth)

---

## Optimization Strategies

### 1. Prompt Caching (Anthropic API)
- System prompt and tool definitions are identical across all requests
- Anthropic's prompt caching reduces cost of cached input tokens by ~90%
- Estimated impact: system prompt (~800 tokens) cached, saving ~$0.0007 per command
- At 100K users: saves ~$1,050/month on input token costs

### 2. Rate Limiting
- 10 AI commands per minute per user
- Prevents abuse and runaway costs from automated or scripted usage
- Soft limit with a user-facing message; hard limit at 20/minute

### 3. Tiered Context Injection
- Current: send full board state with every AI command
- Optimized: send only objects within the user's current viewport
- Reduces input tokens from ~1,200 to ~400-600 for boards with many objects
- Estimated 30-50% reduction in input token costs at scale

### 4. Model Tiering
- Simple commands (create a rectangle, change color to blue, delete selected): use a smaller/cheaper model or pattern matching
- Complex commands (arrange these into a flowchart, summarize the board, suggest improvements): use Claude Haiku 4.5
- Estimated 40-60% of commands could be handled without an LLM call
- Potential cost reduction: 40-60% of AI API spend

### 5. Response Caching
- Cache common AI responses (e.g., "create a blue sticky note" always produces the same tool call)
- LRU cache keyed on normalized command text
- Cache hit rate estimate: 15-25% for common operations

---

## Cost Summary

| Metric | Value |
|---|---|
| Development AI cost | ~$15-25 (one-time) |
| Per-command production cost | ~$0.002 |
| Per-user monthly cost | ~$0.03 |
| Break-even for free tier infra | ~100 users |
| Monthly cost at 1K users | ~$35 |
| Monthly cost at 10K users | ~$325 |
| Monthly cost at 100K users | ~$3,150 |
| Primary optimization lever | Prompt caching (90% reduction on cached tokens) |
| Secondary optimization lever | Model tiering (40-60% of commands skip LLM) |
