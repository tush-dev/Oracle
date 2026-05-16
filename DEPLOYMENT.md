# Oracle Deployment Guide

Complete guide for deploying Oracle backend and frontend across multiple platforms.

## Environment Variables Reference

### Backend Environment Variables

```env
# Clerk Auth
CLERK_SECRET_KEY=your_clerk_secret_key

# Supabase (Database & Storage)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_KEY=your_supabase_service_key

# Pinecone (Vector Store)
PINECONE_API_KEY=your_pinecone_api_key
PINECONE_INDEX_NAME=your_index_name
PINECONE_NAMESPACE=__default__

# AI/LLM Providers
VOYAGE_API_KEY=your_voyage_api_key
COHERE_API_KEY=your_cohere_api_key
GROQ_API_KEY=your_groq_api_key

# GitHub OAuth (Optional, for repo indexing)
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret

# Assembly AI (For transcription)
ASSEMBLY_API_KEY=your_assembly_api_key

# Vercel/Deployment
NODE_ENV=production
PORT=3009
```

### Frontend Environment Variables

```env
VITE_API_URL=https://your-backend-deployed-url.com
VITE_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
```

---

## Backend Deployment

### Render (Recommended - $7/month)
1. Go to render.com and sign up
2. Click "New +" → "Web Service"
3. Connect your GitHub repository
4. Configure:
   - Name: `oracle-backend`
   - Build Command: `cd backend && npm install && npm run build`
   - Start Command: `cd backend && npm run dev`
5. Add all Backend Environment Variables
6. Deploy and get your URL: `https://oracle-backend-xxxx.onrender.com`

### Railway ($5/month)
1. Go to railway.app
2. Create project → GitHub
3. Select Oracle repository
4. Add Node.js service
5. Set Root Directory: `backend`
6. Add environment variables
7. Get URL: `https://oracle-backend-xxxx.railway.app`

### Vercel Edge (Free tier)
Deploy backend as serverless functions or use Railway/Render for persistent backend.

---

## Frontend Deployment

### Vercel (Recommended - Free)
1. Go to vercel.com and sign up with GitHub
2. Import Oracle repository
3. Configure:
   - Framework: Vite
   - Root Directory: `frontend`
   - Build Command: `npm run build`
   - Output Directory: `dist`
4. Add Environment Variables:
   - `VITE_API_URL=https://your-backend-url.com`
   - `VITE_CLERK_PUBLISHABLE_KEY=pk_test_...`
5. Deploy → Get URL: `https://oracle-xxxx.vercel.app`

### Netlify (Free)
1. Go to netlify.com
2. Connect GitHub → Select Oracle
3. Configure:
   - Base: `frontend`
   - Build: `npm run build`
   - Publish: `dist`
4. Add environment variables
5. Deploy → Get URL: `https://oracle-xxxx.netlify.app`

---

## Post-Deployment Setup

1. **Add your deployed backend URL to frontend env**:
   ```env
   VITE_API_URL=https://your-backend-url.com
   ```

2. **Test end-to-end**:
   - Sign in with Clerk
   - Upload a PDF
   - Index a GitHub repo
   - Ask questions

3. **Custom domains** (optional):
   - Point your domain DNS to your deployed service
   - Update Clerk redirect URIs if needed

---

## Troubleshooting

### Backend won't start
- Check all env variables are set
- Verify Pinecone index name and namespace
- Ensure Supabase credentials are correct

### Frontend can't connect to backend
- Verify `VITE_API_URL` in frontend env
- Check backend is running
- Ensure CORS is enabled

### Clerk authentication fails
- Verify `VITE_CLERK_PUBLISHABLE_KEY`
- Check Clerk dashboard for correct redirect URLs
