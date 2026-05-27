import { dark } from "@clerk/themes"
import type { Theme } from "@/context/theme"

const ACCENT = "#38bdf8"
const ACCENT_FG = "#08080a"

/** Clerk modal, UserButton popover, and UserProfile — synced with app light/dark themes. */
export function getClerkAppearance(theme: Theme) {
  const isDark = theme === "dark"

  const text = isDark ? "#e8e8f0" : "#151925"
  const textMuted = isDark ? "#a8a8bc" : "#657084"
  const surface = isDark ? "#0f0f14" : "#ffffff"
  const surfaceMuted = isDark ? "#14141c" : "#eef4fa"
  const border = isDark ? "#1e1e2a" : "#d9e2ee"
  const primary = isDark ? ACCENT : "#2f6f73"
  const primaryFg = isDark ? ACCENT_FG : "#f8fbfc"

  return {
    baseTheme: isDark ? dark : undefined,
    variables: {
      colorBackground: surface,
      colorInputBackground: surfaceMuted,
      colorInput: surfaceMuted,
      colorForeground: text,
      colorNeutral: text,
      colorText: text,
      colorTextSecondary: textMuted,
      colorInputForeground: text,
      colorInputText: text,
      colorPrimary: primary,
      colorPrimaryForeground: primaryFg,
      colorDanger: isDark ? "#f87171" : "#ef4444",
      borderRadius: "0.75rem",
      fontFamily: '"DM Sans", ui-sans-serif, system-ui, sans-serif',
      fontFamilyButtons: '"DM Mono", ui-monospace, monospace',
    },
    elements: {
      modalBackdrop: { backdropFilter: "blur(6px)" },
      card: {
        backgroundColor: surface,
        border: `1px solid ${border}`,
        boxShadow: isDark
          ? "0 24px 80px rgba(0,0,0,0.55)"
          : "0 24px 80px rgba(0,0,0,0.12)",
      },
      headerTitle: { color: text },
      headerSubtitle: { color: textMuted },
      socialButtonsBlockButton: {
        border: `1px solid ${border}`,
        backgroundColor: surfaceMuted,
        color: text,
        "&:hover": {
          backgroundColor: isDark ? "#1a1a24" : "#f0f0f5",
        },
      },
      socialButtonsBlockButtonText: {
        color: text,
        fontFamily: '"DM Mono", ui-monospace, monospace',
        fontSize: "12px",
        letterSpacing: "0.04em",
      },
      formButtonPrimary: {
        backgroundColor: primary,
        color: primaryFg,
        "&:hover": { backgroundColor: isDark ? "#0ea5e9" : "#285f62" },
      },
      formFieldLabel: { color: textMuted },
      formFieldInput: { color: text },
      dividerText: { color: textMuted },
      footerActionText: { color: textMuted },
      footerActionLink: { color: primary },
      identityPreviewText: { color: text },
      identityPreviewEditButtonIcon: { color: textMuted },

      /* UserButton dropdown */
      userButtonPopoverCard: {
        backgroundColor: surface,
        border: `1px solid ${border}`,
        boxShadow: isDark ? "0 16px 48px rgba(0,0,0,0.5)" : "0 16px 48px rgba(0,0,0,0.1)",
      },
      userButtonPopoverMain: { backgroundColor: surface },
      userButtonPopoverActions: { borderColor: border },
      userButtonPopoverActionButton: {
        color: text,
        "&:hover": {
          backgroundColor: isDark ? "#1a1a24" : "#f0f0f5",
        },
      },
      userButtonPopoverActionButtonText: { color: text, fontWeight: 500 },
      userButtonPopoverActionButtonIcon: { color: textMuted },
      userButtonPopoverFooter: {
        backgroundColor: isDark ? "#14141c" : "#f8f8fa",
        borderTop: `1px solid ${border}`,
      },
      userPreviewMainIdentifier: { color: text, fontWeight: 600 },
      userPreviewSecondaryIdentifier: { color: textMuted },

      /* UserProfile modal (Manage account) */
      rootBox: { color: text },
      modalContent: { backgroundColor: surface, color: text },
      navbar: {
        backgroundColor: isDark ? "#0c0c10" : "#f8f8fa",
        borderRight: `1px solid ${border}`,
      },
      navbarButton: {
        color: textMuted,
        "&:hover": {
          backgroundColor: isDark ? "#1a1a24" : "#f0f0f5",
          color: text,
        },
      },
      navbarButtonIcon: { color: "inherit" },
      navbarButtonText: { color: "inherit" },
      navbarButton__active: {
        backgroundColor: isDark ? "#1a1a24" : "#f0f0f5",
        color: primary,
      },
      pageScrollBox: { backgroundColor: surface },
      page: { backgroundColor: surface },
      profilePage: { color: text },
      profileSection: { borderColor: border },
      profileSectionTitle: { color: text },
      profileSectionTitleText: { color: text, fontWeight: 600 },
      profileSectionSubtitle: { color: textMuted },
      profileSectionContent: { color: text },
      profileSectionPrimaryButton: { color: primary },
      badge: {
        color: textMuted,
        borderColor: border,
        backgroundColor: surfaceMuted,
      },
      menuButton: { color: text },
      menuList: { backgroundColor: surface, borderColor: border },
      menuItem: { color: text },
      accordionTriggerButton: { color: text },
      tableHead: { color: textMuted },
      tableCell: { color: text },
    },
  }
}
