import { embedChunks } from './embedder.js'
import { chunkCodeContent, extractExt } from './codeChunker.js'
import { getUserGithubToken } from '../services/githubOAuthService.js'

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────

export interface RepoFile {
  path: string
  type: 'blob' | 'tree'
  size?: number
  sha?: string   // needed for Git Blob API
}

export interface IndexResult {
  repoName:     string
  fileCount:    number
  chunkCount:   number
  skippedCount: number
  tree:         RepoFile[]
}

// ─────────────────────────────────────────────────────────────
// FILTER RULES
// ─────────────────────────────────────────────────────────────

/**
 * Path segments to skip at the TREE level — before any file is fetched.
 * Filtering here saves API calls, not just processing time.
 */
const SKIP_DIR_SEGMENTS = new Set([
  'node_modules', 'dist', 'build', '.next', '.git',
  'coverage', '.cache', 'out', '__pycache__', '.pytest_cache',
  '.turbo', '.vercel', '.output', 'vendor', 'target',
  'bin', 'obj', '.gradle', '.idea', '.vscode',
  '.yarn', '.pnp',
])

// NOTE: compound extensions like '.min.js' and '.min.css' are checked
// via compoundExt in shouldSkipPath — lastIndexOf('.') alone won't catch them.
const SKIP_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.webp', '.bmp', '.tiff',
  '.exe', '.dll', '.so', '.dylib', '.bin', '.wasm',
  '.zip', '.tar', '.gz', '.rar', '.7z',
  '.mp4', '.mp3', '.wav', '.avi', '.mov', '.pdf',
  '.csv', '.parquet', '.sqlite', '.db',
  '.min.js', '.min.css',  // matched via compoundExt
  '.map',
  '.ttf', '.woff', '.woff2', '.eot',
  '.lock',   // covers yarn.lock, poetry.lock, etc. by extension
])

const SKIP_FILENAMES = new Set([
  'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml',
  'composer.lock', 'Gemfile.lock', 'poetry.lock',
  '.DS_Store', 'Thumbs.db', '.gitkeep',
])

const KEEP_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.rs',
  '.java', '.cpp', '.c', '.cs', '.rb', '.php', '.swift',
  '.kt', '.scala', '.vue', '.svelte',
  '.json', '.yaml', '.yml', '.toml',
  '.md', '.mdx', '.txt', '.rst',
  '.html', '.css', '.scss', '.sass',
  // compound: matched via compoundExt
  '.env.example',
])

const MAX_FILE_SIZE = 500_000  // 500 KB

/**
 * Returns true if the file should be skipped.
 * Called on the raw tree BEFORE fetching any content.
 *
 * Key optimisation: checks every path segment, so a file like
 * `foo/node_modules/lodash/index.js` is rejected on the segment
 * `node_modules` without ever touching the GitHub Contents API.
 *
 * FIX 1: ext is derived from filename only (not full path), so dots
 *         in directory names (e.g. `my.package/src/index.ts`) don't
 *         corrupt the extension.
 *
 * FIX 2: dotIdx > 0 guards against hidden files like `.eslintrc`
 *         where the leading dot is not an extension separator.
 *
 * FIX 3: compoundExt is checked separately so entries like `.min.js`
 *         and `.env.example` actually match — lastIndexOf('.') alone
 *         would reduce `file.min.js` to `.js` and miss them.
 */
function shouldSkipPath(filePath: string, size = 0): boolean {
  const parts    = filePath.split('/')
  const fileName = parts[parts.length - 1] ?? ''

  // FIX 1 + 2: ext from filename only; dotIdx > 0 skips hidden-file dots
  const dotIdx      = fileName.lastIndexOf('.')
  const ext         = dotIdx > 0 ? fileName.slice(dotIdx).toLowerCase() : ''

  // FIX 3: compound extension — 'file.min.js' → '.min.js'
  const nameParts   = fileName.split('.')
  const compoundExt = nameParts.length > 2
    ? ('.' + nameParts.slice(1).join('.')).toLowerCase()
    : ''

  // Reject by size first — cheapest check
  if (size > MAX_FILE_SIZE) return true

  // Walk every segment except the filename itself
  for (const seg of parts.slice(0, -1)) {
    if (SKIP_DIR_SEGMENTS.has(seg))                    return true
    if (seg.startsWith('.') && seg !== '.github')      return true
  }

  if (SKIP_FILENAMES.has(fileName))                                        return true
  if (SKIP_EXTENSIONS.has(ext) || SKIP_EXTENSIONS.has(compoundExt))       return true
  if (!KEEP_EXTENSIONS.has(ext) && !KEEP_EXTENSIONS.has(compoundExt))     return true

  return false
}

// ─────────────────────────────────────────────────────────────
// GITHUB AUTH HEADERS
// Priority: per-user OAuth token → server env token → none
// Per-user token gives 5 000 req/hr; no token gives only 60/hr.
// ─────────────────────────────────────────────────────────────

