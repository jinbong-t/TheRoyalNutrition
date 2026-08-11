const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

const regexHTML = /<div class="quiz-question">\s*건강한 막내 씩씩이가 아침 식사로 얻은 총 열량\(kcal\)을 계산하여 입력하세요\.<br>[\s\S]*?<\/div>/;

const newHTML = <div class="quiz-question">
            마녀의 공격을 막아내기 위해 씩씩이가 특별한 <b>[ 슈퍼 파워 샌드위치 🥪 ]</b>를 만들었어요! <br>이 샌드위치를 먹으면 씩씩이는 총 몇 kcal의 에너지를 얻게 될까요?<br>
            <span style="font-size:1.1rem; color:#1e293b; margin-top: 15px; display:inline-block; padding: 15px; background: rgba(255,255,255,0.9); border-radius: 12px; border: 3px dashed #fbbf24; width: 100%; text-align: left; box-sizing: border-box; box-shadow: inset 0 2px 5px rgba(0,0,0,0.1);">
                🥪 <b>슈퍼 파워 샌드위치 레시피</b><br><br>
                🍞 <b>통밀빵 2쪽</b> (탄수화물: 40g)<br>
                🧀 <b>두툼한 햄과 치즈</b> (단백질: 20g)<br>
                🍯 <b>마요네즈 특제 소스</b> (지방: 10g)<br>
                🥬 <b>신선한 양상추</b> (비타민과 수분: 듬뿍! 열량 없음)
            </span><br>
            <span style="font-size:0.95rem; color:#fef08a; text-shadow: 1px 1px 2px rgba(0,0,0,0.8); margin-top:15px; display:inline-block; font-weight:bold;">
                (💡 힌트: 탄수화물과 단백질은 1g당 4kcal, 지방은 1g당 9kcal의 힘을 냅니다!)
            </span>
        </div>;

html = html.replace(regexHTML, newHTML);
fs.writeFileSync('index.html', html, 'utf8');

let js = fs.readFileSync('app.js', 'utf8');
const regexJS = /\/\/ 씩씩이 식단: 탄 60g \* 4 \+ 단 10g \* 4 \+ 지 5g \* 9 = 240 \+ 40 \+ 45 = 325\s*\n\s*if \(parseInt\(inputVal\) === 325\) \{\s*\n\s*showModal\('🎉 정답입니다! \(탄수화물 240 \+ 단백질 40 \+ 지방 45 = 325kcal\)', true\);/;

const newJS = // 샌드위치 식단: 탄 40g * 4 + 단 20g * 4 + 지 10g * 9 = 160 + 80 + 90 = 330
    if (parseInt(inputVal) === 330) {
        showModal('🎉 딩동댕! (탄수화물 160 + 단백질 80 + 지방 90 = 330kcal)\\n씩씩이가 330kcal의 파워를 충전했습니다! 마녀 꼼짝 마!', true);;

js = js.replace(regexJS, newJS);
fs.writeFileSync('app.js', js, 'utf8');
