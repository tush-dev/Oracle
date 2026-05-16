// ============================================================
// Structure-Aware Chunker
// Splits on meaning boundaries — not character counts
// ============================================================

const MAX_CHUNK_SIZE = 600
const MIN_CHUNK_SIZE = 40
const OVERLAP_SIZE   = 80

// ─────────────────────────────────────────────────────────────
// LINE TYPE DETECTION
// ─────────────────────────────────────────────────────────────

function isBlankLine(line: string): boolean {
  return line.trim().length === 0
}

function isTableRow(line: string): boolean {
  const hasMultipleSpaces = /\s{2,}/.test(line)
  const hasTablePattern   = /[A-Z]{2,}\s{2,}/.test(line)
  const hasNumericColumns = /\d\s{2,}[A-Z]\s{2,}\d/.test(line)
  return hasMultipleSpaces && (hasTablePattern || hasNumericColumns)
}

function isHeader(line: string): boolean {
  const trimmed    = line.trim()
  const isAllCaps  = trimmed === trimmed.toUpperCase() && trimmed.length > 5
  const isShortClean = trimmed.length < 80 && !/[,;]$/.test(trimmed)
  return isAllCaps && isShortClean
}

// ─────────────────────────────────────────────────────────────
// SPLIT LARGE SECTION
// ─────────────────────────────────────────────────────────────

function splitLargeSection(text: string): string[] {
  if (text.length <= MAX_CHUNK_SIZE) return [text]

  const results:   string[] = []
  const sentences            = text.split(/(?<=[.!?])\s+/)
  let   current              = ''

  for (const sentence of sentences) {
    if ((current + ' ' + sentence).trim().length <= MAX_CHUNK_SIZE) {
      current = (current + ' ' + sentence).trim()
    } else {
      if (current.length >= MIN_CHUNK_SIZE) results.push(current)
      const overlapText = current.slice(-OVERLAP_SIZE)
      current           = (overlapText + ' ' + sentence).trim()
    }
  }

  if (current.length >= MIN_CHUNK_SIZE) results.push(current)
  return results
}

// ─────────────────────────────────────────────────────────────
// MAIN CHUNKER
// ─────────────────────────────────────────────────────────────

const chunkText = (document: string): string[] => {
  const lines    = document.split('\n')
  const sections: string[] = []
  let   current  = ''
  let   inTable  = false

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // ── Blank line = section boundary ──────────────────────
    if (isBlankLine(line!)) {
      if (current.trim().length >= MIN_CHUNK_SIZE) {
        sections.push(current.trim())
        current = ''
        inTable = false
      }
      continue
    }

    // ── Table row ───────────────────────────────────────────
    if (isTableRow(line!)) {
      if (!inTable) {
        if (current.trim().length >= MIN_CHUNK_SIZE) {
          sections.push(current.trim())
          current = ''
        }
        inTable = true
      }
      current += (current ? '\n' : '') + line
      continue
    }

    // ── Leaving table ───────────────────────────────────────
    if (inTable && !isTableRow(line!)) {
      if (current.trim().length >= MIN_CHUNK_SIZE) {
        sections.push(current.trim())
        current = ''
      }
      inTable = false
    }

    // ── Header = fresh chunk ────────────────────────────────
    if (isHeader(line!)) {
      if (current.trim().length >= MIN_CHUNK_SIZE) {
        sections.push(current.trim())
      }
      current = line!
      continue
    }

    // ── Normal line ─────────────────────────────────────────
    current += (current ? ' ' : '') + line!.trim()

    // ── Too large — split at sentence boundary ──────────────
    if (current.length > MAX_CHUNK_SIZE) {
      const splits = splitLargeSection(current)
      splits.slice(0, -1).forEach(s => sections.push(s))
      current = splits[splits.length - 1] ?? ''
    }
  }

  // ── Last section ────────────────────────────────────────────
  if (current.trim().length >= MIN_CHUNK_SIZE) {
    sections.push(current.trim())
  }

  // ── Final clean ─────────────────────────────────────────────
  const chunks = sections
    .map(s => s.replace(/\s+/g, ' ').trim())
    .filter(s => s.length >= MIN_CHUNK_SIZE)

  console.log(`📦 Structure-aware chunker: ${chunks.length} chunks`)
  chunks.forEach((c, i) =>
    console.log(`  [${i + 1}] (${c.length} chars) "${c.slice(0, 70)}..."`)
  )

  return chunks
}

export { chunkText }