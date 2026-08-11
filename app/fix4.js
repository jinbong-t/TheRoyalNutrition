const fs = require('fs');
let code = fs.readFileSync('app.js', 'utf8');

const backtick = String.fromCharCode(96);
const dol = '$';

const touchLogic = 
    // === 모바일 터치 지원 추가 ===
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
            overlay.style.background =  + backtick + adial-gradient(circle 65px at  + dol + {x}px  + dol + {y}px, transparent 0%, rgba(0,0,0,0.55) 45%, rgba(0,0,0,0.99) 100%) + backtick + ;
        }
    }

    darkRoom.addEventListener('touchstart', (e) => {
        handleTouch(e);
    }, { passive: true });

    darkRoom.addEventListener('touchmove', (e) => {
        handleTouch(e);
        if (e.cancelable) e.preventDefault();
    }, { passive: false });

    darkRoom.addEventListener('touchend', (e) => {
        cursor.style.opacity = '0';
    });
});


function foundCarrot(el) {;

code = code.replace(/}\);\s*\n\s*\nfunction foundCarrot\(el\) {/, touchLogic);
fs.writeFileSync('app.js', code, 'utf8');
