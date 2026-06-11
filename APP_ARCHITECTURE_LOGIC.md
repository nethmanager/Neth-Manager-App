# App Architecture & Logic Documentation

## Overview
Command Center AI is a React-based application designed to integrate multiple AI models into a personalized workflow, supporting both durable database persistence (Supabase) and local AI service interactions (Ollama).

## Core Data & State Management
- **`AIContext.tsx`**: Manages the global AI state, including settings for temperature, token limits, and `model_name`. It constructs the system prompt dynamically based on the current agent and conversation context.
- **`Settings.tsx`**: Provides the UI for managing AI-provider-specific configurations, including Ollama local endpoints.

## AI Logic Flow
1. **Model Selection**: The user selects a provider (`ollama`, `gemini`, `openai`, `claude`) and a model name.
2. **Context Construction**: Using `AIContext`, the app gathers relevant memories and conversation history.
3. **Execution**:
    - **Local AI**: Proxied via `localAIService.ts` targeting the configured `ollama_endpoint`.
    - **Cloud AI**: Handled via secure server-side API routes to prevent API key exposure.
4. **Data Persistence**: Interaction results, memories, and task updates are stored in Supabase (Firestore/Relational).

## Database Interaction
- **Supabase**: Uses a relational structure for managing agents, automation runs, conversations, and tasks.
- **Schema**: Defined in `/supabase/schema.sql`.
