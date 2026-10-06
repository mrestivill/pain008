# pain.008 GitHub Pages demo

A zero-build, browser-only ISO 20022 pain.008.001.08 demo, deployed with GitHub Actions.

## Files

- `index.html` — page
- `style.css` — styling
- `try-pain008.js` — CSV parsing, validation and XML generation
- `.nojekyll` — disables Jekyll processing
- `.github/workflows/pages.yml` — deploys the static site on every push to `main`

## Deploy

1. Create a GitHub repository and upload the contents of this folder to its `main` branch.
2. Open **Settings → Pages**.
3. Under **Build and deployment**, select **GitHub Actions** as the source.
4. Push a commit to `main` (or run the workflow manually from the Actions tab).
5. Open the Pages URL shown in the workflow deployment.

There is no Node.js, npm, Jekyll, compilation or build step. GitHub Actions simply packages the repository's static files and deploys them.

## Important

The generated XML is a browser-side demonstration. For production banking submission, validate the exact message version and scheme/bank requirements applicable to the creditor and mandate.


## Q1X

The bank sample is an XML `pain.008.001.08` document. The Q1X button downloads the generated XML unchanged with a `.Q1X` extension.
