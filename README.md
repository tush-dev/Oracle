# Oracle

Oracle is a full-stack RAG assistant for asking grounded questions over uploaded documents and GitHub repositories.

The backend handles ingestion, chunking, embeddings, hybrid retrieval, reranking, answer generation, and evaluation. The frontend provides the chat and repository indexing experience.

## 🚀 Deployment

Ready to deploy? See [DEPLOYMENT.md](./DEPLOYMENT.md) for complete guides on deploying to Vercel, Render, Railway, and more.

For backend-specific setup, see `backend/.env.example` and `backend/README.md`.

## RAG Pipeline

1. Documents and repository files are parsed into clean text.
2. Structure-aware chunkers split content by headings, tables, functions, classes, and file boundaries.
3. Voyage embeddings are stored in Pinecone with source metadata.
4. Retrieval combines vector search with BM25 keyword matching through reciprocal rank fusion.
5. Cohere reranking improves the final context order before generation.
6. Groq generates answers with strict grounding instructions.
7. A RAG evaluator scores faithfulness, answer relevance, and context precision.

## Tech Stack

- Frontend: React, Vite, TypeScript
- Backend: Express, TypeScript
- Vector store: Pinecone
- Embeddings: Voyage AI
- Reranking: Cohere
- Generation and evaluation: Groq
- Auth and storage helpers: Clerk, Supabase

## Architecture

Oracle is built as a clean two-tier architecture with a focused backend for retrieval and a polished frontend for chat.

### Backend

- `backend/src/rag`
  - Ingestion, text chunking, embedding creation, retrieval, reranking, and evaluation.
  - Contains vector search, BM25 hybrid ranking, and grounding logic.
- `backend/src/routes`
  - REST API endpoints for documents, GitHub indexing, chat history, PDF uploads, and transcription.
- `backend/src/services`
  - Integration helpers for Clerk auth, Supabase storage, OCR, GitHub OAuth, and repo tree traversal.
- `backend/src/lib`
  - Shared abstractions for external APIs and provider wrappers.

### Frontend

- `frontend/src/pages`
  - Main view components: chat experience, GitHub OAuth callback handling, and page-level routing.
- `frontend/src/components`
  - Reusable UI primitives: header, sidebar, message list, input bar, background visuals, and GitHub helpers.
- `frontend/src/hooks`
  - Client-side helpers such as audio recording and transcription state.
- `frontend/src/lib`
  - API client and source label utilities.

### Data flow

1. A user uploads a PDF or indexes a GitHub repo.
2. The backend parses content, chunks it, generates embeddings, and stores vectors with source metadata.
3. User queries trigger hybrid retrieval: vector search plus BM25 scoring.
4. The candidate context is reranked and passed to Groq for grounded answer generation.
5. Responses are surfaced in the frontend chat UI with rich source selection and history.

## Project Layout

```text
backend/src/rag        RAG ingestion, retrieval, reranking, evaluation
backend/src/routes     API routes for documents, GitHub, history, audio
backend/src/services   OAuth, OCR, user, history, repo tree helpers
backend/src/lib        external API wrappers and shared helpers
frontend/src/pages     page-level React views
frontend/src/components reusable UI components
frontend/src/hooks     client-side behavior hooks
frontend/src/lib       frontend API and source utilities
```

## Local Development

```bash
cd backend
cp .env.example .env
npm install
npm run build
npm run dev
```

```bash
cd frontend
npm install
npm run dev
```

Copy `backend/.env.example` to `backend/.env` and fill in the provider keys before running the backend.

See `CONTRIBUTING.md` for guidance on commit style and incremental documentation updates.
