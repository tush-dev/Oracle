import React from "react";

export const Background = () => (
  <>
    <div style={s.grain} />
    <div style={s.orbA} />
    <div style={s.orbB} />
    <div style={s.orbC} />
    <svg style={s.gridSvg} width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id="grid" width="52" height="52" patternUnits="userSpaceOnUse">
          <path d="M 52 0 L 0 0 0 52" fill="none" stroke="#c9a84c" strokeWidth="0.3" strokeOpacity="0.07" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#grid)" />
    </svg>
  </>
);

const s: Record<string, React.CSSProperties> = {
  grain: {
    position: "absolute", inset: 0, zIndex: 0, opacity: 0.045, pointerEvents: "none",
    backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
    backgroundSize: "200px",
  },
  orbA: { position: "absolute", top: "-220px", left: "-160px", width: "600px", height: "600px", borderRadius: "50%", background: "radial-gradient(circle, #c9a84c14 0%, transparent 65%)", zIndex: 0, pointerEvents: "none" },
  orbB: { position: "absolute", bottom: "-250px", right: "-200px", width: "700px", height: "700px", borderRadius: "50%", background: "radial-gradient(circle, #3a2a6014 0%, transparent 65%)", zIndex: 0, pointerEvents: "none" },
  orbC: { position: "absolute", top: "40%", left: "50%", transform: "translateX(-50%)", width: "800px", height: "300px", borderRadius: "50%", background: "radial-gradient(ellipse, #c9a84c06 0%, transparent 70%)", zIndex: 0, pointerEvents: "none" },
  gridSvg: { position: "absolute", inset: 0, zIndex: 0, pointerEvents: "none" },
};