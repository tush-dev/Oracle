import { motion, AnimatePresence } from "framer-motion"
import { FileText, Mic, Search } from "lucide-react"
import hljs from "highlight.js/lib/core"
import bash from "highlight.js/lib/languages/bash"
import cpp from "highlight.js/lib/languages/cpp"
import csharp from "highlight.js/lib/languages/csharp"
import css from "highlight.js/lib/languages/css"
import go from "highlight.js/lib/languages/go"
import java from "highlight.js/lib/languages/java"
import javascript from "highlight.js/lib/languages/javascript"
import json from "highlight.js/lib/languages/json"
import markdown from "highlight.js/lib/languages/markdown"
import php from "highlight.js/lib/languages/php"
import python from "highlight.js/lib/languages/python"
import ruby from "highlight.js/lib/languages/ruby"
import rust from "highlight.js/lib/languages/rust"
import sql from "highlight.js/lib/languages/sql"
import typescript from "highlight.js/lib/languages/typescript"
import xml from "highlight.js/lib/languages/xml"
import yaml from "highlight.js/lib/languages/yaml"
import { GithubIcon } from "./icons/GithubIcon"

interface HistoryItem {
  q: string
  a: string
}

interface Props {
  history: HistoryItem[]
  isStreaming: boolean
  response: string
  currentQ: string
  scrollRef: React.RefObject<HTMLDivElement | null>
}

const CAPABILITIES: {
  icon: typeof FileText | typeof Mic | typeof GithubIcon
  title: string
  description: string
  github?: boolean
}[] = [
  {
    icon: FileText,
    title: "PDF documents",
    description: "Attach a PDF with the paperclip, then ask questions about its content.",
  },
  {
    icon: Mic,
    title: "Voice input",
    description: "Tap the mic, speak your question, and we transcribe it into the chat box.",
  },
  {
    icon: GithubIcon,
    title: "GitHub repos",
    description: "Connect GitHub, index a public repository, and ask about the codebase.",
    github: true,
  },
]

hljs.registerLanguage("bash", bash)
hljs.registerLanguage("cpp", cpp)
hljs.registerLanguage("csharp", csharp)
hljs.registerLanguage("css", css)
hljs.registerLanguage("go", go)
hljs.registerLanguage("java", java)
hljs.registerLanguage("javascript", javascript)
hljs.registerLanguage("json", json)
hljs.registerLanguage("markdown", markdown)
hljs.registerLanguage("php", php)
hljs.registerLanguage("python", python)
hljs.registerLanguage("ruby", ruby)
hljs.registerLanguage("rust", rust)
hljs.registerLanguage("sql", sql)
hljs.registerLanguage("typescript", typescript)
hljs.registerLanguage("xml", xml)
hljs.registerLanguage("yaml", yaml)

type AnswerPart =
  | { type: "text"; value: string }
  | { type: "code"; value: string; language?: string }

