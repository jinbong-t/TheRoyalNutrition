import { db, collection, onSnapshot, doc, updateDoc } from '../app/firebase-config.js';

const teamsRef = collection(db, 'teams');

onSnapshot(teamsRef, (snapshot) => {
    const tbody = document.getElementById('team-list-body');
    let html = '';
    let count = 0;

    snapshot.forEach((doc) => {
        const data = doc.data();
        count++;
        
        let statusText = data.currentGate;
        if(typeof statusText === 'number') statusText = `관문 ${statusText} 진행중`;
        if(statusText === '종막') statusText = '최종 판결 중';
        if(statusText === '완료') statusText = '탈출 성공! 🎉';

        html += `
            <tr>
                <td><strong>${data.name || '알 수 없음'}</strong></td>
                <td>${data.version === 'A' ? '물리 조작(A)' : '디지털 전용(B)'}</td>
                <td style="color:var(--color-accent); font-weight:bold;">${statusText}</td>
                <td>${data.startTime ? new Date(data.startTime).toLocaleTimeString() : '-'}</td>
                <td>${data.endTime ? new Date(data.endTime).toLocaleTimeString() : '진행 중'}</td>
            </tr>
        `;
    });

    document.getElementById('total-teams').innerText = count;
    
    if (count > 0) {
        tbody.innerHTML = html;
    } else {
        tbody.innerHTML = '<tr><td colspan="5" class="empty-state">아직 접속한 모둠이 없습니다.</td></tr>';
    }
});

window.resetData = function() {
    if(confirm('모든 모둠의 진행 기록을 초기화하시겠습니까? (이 작업은 되돌릴 수 없습니다)')) {
        alert('아직 Firebase 연동 전입니다. 차후 구현 예정입니다.');
        // TODO: 일괄 삭제 로직
    }
};

console.log("대시보드 로드 완료");
