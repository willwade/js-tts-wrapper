/**
 * Script to create proper package.json for CJS build
 */

import { writeFileSync } from 'fs';
import { join } from 'path';

const packageJson = {
  type: "commonjs"
};

const distPath = join(process.cwd(), 'dist', 'cjs', 'package.json');
writeFileSync(distPath, JSON.stringify(packageJson, null, 2));

console.log('Created CJS package.json successfully');
