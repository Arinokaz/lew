import { build } from "esbuild";
import { readFileSync, writeFileSync, readdirSync, statSync, mkdirSync } from "node:fs";
import { join, relative } from "node:path";

const PUBLIC = "public";
const OUT = "dist";

function walk(dir, ext = [".js", ".css", ".html", ".json", ".svg", ".png", ".ico"]) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      out.push(...walk(full, ext));
    } else if (ext.some((e) => name.endsWith(e))) {
      out.push(full);
    }
  }
  return out;
}

function ensureDir(dir) {
  try {
    mkdirSync(dir, { recursive: true });
  } catch {}
}

async function main() {
  ensureDir(OUT);
  console.log("[build] bundling app.js + components + services + pages + styles...");

  await build({
    entryPoints: ["public/src/app.js"],
    bundle: true,
    format: "esm",
    target: ["es2022"],
    minify: true,
    sourcemap: false,
    legalComments: "none",
    outfile: `${OUT}/lew.bundle.js`,
    loader: { ".css": "text", ".html": "text" },
    define: { "process.env.NODE_ENV": '"production"' },
  });

  await build({
    entryPoints: ["public/styles/components.css", "public/styles/base.css", "public/styles/tokens.css"],
    bundle: true,
    minify: true,
    outdir: `${OUT}/styles`,
    outbase: "public/styles",
  });

  console.log("[build] copying assets...");
  for (const f of walk(PUBLIC, [".js", ".mjs", ".json", ".svg", ".png", ".ico", ".webmanifest"])) {
    if (f.includes(`${PUBLIC}/src/`) || f.includes(`${PUBLIC}/styles/`)) continue;
    if (f.includes("service-worker.js")) continue;
    const dst = join(OUT, relative(PUBLIC, f));
    ensureDir(dst.replace(/\/[^/]+$/, ""));
    const data = readFileSync(f);
    writeFileSync(dst, data);
  }

  await build({
    entryPoints: ["public/service-worker.js"],
    bundle: false,
    minify: true,
    outfile: `${OUT}/service-worker.js`,
  });

  const indexHtml = readFileSync(`${PUBLIC}/index.html`, "utf8")
    .replace(/<script type="module" src="\.\/src\/app\.js"><\/script>/, '<script type="module" src="./lew.bundle.js"></script>');

  writeFileSync(`${OUT}/index.html`, indexHtml);

  const stats = (p) => {
    const s = statSync(p);
    return (s.size / 1024).toFixed(1) + " KB";
  };

  console.log("");
  console.log("✓ Built:");
  console.log("  dist/lew.bundle.js       ", stats(`${OUT}/lew.bundle.js`));
  console.log("  dist/index.html          ", stats(`${OUT}/index.html`));
  console.log("  dist/service-worker.js   ", stats(`${OUT}/service-worker.js`));
  console.log("  dexie inlined into lew.bundle.js");
  console.log("");
  console.log("Open dist/ via any static server (or `npx serve dist/`).");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
