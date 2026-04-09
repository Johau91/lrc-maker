import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  base: "/lrc-maker/",
  plugins: [tailwindcss()],
  build: {
    target: "esnext",
  },
  optimizeDeps: {
    exclude: ["@huggingface/transformers"],
  },
});
