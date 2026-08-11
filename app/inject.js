const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');
if (!html.includes('compact.css')) {
    html = html.replace('<link rel="stylesheet" href="premium.css?v=11">', '<link rel="stylesheet" href="premium.css?v=11">\n    <link rel="stylesheet" href="compact.css?v=1">');
    fs.writeFileSync('index.html', html, 'utf8');
    console.log('compact.css injected');
}
