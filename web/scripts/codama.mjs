// Generates a typed TypeScript client for the Leash program from its Anchor IDL.
// Run: npm run codegen  (after `anchor build`, copy target/idl/leash.json -> web/idl/)
import { rootNodeFromAnchor } from '@codama/nodes-from-anchor';
import { renderVisitor } from '@codama/renderers-js';
import { createFromRoot } from 'codama';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const webDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const idl = JSON.parse(readFileSync(path.join(webDir, 'idl', 'leash.json'), 'utf-8'));
const codama = createFromRoot(rootNodeFromAnchor(idl));
await codama.accept(
  renderVisitor(webDir, {
    generatedFolder: 'src/generated/leash',
    syncPackageJson: false,
  }),
);
console.log('Generated client in src/generated/leash');
