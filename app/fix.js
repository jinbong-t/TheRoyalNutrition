const fs = require('fs');

let html = fs.readFileSync('index.html', 'utf8');
html = html.replace(/<span style="cursor: pointer;" onclick="if\(\!boneGameActive\) startBoneGame\(\); boneScore=300; endBoneGame\(true\);" title=".*?">.*?<\/span>/g, '<span style="cursor: pointer; font-weight:bold; color:#f59e0b; font-size:1.1rem; border:2px solid #f59e0b; padding:2px 6px; border-radius:4px; margin-right:5px;" onclick="if(!boneGameActive) startBoneGame(); boneScore=300; endBoneGame(true);" title="미니게임 스킵">[스킵]</span>');
fs.writeFileSync('index.html', html, 'utf8');

let css = fs.readFileSync('premium.css', 'utf8');
css = css.replace(/\.cart-area \.market-item,\s*\.cart-area \[class\]/g, '.cart-area .market-item, .cart-area .cart-item');

css += '\n\n/* ===== 피드백 반영 9차 ===== */\n';
css += '.speech-bubble, .story-text { font-size: 1.15rem !important; padding: 15px 20px !important; line-height: 1.6 !important; margin-bottom: 15px !important; }\n';
css += '#flashlight-cursor { display: none !important; }\n';
css += '.cart-label { background: transparent !important; border: none !important; color: #fbbf24 !important; font-size: 1.1rem !important; }\n';
css += '.error-table { background: #fffbeb !important; }\n';
css += '.error-table td { color: #451a03 !important; font-weight: bold !important; text-shadow: none !important; }\n';

fs.writeFileSync('premium.css', css, 'utf8');
