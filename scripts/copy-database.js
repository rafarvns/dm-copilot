const { copyFileSync, mkdirSync, existsSync, readdirSync, statSync } = require("fs");
const { resolve } = require("path");

// Caminhos (usar __dirname do script)
const scriptDir = __dirname;
const projectRoot = resolve(scriptDir, "..");
const srcDir = resolve(projectRoot, "src/main/database");
const outDir = resolve(projectRoot, "out/main/database");

console.log("Copying database files...");
console.log(`  Source: ${srcDir}`);
console.log(`  Output: ${outDir}`);

// Função recursiva para copiar diretórios
function copyDirectory(src, dest) {
  // Criar diretório de saída
  mkdirSync(dest, { recursive: true });
  
  // Copiar todos os arquivos do diretório database
  const files = readdirSync(src);
  
  for (const file of files) {
    const srcPath = resolve(src, file);
    const outPath = resolve(dest, file);
    
    if (existsSync(srcPath)) {
      const stats = statSync(srcPath);
      
      if (stats.isDirectory()) {
        // Se for diretório, chamar recursivamente
        copyDirectory(srcPath, outPath);
      } else if (stats.isFile()) {
        // Se for arquivo, copiar
        copyFileSync(srcPath, outPath);
        console.log(`  Copied: ${file}`);
      }
    }
  }
}

try {
  copyDirectory(srcDir, outDir);
  console.log("Database files copied successfully!");
} catch (error) {
  console.error("Failed to copy database files:", error.message);
  process.exit(1);
}
