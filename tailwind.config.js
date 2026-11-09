/** @type {import('tailwindcss').Config} */
export default {
  content: ["./client/index.html", "./client/src/**/*.{ts,tsx}"],
  // Preflight desligado: o reset e os componentes base estão em client/src/index.css.
  // Utilitários do Tailwind ficam disponíveis para telas novas, com as cores da marca.
  corePlugins: { preflight: false },
  theme: {
    extend: {
      colors: {
        tinta: { DEFAULT: "#0b1f3a", 2: "#112a4d", 3: "#1b3a66" },
        papel: "#fbfcfe",
        areia: { DEFAULT: "#f1f4f9", 2: "#e3e9f2" },
        texto: "#0e1a2b",
        suave: "#586579",
        linha: "#dbe2ec",
        cobre: { DEFAULT: "#c6a052", 2: "#b38a3a", texto: "#7f6020" },
        verde: "#2e7b59",
        ambar: "#a86f12",
        vermelho: "#b0412c",
      },
      fontFamily: {
        serif: ["Manrope", "system-ui", "sans-serif"],
        sans: ["Instrument Sans", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      borderRadius: { sm: "8px", DEFAULT: "14px", lg: "22px" },
    },
  },
  plugins: [],
};