async function buildHeaders(userId: string): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    'Accept':     'application/vnd.github.v3+json',
    'User-Agent': 'AdvancedRAG/1.0',
  }

  // 1. Try the OAuth token the user connected via /github/start
  try {
    const userToken = await getUserGithubToken(userId)

    console.log("userToken", userToken)
    if (userToken) {
      headers['Authorization'] = `Bearer ${userToken}`
      return headers
    }
  } catch {
    // getUserGithubToken threw — fall through to env token
  }

  // 2. Fall back to server-level token (still 5 000/hr but shared across all users)
  if (process.env.GITHUB_TOKEN) {
    headers['Authorization'] = `Bearer ${process.env.GITHUB_TOKEN}`
  }

  // 3. No token — 60 req/hr, warn loudly
  if (!headers['Authorization']) {
    console.warn(
      '⚠️  No GitHub token available for this request. ' +
      'Rate limit is 60 req/hr. Ask the user to connect their GitHub account.'
    )
  }

  return headers
}

// ─────────────────────────────────────────────────────────────
// PARSE & VALIDATE GITHUB URL
// ─────────────────────────────────────────────────────────────

export function parseGithubUrl(url: string): { owner: string; repo: string } | null {
  try {
    const cleaned = url.trim().replace(/\/$/, '').replace(/\.git$/, '')
    const match   = cleaned.match(
      /^https?:\/\/github\.com\/([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)/
    )
    if (!match) return null
    return { owner: match[1]!, repo: match[2]! }
  } catch {
    return null
  }
}

// ─────────────────────────────────────────────────────────────
// FETCH REPO TREE
// One API call returns every file path + sha in the repo.
// We filter BEFORE fetching any content → zero wasted calls.
// ─────────────────────────────────────────────────────────────

async function fetchRepoTree(
  owner:   string,
  repo:    string,
  headers: Record<string, string>
): Promise<RepoFile[]> {

  const url = `https://api.github.com/repos/${owner}/${repo}/git/trees/HEAD?recursive=1`
  const res = await fetch(url, { headers })

  if (res.status === 404) throw new Error('Repository not found or is private')
  if (res.status === 403) throw new Error('GitHub API rate limit exceeded. Try again in an hour.')
  if (!res.ok)            throw new Error(`GitHub API error: ${res.status}`)

  const data = await res.json() as {
    tree:      { path: string; type: string; size?: number; sha: string }[]
    truncated: boolean
  }

  if (data.truncated) {
    console.warn('⚠️  Repo tree was truncated by GitHub (>100 000 files)')
  }

  return data.tree
    .filter(item => item.type === 'blob')
    .map(item => ({
      path: item.path,
      type: 'blob' as const,
      size: item.size ?? 0,
      sha:  item.sha,
    }))
}

// ─────────────────────────────────────────────────────────────
// FETCH FILE CONTENT — Git Blob API
//
// WHY GIT BLOB API instead of /contents/:path?
//
// /contents/:path  → 1 request per file, returns base64 in JSON,
//                    counts against REST rate limit for EVERY file.
//
// /git/blobs/:sha  → 1 request per file (same count), BUT:
//   • Uses the sha we already got from the tree (no path lookup)
//   • Supports `application/vnd.github.raw` → returns raw bytes,
//     skipping base64 decode overhead on both sides
//   • Works correctly for any file size up to 100 MB
//   • No redirect / double-request for larger files
//
// Net result: same request budget, less processing, more reliable.
// ─────────────────────────────────────────────────────────────

async function fetchBlob(
  owner:   string,
  repo:    string,
  sha:     string,
  headers: Record<string, string>
): Promise<string | null> {

  const url = `https://api.github.com/repos/${owner}/${repo}/git/blobs/${sha}`

  // Ask for raw bytes — avoids base64 encode/decode round-trip
  const res = await fetch(url, {
    headers: {
      ...headers,
      'Accept': 'application/vnd.github.raw',
    },
  })

  if (!res.ok) {
    console.warn(`  ⚠️  Blob ${sha} fetch failed: ${res.status}`)
    return null
  }

  const text = await res.text()

  // Skip binary-looking content
  if (text.includes('\x00')) return null

  return text
}

// ─────────────────────────────────────────────────────────────
// BATCH FETCH — parallel with concurrency cap
//
// Concurrency of 8 keeps us well inside GitHub's burst allowance
// while still being ~8× faster than serial fetching.
// ─────────────────────────────────────────────────────────────

async function fetchFilesInBatches(
  owner:       string,
  repo:        string,
  files:       RepoFile[],
  headers:     Record<string, string>,
  concurrency  = 8
): Promise<{ file: RepoFile; content: string }[]> {

  const results: { file: RepoFile; content: string }[] = []
  const total   = Math.ceil(files.length / concurrency)

  for (let i = 0; i < files.length; i += concurrency) {
    const batch   = files.slice(i, i + concurrency)
    const fetched = await Promise.all(
      batch.map(async (file) => {
        if (!file.sha) return null
        const content = await fetchBlob(owner, repo, file.sha, headers)
        return content ? { file, content } : null
      })
    )

    fetched.forEach(r => { if (r) results.push(r) })
    console.log(`  📥 Fetched batch ${Math.floor(i / concurrency) + 1}/${total}`)

    // Small breathing room between batches
    if (i + concurrency < files.length) {
      await new Promise(r => setTimeout(r, 200))
    }
  }

  return results
}

// ─────────────────────────────────────────────────────────────
// STORE REPO CHUNKS IN PINECONE
// ─────────────────────────────────────────────────────────────

async function storeRepoInPinecone(
  embeddedChunks: { text: string; vector: number[]; filePath: string }[],
  userId:         string,
  ts:             number,
  source:         string,
  repoName:       string,
) {
  const { Pinecone } = await import('@pinecone-database/pinecone')
  const pinecone     = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! })
  const index        = pinecone.index('rag-index')

  const BATCH = 100

  for (let i = 0; i < embeddedChunks.length; i += BATCH) {
    const batch   = embeddedChunks.slice(i, i + BATCH)
    const vectors = batch.map((chunk, j) => ({
      id:     `${userId}-${ts}-${i + j}`,
      values: chunk.vector,
      metadata: {
        text:        chunk.text,
        userId,
        source,
        filePath:    chunk.filePath,
        repoName,
        uploadedAt:  ts,
        chunkIndex:  i + j,
        totalChunks: embeddedChunks.length,
      },
    }))

    await index.upsert({ records: vectors })
    console.log(`  📌 Stored batch ${Math.floor(i / BATCH) + 1}/${Math.ceil(embeddedChunks.length / BATCH)}`)
  }
}

