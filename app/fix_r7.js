const fs = require('fs');
let code = fs.readFileSync('index.html', 'utf8');

const regex = /<div class="quiz-stage hidden" id="r7-stage1">[\s\S]*?<div style="margin: 20px 0; display: flex;/;

const replacement = <div class="quiz-stage hidden" id="r7-stage1">
        <div class="quiz-label" style="background: #10b981;">💡 1단계: 씩씩이의 건강 식단 칼로리 계산</div>
        <div class="quiz-question">
            건강한 막내 씩씩이가 아침 식사로 얻은 총 열량(kcal)을 계산하여 입력하세요.<br>
            <span style="font-size:1.1rem; color:#1e293b; margin-top: 10px; display:inline-block; padding: 15px; background: rgba(255,255,255,0.85); border-radius: 8px; width: 100%; text-align: left; box-sizing: border-box; box-shadow: inset 0 2px 4px rgba(0,0,0,0.1);">
                🍚 <b>씩씩이의 아침 식단</b><br>
                - 밥 한 공기 (탄수화물: 60g)<br>
                - 계란 프라이 (단백질: 10g)<br>
                - 우유 1잔 (지방: 5g)<br>
                - 비타민과 무기질 (열량 없음)
            </span><br>
            <span style="font-size:0.9rem; color:#fef08a; text-shadow: 1px 1px 2px rgba(0,0,0,0.8); margin-top:10px; display:inline-block; font-weight:bold;">
                (힌트: 탄수화물과 단백질은 1g당 4kcal, 지방은 1g당 9kcal의 에너지를 냅니다)
            </span>
        </div>
        
        <div style="margin: 20px 0; display: flex;;

code = code.replace(regex, replacement);
fs.writeFileSync('index.html', code, 'utf8');
