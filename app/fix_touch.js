const fs = require('fs');
let appJs = fs.readFileSync('app.js', 'utf8');

const newTouchLogic = 
        // 모바일 터치 이벤트
        darkRoom.addEventListener('touchstart', (e) => {
            const touch = e.touches[0];
            updateFlashlight(touch.clientX, touch.clientY);
        }, { passive: true });

        darkRoom.addEventListener('touchmove', (e) => {
            const touch = e.touches[0];
            updateFlashlight(touch.clientX, touch.clientY);
            e.preventDefault(); // 스크롤 방지
        }, { passive: false });
        // touchend 리셋 제거 (빛이 마지막 터치 위치에 유지되도록)
;

appJs = appJs.replace(/\/\/\s*모바일 터치 이벤트[\s\S]*?\}\);/g, newTouchLogic.trim());

fs.writeFileSync('app.js', appJs, 'utf8');
