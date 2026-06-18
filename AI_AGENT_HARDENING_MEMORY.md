# AI Agent Hardening Memory

## Purpose
This file is the working source of truth for making the AI agent system reliable, low-error, and context-correct across the whole app.

Use this file before changing agent logic, chat flows, pending actions, memory, delegation, timezone handling, or AI provider behavior.

## Operating Rules
- Google AI Studio is the primary app builder and deploy path.
- Supabase is the source of truth for database schema, RLS, and Edge Functions.
- Local edits in temporary workspaces are for inspection, debugging, and validation only unless the user explicitly promotes them.
- When giving manual code instructions, prefer this format:
  - Find: `exact old code`
  - Replace with: `exact new code`
- Do not build from the Drive workspace. If runtime testing is needed, ask the user to update the Desktop copy first.

## Current AI Architecture

### Frontend runtime
- `src/contexts/AIContext.tsx`
  - Global AI state
  - Active agent selection
  - Chat message state
  - Local pending actions + DB pending actions
  - Provider routing
  - Voice/call mode behavior
  - New-chat reset behavior
- `src/components/AIAssistantFooter.tsx`
  - Footer chat surface
  - Pending action buttons
  - Specialist run buttons
- `src/pages/AIAssistant.tsx`
  - Full chat surface
  - Call mode UI
  - Full pending action and specialist task panels
- `src/lib/aiDatabaseContext.ts`
  - Builds the database context package from Supabase tables

### Backend runtime
- `server.ts`
  - `/api/assistant/chat`
  - `/api/assistant/action/resolve`
  - `/api/assistant/agent-task/process`
  - memory extraction
  - context package persistence
  - usage/cost logging
  - budget enforcement
- `server/tools.ts`
  - backend write actions
  - permission checks
  - calendar event creation
  - delegated agent task creation

### Supabase runtime
- Core tables:
  - `ai_agents`
  - `ai_conversations`
  - `ai_messages`
  - `ai_pending_actions`
  - `ai_agent_memories`
  - `ai_context_packages`
  - `agent_tasks`
  - `ai_usage_events`
  - `ai_agent_runs`
  - `ai_usage_limits`
- Calendar:
  - `calendar_accounts`
  - `calendar_events`
  - `google-calendar-*` Edge Functions

## What Is Already Good

### 1. Cloud chat path is the strongest path
Cloud providers already use a real hybrid context package:
- agent profile
- user profile summary
- relevant memories
- selective database context
- rolling conversation summary
- recent turns
- current user message

This is the right direction.

### 2. Timezone handling is mostly strong now
- browser sends `user_timezone`
- profile timezone is persisted
- backend resolves `activeTimeZone`
- read-only calendar queries use local date resolution
- pending calendar actions include `time_zone`
- delegated agent tasks include `input_json.user_timezone`

### 3. Pending actions are safer than direct writes
- explicit confirmation flow exists
- backend action resolution logs timeline messages
- create/update flows are more auditable than silent writes

### 4. Usage and cost tracking exists
- `ai_agent_runs`
- `ai_usage_events`
- `ai_usage_limits`
- model pricing lookup

This is an excellent foundation for SaaS controls.

### 5. Agent permissions exist on backend
`server/tools.ts` checks:
- explicit action permission
- mapped capability permission
- wildcard admin permission

That is materially better than prompt-only enforcement.

## Main Weak Points

### 1. Local Ollama path is not yet equal to cloud path
Risk level: high

The local path in `AIContext.tsx` still builds a lighter prompt from:
- current page
- recent local conversation
- database context
- local instructions

It does not yet fully use:
- stored rolling conversation summary from Supabase
- relevant long-term memory retrieval from `ai_agent_memories`
- backend-scoped action extraction and persistence parity

Result:
- local and cloud agents can drift in behavior
- local replies may lose continuity sooner
- local write-safety depends more heavily on prompt quality

### 2. Confirmation policy is configured in UI but not strongly enforced server-side
Risk level: high

