# Oracle Backend

This directory contains the backend server for the Oracle RAG assistant.

## Overview

The backend handles:

- GitHub OAuth integration
- PDF and document ingestion
- Chunking and embedding generation
- Hybrid retrieval and reranking
- Response generation
- Supabase storage and history management

## Local development

1. Copy the example environment file:

```bash
cd backend
cp .env.example .env
```

2. Install dependencies:

```bash
npm install
```

3. Build the TypeScript backend:

```bash
npm run build
```

4. Start the development server:

```bash
npm run dev
```

5. Open the frontend separately for the chat interface.

## Available scripts

- `npm run dev` - build and restart the backend while developing
- `npm run build` - compile TypeScript to `dist/`
- `npm start` - run the compiled production server

## Environment variables

Use `backend/.env.example` to configure:

- Clerk auth keys
- Supabase project keys
- GitHub OAuth client credentials
- Pinecone API settings
- Cohere / Groq keys
- Frontend base URL
