const fs = require('fs');

// 1. Update index.html
let html = fs.readFileSync('index.html', 'utf8');

// OX Buttons
html = html.replace(
    /<button class="btn" style="width: 100px; font-size: 1\.8rem; background: #3b82f6;" onclick="checkR6OX\('O'\)">⭕<\/button>/,
    '<button class="btn" style="width: 110px; height: 110px; border-radius: 50%; font-size: 3.5rem; background: #3b82f6; display: flex; align-items: center; justify-content: center; line-height: 1; padding: 0;" onclick="checkR6OX(\\\'O\\\')">⭕</button>'
);
html = html.replace(
    /<button class="btn" style="width: 100px; font-size: 1\.8rem; background: #ef4444;" onclick="checkR6OX\('X'\)">❌<\/button>/,
    '<button class="btn" style="width: 110px; height: 110px; border-radius: 50%; font-size: 3.5rem; background: #ef4444; display: flex; align-items: center; justify-content: center; line-height: 1; padding: 0;" onclick="checkR6OX(\\\'X\\\')">❌</button>'
);

// Skip buttons to Joystick
html = html.replace(/>⏩ 스킵<\/button>/g, '>🕹️</button>');
html = html.replace(/>\[스킵\]<\/button>/g, '>🕹️</button>');

// Center Room 7 buttons
html = html.replace(
    /onclick="checkR7Stage1\(\)">정답 확인<\/button>/g,
    'display: block; margin: 0 auto;" onclick="checkR7Stage1()">정답 확인</button>'
);
html = html.replace(
    /onclick="checkR7Stage2\(\)">제출하기<\/button>/g,
    'display: block; margin: 0 auto;" onclick="checkR7Stage2()">제출하기</button>'
);
html = html.replace(
    /onclick="checkR7Stage3\(\)">처방전 확인<\/button>/g,
    'display: block; margin-left: auto; margin-right: auto;" onclick="checkR7Stage3()">주스 만들기 🍹</button>'
);

// Room 7 Stage 3 concept change
const oldR7S3 = /<div class="quiz-label" style="background: #f59e0b;">💡 3단계: 최종 처방전 작성<\/div>[\s\S]*?<div class="market-items"/;
const newR7S3 = '<div class="quiz-label" style="background: #f59e0b;">💡 3단계: 마법의 비타민 주스 만들기</div>\n' +
'        <div class="quiz-question">\n' +
'            씩씩이가 아픈 형들을 낫게 할 마법의 <b>[비타민 주스 🍹]</b>를 만들려고 해요!<br>\n' +
'            밤눈이 어두운 잠보(야맹증)와 잇몸에서 피가 나는 흐림이(괴혈병)를 위해,<br>\n' +
'            주서기에 꼭 넣어야 할 <b>핵심 비타민 2가지</b>를 골라주세요!\n' +
'        </div>\n' +
'        \n' +
'        <div class="market-items"';
html = html.replace(oldR7S3, newR7S3);

fs.writeFileSync('index.html', html, 'utf8');

// 2. Update app.js
let js = fs.readFileSync('app.js', 'utf8');

// Room 7 Stage 3 success message
js = js.replace(
    /showModal\('🎉 대단해요! 야맹증엔 비타민 A, 괴혈병엔 비타민 C를 정확히 처방했습니다!', true\);/,
    "showModal('🎉 대성공! (비타민 A + 비타민 C)\\n마법의 주스를 마시고 형들이 모두 건강해졌어요!', true);"
);
js = js.replace(
    /showModal\('❌ 오진입니다! 야맹증과 괴혈병을 예방하는 비타민을 다시 확인해보세요.', false\);/,
    "showModal('❌ 맛이 이상해요! 야맹증과 괴혈병을 치료할 진짜 비타민을 다시 골라보세요.', false);"
);

// Add shuffle logic to DOMContentLoaded
const domLoadMatch = "initWordCards();\n});";
const shuffleLogic = "initWordCards();\n" +
"    // 보기 섞기 (5번방 마켓 등)\n" +
"    const market = document.getElementById('r5-market');\n" +
"    if (market) {\n" +
"        for (let i = market.children.length; i >= 0; i--) {\n" +
"            market.appendChild(market.children[Math.random() * i | 0]);\n" +
"        }\n" +
"    }\n" +
"});";
js = js.replace(domLoadMatch, shuffleLogic);

fs.writeFileSync('app.js', js, 'utf8');