The app stores per-agent `confirmation_policy`, but backend execution is primarily governed by:
- LLM prompt behavior
- whether a pending action was created
- backend permission checks

What is missing:
- a strict backend gate that says:
  - if `confirmation_policy[actionType] !== false`, this action must remain pending
  - if `confirmation_policy[actionType] === false`, autonomous execution is allowed only for approved paths

Without that, policy is partly decorative.

### 3. Specialist agent runs use weaker context than main chat
Risk level: medium-high

`/api/assistant/agent-task/process` builds a narrower context:
- recent conversation excerpt
- a small task-type-specific query
- small project/task/business samples

It does not fully reuse the same hybrid context rigor as `/api/assistant/chat`.

Result:
- delegated agents can answer or act with less context than the main assistant
- agent-to-agent workflows are more likely to drift or miss relevant records

### 4. Footer chat and full assistant page duplicate a lot of UI logic
Risk level: medium

Both surfaces separately handle:
- pending agent tasks
- pending actions
- conversation panels
- specialist run behavior

This raises drift risk:
- confirm button visible in one surface but not the other
- layout/scroll behavior mismatch
- “new chat” or task updates behaving differently

### 5. New chat is fixed functionally, but conversation lifecycle is still soft
Risk level: medium

Current behavior:
- local state is cleared
- conversation id is removed from localStorage
- force-new flag is set

Remaining weakness:
- old active conversations remain in DB as active
- fallback logic can still select the newest active conversation later if force-new handling regresses

Best future fix:
- explicitly archive or supersede the old active conversation when starting a fresh chat

### 6. Memory compression currently depends on Gemini helper calls
Risk level: medium

`compressMemoriesIfNecessary` uses `callGeminiSimple(...)` if API key exists.

This creates side effects:
- hidden extra cloud token usage
- memory maintenance behavior depends on one provider even if the user is chatting via another
- local-only mode is not truly local if compression is active

### 7. Budget enforcement uses server day/month boundaries, not explicit user-local billing windows
Risk level: medium

`checkBudget(...)` uses server-side date objects.

This is acceptable for global UTC budgeting, but if the product promise is “daily budget for Boss,” then user-local timezone windows should be explicit.

### 8. Pending actions are globally visible in chat surfaces
Risk level: medium

Frontend currently shows pending actions from shared state, not always filtered by:
- active conversation
- originating agent
- active page

Result:
- a footer chat or another agent may surface unrelated pending work
- user can lose confidence about which agent prepared what

### 9. Database context is broad and powerful, but still expensive
Risk level: medium

`buildAIDatabaseContext(...)` fetches many tables and assembles a large context blob.

Even with selective backend use, this can still become:
- token-heavy
- slower than needed
- noisier than needed for local models

### 10. Sensitive context controls need constant discipline
Risk level: medium

The app intentionally fetches highly sensitive data paths:
- contact email/phone/address
- platform login notes
- tax ids
- email account identities

Sanitization exists, but this area must remain tightly controlled because one regression can expose too much context to a model.

## Hardening Checklist

### A. Identity, Auth, Session
- [x] Auth token required for backend assistant routes
- [x] Conversation ownership checks exist
- [ ] Enforce session timeout policy consistently in UI and auth refresh flow
- [ ] Add audit trail for forced sign-out / session expiry events

### B. Timezone and Date Logic
- [x] Browser timezone passed into backend
- [x] Profile timezone persisted
- [x] Calendar reads use local date resolution
- [x] Calendar writes include `time_zone`
- [x] Delegated tasks carry `user_timezone`
- [ ] Force all relative-date reasoning through one shared helper path
- [ ] Add regression tests for today/tomorrow/next Friday across timezone boundaries

### C. Chat Continuity
- [x] New chat clears local state
- [x] Force-new conversation flag exists
- [x] Stale reply invalidation exists
- [ ] Archive previous active conversation when starting fresh
- [ ] Prevent resurfacing old active conversation after tab restore or hydration race

