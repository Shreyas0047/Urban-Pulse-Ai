const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "public/index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "public/styles.css"), "utf8");

function matches(pattern) {
  return [...html.matchAll(pattern)];
}

const ids = matches(/\sid="([^"]+)"/g).map((item) => item[1]);
assert.equal(new Set(ids).size, ids.length, "HTML IDs must be unique.");
assert.match(html, /class="skip-link" href="#mainContent"/);
assert.match(html, /<main id="mainContent"[^>]*tabindex="-1"/);

for (const image of matches(/<img\b[^>]*>/g).map((item) => item[0])) {
  assert.match(image, /\balt="[^"]*"/, `Image is missing alt text: ${image}`);
}
for (const dialog of matches(/<(?:div|section)[^>]*role="dialog"[^>]*>/g).map((item) => item[0])) {
  assert.ok(/aria-label=|aria-labelledby=/.test(dialog), `Dialog has no accessible name: ${dialog}`);
}
for (const button of matches(/<button\b[^>]*>/g).map((item) => item[0])) {
  assert.match(button, /\btype="(?:button|submit|reset)"/, `Button has no explicit type: ${button}`);
}
for (const input of matches(/<input\b[^>]*>/g).map((item) => item[0])) {
  assert.ok(/aria-label=|\bid=/.test(input), `Input has no label hook: ${input}`);
}
assert.match(html, /id="dashboardMessage"[^>]*aria-live="polite"/);
assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
assert.match(css, /:focus-visible/);
assert.match(css, /\.skip-link:focus/);

console.log(JSON.stringify({
  passed: true,
  uniqueIds: ids.length,
  imagesHaveAltText: true,
  dialogsNamed: true,
  explicitButtonTypes: true,
  inputLabelHooks: true,
  skipNavigation: true,
  reducedMotion: true,
  liveFeedback: true
}, null, 2));
