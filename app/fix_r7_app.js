const fs = require('fs');
let code = fs.readFileSync('app.js', 'utf8');

const regex = /\/\/ 탄 60g \* 4 \+ 단 20g \* 4 \+ 지 10g \* 9 = 240 \+ 80 \+ 90 = 410[\s\S]*?if \(parseInt\(inputVal\) === 410\) \{[\s\S]*?showModal\('🎉 정답입니다! \(탄수화물 240 \+ 단백질 80 \+ 지방 90 = 410kcal\)', true\);/;

const replacement = // 씩씩이 식단: 탄 60g * 4 + 단 10g * 4 + 지 5g * 9 = 240 + 40 + 45 = 325
    if (parseInt(inputVal) === 325) {
        showModal('🎉 정답입니다! (탄수화물 240 + 단백질 40 + 지방 45 = 325kcal)', true);;

code = code.replace(regex, replacement);
fs.writeFileSync('app.js', code, 'utf8');
