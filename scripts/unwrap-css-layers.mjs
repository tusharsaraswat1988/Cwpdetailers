import fs from "node:fs";
import path from "node:path";

export function unwrapLayers(str) {
  let result = "";
  let i = 0;
  while (i < str.length) {
    const layerIdx = str.indexOf("@layer", i);
    if (layerIdx === -1) {
      result += str.slice(i);
      break;
    }
    result += str.slice(i, layerIdx);
    const open = str.indexOf("{", layerIdx);
    const semi = str.indexOf(";", layerIdx);
    if (semi !== -1 && (open === -1 || semi < open)) {
      i = semi + 1;
      continue;
    }
    let depth = 1;
    let j = open + 1;
    while (j < str.length && depth > 0) {
      if (str[j] === "{") depth++;
      else if (str[j] === "}") depth--;
      j++;
    }
    const inner = str.slice(open + 1, j - 1);
    result += inner;
    i = j;
  }
  return result;
}

/**
 * Fallbacks for older Android WebViews (< Chrome 111):
 * 1. Inserts hsl(var(--X) / PCT%) fallback before @supports color-mix rules
 * 2. Adds transform: translate(...) fallback for translate: var(...) (< Chrome 104)
 * 3. Adds 100vh fallbacks for 100dvh properties (< Chrome 108)
 */
export function fixLegacyFallbacks(css) {
  let out = css;

  // 1. Fallback for Tailwind v4 color-mix opacity rules:
  // @supports (color:color-mix(in lab,red,red)){SEL{PROP:color-mix(in oklab,hsl(var(--NAME)) PCT%,transparent)}}
  out = out.replace(
    /@supports \(color:color-mix\(in lab,red,red\)\)\{([^{}]+)\{([a-z-]+):color-mix\(in oklab,hsl\((var\(--[^)]+\))\) ([\d.]+)%,transparent\)\}\}/g,
    (_, sel, prop, varName, pct) => {
      return `${sel}{${prop}:hsl(${varName} / ${pct}%)}@supports (color:color-mix(in lab,red,red)){${sel}{${prop}:color-mix(in oklab,hsl(${varName}) ${pct}%,transparent)}}`;
    }
  );

  // 2. Fallback for CSS `translate` property (< Chrome 104)
  out = out.replace(
    /translate:var\(--tw-translate-x\) var\(--tw-translate-y\)/g,
    "transform:translate(var(--tw-translate-x,0),var(--tw-translate-y,0));translate:var(--tw-translate-x) var(--tw-translate-y)"
  );

  // 3. Fallbacks for 100dvh (< Chrome 108)
  out = out.replace(/(?<!100vh;)height:100dvh/g, "height:100vh;height:100dvh");
  out = out.replace(/(?<!100vh;)min-height:100dvh/g, "min-height:100vh;min-height:100dvh");
  out = out.replace(/(?<!100vh;)max-height:100dvh/g, "max-height:100vh;max-height:100dvh");

  return out;
}

export function processCssDirectory(dir) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      processCssDirectory(fullPath);
    } else if (entry.name.endsWith(".css")) {
      let content = fs.readFileSync(fullPath, "utf8");
      let changed = false;

      if (content.includes("@layer")) {
        content = unwrapLayers(content);
        changed = true;
      }

      const withFallbacks = fixLegacyFallbacks(content);
      if (withFallbacks !== content) {
        content = withFallbacks;
        changed = true;
      }

      if (changed) {
        fs.writeFileSync(fullPath, content, "utf8");
        console.log(`Processed legacy fallbacks in ${entry.name} (${content.length} bytes)`);
      }
    }
  }
}

// When executed directly:
if (process.argv[1] && process.argv[1].endsWith("unwrap-css-layers.mjs")) {
  const targetDir = process.argv[2] || "artifacts/cwp-platform/dist/public/assets";
  processCssDirectory(path.resolve(targetDir));
}
