import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ["Geologica Variable", "Manrope Variable", "ui-sans-serif", "system-ui"],
        sans: ["Manrope Variable", "ui-sans-serif", "system-ui"],
        mono: ["IBM Plex Mono", "ui-monospace", "monospace"]
      },
      colors: {
        ink: "var(--ink)",
        paper: "var(--paper)",
        panel: "var(--panel)",
        line: "var(--line)",
        muted: "var(--muted)",
        permission: "var(--permission)",
        review: "var(--review)",
        denial: "var(--denial)",
        authority: "var(--authority)",
        code: "var(--code)",
        wash: "var(--wash)"
      },
      boxShadow: {
        control: "0 1px 2px rgba(11,16,20,.05), 0 12px 30px rgba(11,16,20,.04)"
      }
    }
  },
  plugins: []
} satisfies Config;