const fencePattern = /```([^\n`]*)\n?([\s\S]*?)```/g

function parseAnswer(answer: string): AnswerPart[] {
  const parts: AnswerPart[] = []
  let cursor = 0

  for (const match of answer.matchAll(fencePattern)) {
    const index = match.index ?? 0
    if (index > cursor) {
      parts.push({ type: "text", value: answer.slice(cursor, index) })
    }
    parts.push({
      type: "code",
      language: match[1]?.trim().split(/\s+/)[0],
      value: match[2]?.replace(/\n$/, "") ?? "",
    })
    cursor = index + match[0].length
  }

  if (cursor < answer.length) {
    parts.push({ type: "text", value: answer.slice(cursor) })
  }

  return parts.length ? parts : [{ type: "text", value: answer }]
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}

function highlightCode(code: string, language?: string) {
  const lang = language?.toLowerCase()

  try {
    if (lang && hljs.getLanguage(lang)) {
      const result = hljs.highlight(code, {
        language: lang,
        ignoreIllegals: true,
      })
      return { html: result.value, language: result.language ?? lang }
    }

    const result = hljs.highlightAuto(code)
    return {
      html: result.value,
      language: result.language ?? language ?? "code",
    }
  } catch {
    return { html: escapeHtml(code), language: language ?? "code" }
  }
}

function CodeBlock({ code, language }: { code: string; language?: string }) {
  const highlighted = highlightCode(code, language)

  return (
    <div className="oracle-code my-3 overflow-hidden rounded-xl border border-border bg-[#0b1020] shadow-sm">
      <div className="flex items-center justify-between border-b border-white/10 bg-white/[0.04] px-3 py-2">
        <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-300">
          {highlighted.language}
        </span>
        <span className="h-2 w-2 rounded-full bg-accent/80 shadow-[0_0_10px_color-mix(in_srgb,var(--accent)_55%,transparent)]" />
      </div>
      <pre className="m-0 max-w-full overflow-x-auto p-3.5 text-left text-[12px] leading-relaxed sm:text-[13px]">
        <code
          className={`hljs language-${highlighted.language}`}
          dangerouslySetInnerHTML={{ __html: highlighted.html }}
        />
      </pre>
    </div>
  )
}

function AnswerContent({ text, streaming }: { text: string; streaming?: boolean }) {
  const parts = parseAnswer(text)
  const lastPart = parts[parts.length - 1]

  return (
    <div className="oracle-answer text-sm leading-relaxed text-foreground/90">
      {parts.map((part, index) =>
        part.type === "code" ? (
          <CodeBlock key={index} code={part.value} language={part.language} />
        ) : part.value ? (
          <p key={index} className="m-0 whitespace-pre-wrap">
            {part.value}
            {streaming && index === parts.length - 1 && (
              <motion.span
                className="ml-0.5 inline-block h-3.5 w-0.5 translate-y-0.5 rounded-sm bg-accent"
                animate={{ opacity: [1, 0] }}
                transition={{ duration: 0.5, repeat: Infinity }}
              />
            )}
          </p>
        ) : null
      )}
      {streaming && lastPart?.type === "code" && (
        <motion.span
          className="ml-0.5 inline-block h-3.5 w-0.5 translate-y-0.5 rounded-sm bg-accent"
          animate={{ opacity: [1, 0] }}
          transition={{ duration: 0.5, repeat: Infinity }}
        />
      )}
    </div>
  )
}

export const MessageList = ({
  history,
  isStreaming,
  response,
  currentQ,
  scrollRef,
}: Props) => {
  const isEmpty = history.length === 0 && !isStreaming && !response

  return (
    <div
      ref={scrollRef}
      className="scrollbar-thin flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto overflow-x-hidden px-1 py-3 sm:gap-8 sm:px-2"
    >
      <AnimatePresence>
        {isEmpty && (
          <motion.div
            className="flex flex-1 flex-col items-center justify-center gap-5 px-3 py-8 text-center sm:gap-6 sm:px-5 sm:py-14"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.6 }}
          >
            <div className="relative flex h-16 w-16 items-center justify-center rounded-3xl border border-border bg-card/80 shadow-[var(--shadow-float)] sm:h-20 sm:w-20">
              <motion.div
                className="absolute inset-2 rounded-2xl border border-transparent border-t-accent/40 border-r-[color:var(--brand-secondary)]/40"
                animate={{ rotate: 360 }}
                transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
              />
              <motion.div
                className="absolute inset-4 rounded-xl border border-transparent border-b-[color:var(--brand-tertiary)]/35 border-l-accent/20"
                animate={{ rotate: -360 }}
                transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
              />
              <Search className="h-6 w-6 text-accent sm:h-7 sm:w-7" strokeWidth={1.5} />
            </div>
            <div>
              <h2 className="text-xl font-semibold tracking-wide text-foreground sm:text-2xl">
                Begin your inquiry
              </h2>
              <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-muted-foreground">
                Upload a PDF, use voice, or index a GitHub repo — then ask Oracle anything
                about your sources.
              </p>
            </div>
            <div className="grid w-full max-w-2xl grid-cols-1 gap-3 sm:grid-cols-3">
              {CAPABILITIES.map((cap) => {
                const Icon = cap.icon
                return (
                  <div
                    key={cap.title}
                    className="group flex flex-col items-center gap-2 rounded-2xl border border-border bg-card/80 p-4 text-left shadow-sm transition-transform hover:-translate-y-0.5 hover:shadow-[var(--shadow-float)] sm:items-start"
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-muted text-accent transition-colors group-hover:border-accent/30 group-hover:bg-accent/10">
                      {cap.github ? (
                        <Icon className="h-4 w-4" />
                      ) : (
                        <Icon className="h-4 w-4" strokeWidth={1.75} />
                      )}
                    </div>
                    <div>
                      <h3 className="text-xs font-semibold text-foreground">{cap.title}</h3>
                      <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                        {cap.description}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {history.map((item, i) => (
        <motion.div
          key={i}
          className="flex flex-col gap-4"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="flex justify-end">
            <div className="max-w-[92%] rounded-2xl rounded-br-md border border-border bg-[var(--user-bubble)] px-3.5 py-3 shadow-sm sm:max-w-[75%] sm:px-4 sm:py-3.5">
              <span className="mb-1.5 block font-mono text-[9px] tracking-[0.2em] text-muted-foreground">
                YOU
              </span>
              <p className="m-0 text-sm leading-relaxed text-foreground">{item.q}</p>
            </div>
          </div>
          <div className="flex gap-3 sm:gap-3.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-accent/25 bg-card text-sm font-bold text-accent shadow-sm sm:h-9 sm:w-9">
              O
            </div>
            <div className="relative min-w-0 flex-1 overflow-hidden rounded-2xl rounded-tl-md border border-border bg-[var(--assistant-bubble)] px-3.5 py-3 shadow-sm sm:px-4 sm:py-3.5">
              <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-accent via-[color:var(--brand-secondary)] to-transparent" />
              <span className="mb-2 block font-mono text-[9px] tracking-[0.2em] text-accent/70">
                ORACLE
              </span>
              <AnswerContent text={item.a} />
            </div>
          </div>
        </motion.div>
      ))}

      <AnimatePresence>
        {isStreaming && (
          <motion.div
            className="flex flex-col gap-4"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            {currentQ && (
              <div className="flex justify-end">
                <div className="max-w-[92%] rounded-2xl rounded-br-md border border-border bg-[var(--user-bubble)] px-3.5 py-3 shadow-sm sm:max-w-[75%] sm:px-4 sm:py-3.5">
                  <span className="mb-1.5 block font-mono text-[9px] tracking-[0.2em] text-muted-foreground">
                    YOU
                  </span>
                  <p className="m-0 text-sm leading-relaxed text-foreground">{currentQ}</p>
                </div>
              </div>
            )}
            <div className="flex gap-3 sm:gap-3.5">
              <motion.div
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-accent/25 bg-card text-sm font-bold text-accent shadow-sm sm:h-9 sm:w-9"
                animate={{
                  boxShadow: [
                    "0 0 0px transparent",
                    "0 0 16px color-mix(in srgb, var(--accent) 45%, transparent)",
                    "0 0 0px transparent",
                  ],
                }}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                O
              </motion.div>
              <div className="relative min-w-0 flex-1 overflow-hidden rounded-2xl rounded-tl-md border border-border bg-[var(--assistant-bubble)] px-3.5 py-3 shadow-sm sm:px-4 sm:py-3.5">
                <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-accent via-[color:var(--brand-secondary)] to-transparent" />
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="font-mono text-[9px] tracking-[0.2em] text-accent/70">
                    ORACLE
                  </span>
                  <span className="flex items-center gap-1 rounded-full border border-accent/30 bg-accent/10 px-2 py-0.5">
                    <motion.span
                      className="h-1 w-1 rounded-full bg-accent"
                      animate={{ opacity: [1, 0.2, 1] }}
                      transition={{ duration: 0.9, repeat: Infinity }}
                    />
                    <span className="font-mono text-[8px] font-semibold tracking-widest text-accent/80">
                      GENERATING
                    </span>
                  </span>
                </div>
                {response === "" ? (
                  <div className="flex items-center gap-1.5 py-1">
                    {[0, 1, 2].map((j) => (
                      <motion.span
                        key={j}
                        className="inline-block h-1.5 w-1.5 rounded-full bg-accent"
                        animate={{ y: [0, -6, 0], opacity: [0.3, 1, 0.3] }}
                        transition={{
                          duration: 0.85,
                          repeat: Infinity,
                          delay: j * 0.16,
                          ease: "easeInOut",
                        }}
                      />
                    ))}
                  </div>
                ) : (
                  <AnswerContent text={response} streaming />
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
