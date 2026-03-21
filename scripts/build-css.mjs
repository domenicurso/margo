import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";

const sourcePath = path.resolve("src/index.css");
const outputPath = path.resolve("dist/app.css");

const input = await readFile(sourcePath, "utf8");
const result = await postcss([tailwind()]).process(input, {
  from: sourcePath,
  to: outputPath,
});

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, result.css, "utf8");
