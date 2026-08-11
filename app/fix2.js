const fs = require('fs');
let appJs = fs.readFileSync('app.js', 'utf8');

const targetRegex = /darkRoom\.addEventListener\('mousemove', \(e\) => \{[\s\S]*?\}\);/g;

const newTouchLogic = 
    darkRoom.addEventListener('mousemove', (e) => {
        cursor.style.left = e.clientX + 'px';
        cursor.style.top  = e.clientY + 'px';

        const rect = darkRoom.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const overlay = document.getElementById('dark-overlay');
        if (overlay) {
            overlay.style.background = \adial-gradient(circle 65px at \px \px, transparent 0%, rgba(0,0,0,0.55) 45%, rgba(0,0,0,0.99) 100%)\;
        }
    });

    // 모바일 터치 지원 추가
    function handleTouch(e) {
        if (darkRoom.classList.contains('lights-on')) return;
        const touch = e.touches[0];
        cursor.style.left = touch.clientX + 'px';
        cursor.style.top  = touch.clientY + 'px';
        cursor.style.opacity = '1';

        const rect = darkRoom.getBoundingClientRect();
        const x = touch.clientX - rect.left;
        const y = touch.clientY - rect.top;
        const overlay = document.getElementById('dark-overlay');
        if (overlay) {
            overlay.style.background = \adial-gradient(circle 65px at \px \px, transparent 0%, rgba(0,0,0,0.55) 45%, rgba(0,0,0,0.99) 100%)\;
        }
    }

    darkRoom.addEventListener('touchstart', (e) => {
        handleTouch(e);
        // e.preventDefault()를 호출하면 당근 클릭 이벤트가 막히므로 생략합니다.
    }, { passive: true });

    darkRoom.addEventListener('touchmove', (e) => {
        handleTouch(e);
        if (e.cancelable) e.preventDefault(); // 스크롤 방지
    }, { passive: false });

    darkRoom.addEventListener('touchend', (e) => {
        cursor.style.opacity = '0';
    });
;

appJs = appJs.replace(targetRegex, newTouchLogic.trim());

fs.writeFileSync('app.js', appJs, 'utf8');
