import AnoAI from "@/components/ui/animated-shader-background"
import { useTheme } from "@/context/theme"

export const Background = () => {
  const { theme } = useTheme()

  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden bg-background" aria-hidden>
      {theme === "dark" ? (
        <div className="absolute inset-0">
          <AnoAI />
        </div>
      ) : null}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,var(--bg-glow-a),transparent_42%),radial-gradient(ellipse_at_bottom_right,var(--bg-glow-b),transparent_46%),linear-gradient(115deg,transparent_0%,var(--bg-glow-c)_42%,transparent_72%)]" />
      <div className="absolute inset-x-0 top-0 h-44 bg-gradient-to-b from-white/55 to-transparent dark:from-white/[0.03]" />
      <div className="absolute inset-x-[-12%] top-[16%] h-40 rotate-[-7deg] bg-gradient-to-r from-transparent via-white/35 to-transparent blur-2xl dark:via-white/[0.025]" />
      <div
        className="absolute inset-0 opacity-[0.035] dark:opacity-[0.045]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundSize: "200px",
        }}
      />
      <svg className="absolute inset-0 h-full w-full opacity-80" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="grid" width="56" height="56" patternUnits="userSpaceOnUse">
            <path
              d="M 56 0 L 0 0 0 56"
              fill="none"
              stroke="var(--grid-stroke)"
              strokeWidth="0.45"
            />
          </pattern>
          <linearGradient id="fade" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="white" stopOpacity="0.8" />
            <stop offset="52%" stopColor="white" stopOpacity="0.28" />
            <stop offset="100%" stopColor="white" stopOpacity="0.05" />
          </linearGradient>
          <mask id="grid-fade">
            <rect width="100%" height="100%" fill="url(#fade)" />
          </mask>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" mask="url(#grid-fade)" />
      </svg>
    </div>
  )
}
