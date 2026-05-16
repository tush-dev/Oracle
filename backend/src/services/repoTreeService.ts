import { supabase } from '../lib/supabase.js'
import type { RepoFile } from '../rag/githubIndexer.js'

export interface RepoTree {
  id:         string
  userId:     string
  repoUrl:    string
  repoName:   string
  tree:       RepoFile[]
  fileCount:  number
  indexedAt:  number
}

// ─────────────────────────────────────────────────────────────
// SAVE OR UPDATE tree in Supabase
// ─────────────────────────────────────────────────────────────

export async function saveRepoTree(
  userId:    string,
  repoUrl:   string,
  repoName:  string,
  tree:      RepoFile[],
  fileCount: number,
): Promise<void> {
  const { error } = await supabase
    .from('repo_trees')
    .upsert(
      {
        user_id:    userId,
        repo_url:   repoUrl,
        repo_name:  repoName,
        tree:       tree,
        file_count: fileCount,
        indexed_at: Date.now(),
      },
      { onConflict: 'user_id,repo_url' }
    )

  if (error) throw new Error(`Failed to save repo tree: ${error.message}`)
}

// ─────────────────────────────────────────────────────────────
// GET all repo trees for a user
// ─────────────────────────────────────────────────────────────

export async function getRepoTrees(userId: string): Promise<RepoTree[]> {
  const { data, error } = await supabase
    .from('repo_trees')
    .select('*')
    .eq('user_id', userId)
    .order('indexed_at', { ascending: false })

  if (error) throw new Error(`Failed to fetch repo trees: ${error.message}`)

  return (data ?? []).map(row => ({
    id:        row.id,
    userId:    row.user_id,
    repoUrl:   row.repo_url,
    repoName:  row.repo_name,
    tree:      row.tree,
    fileCount: row.file_count,
    indexedAt: row.indexed_at,
  }))
}

// ─────────────────────────────────────────────────────────────
// DELETE a repo tree
// ─────────────────────────────────────────────────────────────

export async function deleteRepoTree(
  userId:  string,
  repoUrl: string,
): Promise<void> {
  const { error } = await supabase
    .from('repo_trees')
    .delete()
    .eq('user_id', userId)
    .eq('repo_url', repoUrl)

  if (error) throw new Error(`Failed to delete repo tree: ${error.message}`)
}