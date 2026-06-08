import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { marked } from "marked";

const docsDir = path.resolve("docs");
const outDir = path.resolve("dist/docs-site");

await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });

const markdownFiles = await collectMarkdownFiles(docsDir);
const pages = [];

for (const file of markdownFiles) {
  const relative = path.relative(docsDir, file).replaceAll("\\", "/");
  const markdown = await readFile(file, "utf8");
  const title = extractTitle(markdown) ?? "Realtime Mail Standard";
  const htmlPath = relative.replace(/\.md$/u, ".html");
  const outputPath = path.join(outDir, htmlPath);
  const content = marked.parse(rewriteMarkdownLinks(markdown));
  pages.push({ title, href: htmlPath, source: relative });
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, pageTemplate(title, content, htmlPath), "utf8");
}

await writeFile(path.join(outDir, "index.html"), landingPage(pages), "utf8");
await writeFile(path.join(outDir, "404.html"), redirect404(), "utf8");
await writeFile(path.join(outDir, ".nojekyll"), "", "utf8");

console.log(`Built ${pages.length} documentation pages in ${path.relative(process.cwd(), outDir)}`);

async function collectMarkdownFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectMarkdownFiles(entryPath));
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      files.push(entryPath);
    }
  }
  return files.sort((left, right) => left.localeCompare(right));
}

function extractTitle(markdown) {
  return markdown.match(/^#\s+(.+)$/mu)?.[1]?.trim();
}

function rewriteMarkdownLinks(markdown) {
  return markdown.replace(/\]\(([^)]+)\.md(#[^)]+)?\)/gu, (_match, href, hash = "") => `](${href}.html${hash})`);
}

function pageTemplate(title, content, currentPath) {
  const depth = currentPath.split("/").length - 1;
  const root = depth === 0 ? "" : "../".repeat(depth);
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)} | Realtime Mail Standard</title>
    <link rel="stylesheet" href="${root}assets/site.css" />
  </head>
  <body>
    <header class="site-header">
      <a class="brand" href="${root}index.html">Realtime Mail Standard</a>
      <a href="https://github.com/MonkeyTime/realtime-mail-standard">GitHub</a>
    </header>
    <main class="doc">
      ${content}
    </main>
  </body>
</html>
`;
}

function landingPage(pages) {
  const groups = [
    {
      title: "Start Here",
      items: ["project-direction.md", "specification.md", "security-model.md", "threat-model.md", "roadmap.md", "guides/developer-quickstart.md"]
    },
    {
      title: "SDK References",
      items: ["reference/typescript.md", "reference/python.md", "reference/go.md", "reference/rust.md", "reference/java.md", "reference/csharp.md", "sdk-compatibility.md"]
    },
    {
      title: "Profiles",
      items: ["gateway-sdk-profile.md", "payment-request-profile.md", "state-policy.md"]
    }
  ];
  const pageBySource = new Map(pages.map((page) => [page.source, page]));
  const sections = groups.map((group) => `
        <section>
          <h2>${group.title}</h2>
          <ul>
            ${group.items.map((source) => {
              const page = pageBySource.get(source);
              return page ? `<li><a href="${page.href}">${escapeHtml(page.title)}</a></li>` : "";
            }).join("\n")}
            ${group.title === "Profiles" ? '<li><a href="https://github.com/MonkeyTime/realtime-mail-standard/tree/main/spec/schemas">Normative schemas</a></li>' : ""}
          </ul>
        </section>`).join("\n");

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Realtime Mail Standard</title>
    <link rel="stylesheet" href="/realtime-mail-standard/assets/site.css" />
  </head>
  <body>
    <main class="home">
      <header class="hero">
        <p class="eyebrow">Open draft standard</p>
        <h1>Realtime Mail Standard</h1>
        <p>Trusted realtime interactive mail with signed messages, sandboxed rendering, explicit capabilities, host-mediated actions, and gateway-backed delivery.</p>
      </header>
      <div class="grid">
${sections}
      </div>
    </main>
  </body>
</html>
`;
}

function redirect404() {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Redirecting | Realtime Mail Standard</title>
    <script>
      const path = window.location.pathname;
      if (path.endsWith(".md")) {
        window.location.replace(path.slice(0, -3) + ".html" + window.location.search + window.location.hash);
      }
    </script>
    <link rel="stylesheet" href="assets/site.css" />
  </head>
  <body>
    <main class="home">
      <h1>Page not found</h1>
      <p>If you followed an old Markdown URL, replace <code>.md</code> with <code>.html</code>.</p>
      <p><a href="/realtime-mail-standard/">Go to the documentation home</a></p>
    </main>
  </body>
</html>
`;
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