// ─────────────────────────────────────────────────────────────
// MAIN — INDEX A REPO
// ─────────────────────────────────────────────────────────────

export async function indexGithubRepo(
  repoUrl: string,
  userId:  string
): Promise<IndexResult> {

  const parsed = parseGithubUrl(repoUrl)
  if (!parsed) throw new Error('Invalid GitHub URL')

  const { owner, repo } = parsed
  const repoName        = `${owner}/${repo}`

  console.log(`\n🐙 Indexing GitHub repo: ${repoName}`)

  // Build auth headers once — reused for every request in this job
  const headers  = await buildHeaders(userId)
  const isAuthed = Boolean(headers['Authorization'])
  console.log(`  🔑 Auth: ${isAuthed ? 'token present (5 000 req/hr)' : 'no token (60 req/hr)'}`)

  // 1. Fetch full tree (1 API call regardless of repo size)
  console.log('  📁 Fetching repo tree...')
  const allFiles = await fetchRepoTree(owner, repo, headers)
  console.log(`  📁 Total blobs in repo: ${allFiles.length}`)

  // 2. Filter before fetching any content
  //    node_modules and other skip dirs are eliminated HERE — not after fetching
  const validFiles   = allFiles.filter(f => !shouldSkipPath(f.path, f.size))
  const skippedCount = allFiles.length - validFiles.length

  console.log(`  ✅ Files to fetch: ${validFiles.length}  (skipped ${skippedCount} — incl. node_modules, binaries, lock files)`)

  if (validFiles.length === 0) {
    throw new Error('No indexable files found in this repository')
  }

  // 3. Fetch content via Git Blob API (parallel batches)
  console.log('  📥 Fetching file contents via Git Blob API...')
  const fileContents = await fetchFilesInBatches(owner, repo, validFiles, headers)

  // 4. Chunk all files
  // FIX 4: use extractExt (filename only, compound-aware) instead of
  //         lastIndexOf on the full path — dots in directory names like
  //         `my.package/src/index.ts` would otherwise corrupt the ext.
  console.log('  ✂️  Chunking files...')
  const allChunks: { text: string; filePath: string }[] = []

  for (const { file, content } of fileContents) {
    const { ext, compoundExt } = extractExt(file.path)
    // prefer the compound ext for chunker type detection when it's meaningful
    const effectiveExt = compoundExt || ext
    const chunks       = chunkCodeContent(content, file.path, effectiveExt)
    chunks.forEach(text => allChunks.push({ text, filePath: file.path }))
  }

  console.log(`  ✂️  Total chunks: ${allChunks.length}`)

  if (allChunks.length === 0) {
    throw new Error('No content could be extracted from this repository')
  }

  // 5. Embed + store
  console.log('  🔢 Embedding chunks...')
  const ts       = Date.now()
  const source   = `github:${repoName}`
  const texts    = allChunks.map(c => c.text)
  const embedded = await embedChunks(texts)

  const embeddedWithMeta = embedded.map((e, i) => ({
    ...e,
    filePath: allChunks[i]?.filePath ?? '',
  }))

  await storeRepoInPinecone(embeddedWithMeta, userId, ts, source, repoName)

  console.log(`  ✅ Done. ${allChunks.length} chunks from ${fileContents.length} files`)

  return {
    repoName,
    fileCount:    fileContents.length,
    chunkCount:   allChunks.length,
    skippedCount,
    tree:         validFiles,
  }
}