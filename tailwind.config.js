/** @type {import('tailwindcss').Config} */
export default {
  content: ["./client/index.html", "./client/src/**/*.{ts,tsx}"],
  // Preflight desligado: o reset e os componentes base estão em client/src/index.css.
  // Utilitários do Tailwind ficam disponíveis para telas novas, com as cores da marca.
  corePlugins: { preflight: false },
  theme: {
    extend: {
      colors: {
        tinta: { DEFAULT: "#0d2a2b", 2: "#143c3d", 3: "#1e5152" },
        papel: "#fbf9f4",
        areia: { DEFAULT: "#f2ece0", 2: "#e7dfcf" },
        texto: "#142322",
        suave: "#5a6b68",
        linha: "#ddd5c5",
        cobre: { DEFAULT: "#c0673a", 2: "#a85530" },
        verde: "#2e7b59",
        ambar: "#a86f12",
        vermelho: "#b0412c",
      },
      fontFamily: {
        serif: ["Fraunces", "Georgia", "serif"],
        sans: ["Instrument Sans", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      borderRadius: { sm: "8px", DEFAULT: "14px", lg: "22px" },
    },
  },
  plugins: [],
};