### D. Context Accuracy
- [x] Cloud path uses hybrid context package
- [x] Backend logs context packages
- [x] Local path should use stored rolling summary from DB
- [x] Local path should retrieve relevant memories from DB
- [ ] Specialist runs should use the same context discipline as main chat

### E. Memory System
- [x] Long-term memories persist to Supabase
- [x] Duplicate detection exists
- [x] Compression routine exists
- [ ] Compression should not silently depend on Gemini unless explicitly allowed
- [ ] Memory retrieval should be more semantic than keyword overlap
- [ ] Agent-specific vs shared memories should be more clearly separated

### F. Write Safety
- [x] Pending action confirmation flow exists
- [x] Backend tool permissions exist
- [x] Read-only calendar protection exists
- [x] Enforce `confirmation_policy` on the backend, not just via prompting
- [ ] Add server-side validation by action type for required payload fields
- [ ] Add idempotency/duplicate protection for more action types

### G. Delegation / Agent-to-Agent Work
- [x] Specialist task queue exists
- [x] Delegated runs can log timeline messages
- [ ] Delegation should copy enough parent context to avoid confusion
- [ ] Parent agent should always summarize who is working, what is queued, and current status
- [ ] Agent-to-agent chains should show visible lineage in full chat

### H. Cost and Usage Controls
- [x] Usage events are logged
- [x] Model pricing table exists
- [x] Budget gate exists
- [ ] Budget windows should be explicitly defined as UTC or user-local
- [ ] Hidden maintenance calls must be counted or disabled
- [ ] Add per-feature cost summaries, not just per-agent summaries

### I. UI/UX Reliability
- [x] Confirm/Skip buttons exist
- [x] Full page and footer share the same state source
- [ ] Footer and full page should use shared rendering subcomponents to prevent drift
- [ ] Pending actions should show source agent + source conversation
- [ ] Chat surfaces should clearly show execution progress after confirm

### J. Mobile / Call Mode
- [x] Call mode exists
- [x] Continuous listening loop exists
- [x] Duplicate transcript suppression exists
- [ ] Add stronger interruption and echo-loop guards on mobile
- [ ] Add visible listening/speaking/thinking states consistently across surfaces

## Priority Order For Future Fixes

### P0
1. Make specialist task processing use stronger hybrid context
2. Add server-side validation by action type for required payload fields
3. Add idempotency/duplicate protection for more write actions

### P1
4. Archive old conversations on New Chat
5. Filter pending actions by conversation/agent in UI
6. Replace duplicated footer/full-chat action rendering with shared components

### P2
7. Make memory compression provider-agnostic or explicitly configurable
8. Tighten budget windows and hidden-cost accounting
9. Add regression tests for timezone/date parsing

## Non-Negotiable Rules
- Never invent writes as already completed.
- Never create calendar actions for read-only schedule questions.
- Never trust unstructured model text alone for write safety.
- Never send the full database when only one domain is needed.
- Never let local and cloud paths drift without documenting the difference here.
- Never change agent logic without checking how it affects:
  - pending actions
  - delegated tasks
  - memory extraction
  - timezone handling
  - cost logging

## Current Audit Verdict

### Overall score
The agent system is strong enough to keep building on, but it is not yet bulletproof.

### Best parts
- Cloud context architecture
- pending-action model
- usage/cost logging foundation
- backend permission checks
- timezone handling improvements

### Most likely future failure modes
1. Local Ollama gives weaker continuity than cloud
2. Specialist agents act with thinner context
3. UI policy says one thing, backend execution allows another
4. Pending actions from one thread/agent leak into another chat surface
5. hidden helper calls consume tokens unexpectedly

## How To Use This File
- Before changing AI logic, read this file first.
- After every meaningful AI-agent change, update:
  - what was fixed
  - what risk was reduced
  - what still remains
- If a bug is found, add it here under the relevant checklist section before fixing it.
