# Legacy root entry

The root `index.html`, `script.js`, `style.css`, and `elevator_core.wasm` are a frozen compatibility surface for the current branch-based GitHub Pages deployment.

Active development lives in `apps/web`. Do not add new behavior to the root JavaScript or stylesheet. After GitHub Pages is switched to the Actions deployment, this compatibility surface can be removed in one commit.
