# pain.008 GitHub Pages demo

A zero-build, browser-only ISO 20022 pain.008.001.08 demo.

## Files

- `index.html` — page
- `style.css` — styling
- `try-pain008.js` — CSV parsing, validation and XML generation
- `.nojekyll` — disables Jekyll processing

## Deploy

Create a GitHub repository, upload these files to the repository root, then enable:

**Settings → Pages → Deploy from a branch → `main` → `/ (root)`**

No Node.js, npm, Jekyll, GitHub Actions or build process is required.

## Important

The generated XML is a browser-side demonstration. For production banking submission, validate the exact message version and scheme/bank requirements applicable to the creditor and mandate.
