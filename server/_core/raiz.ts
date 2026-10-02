import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Raiz do projeto (pasta com o package.json), subindo a partir deste arquivo.
 * Funciona igual rodando o fonte (server/_core/...) e o pacote do esbuild
 * (dist/index.js), que ficam em profundidades diferentes.
 */
export function raizDoProjeto(inicio = path.dirname(fileURLToPath(import.meta.url))): string {
  let dir = inicio;
  for (let i = 0; i < 6; i++) {
    if (fs.existsSync(path.join(dir, "package.json"))) return dir;
    const acima = path.dirname(dir);
    if (acima === dir) break;
    dir = acima;
  }
  return process.cwd();
}
