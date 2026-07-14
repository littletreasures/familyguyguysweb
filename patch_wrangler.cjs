const fs = require('fs');

let content = fs.readFileSync('wrangler.jsonc', 'utf8');
const buildConfig = `
  "build": {
    "command": "npm run build"
  },
  "assets": {`;
content = content.replace('"assets": {', buildConfig);

fs.writeFileSync('wrangler.jsonc', content, 'utf8');
