import { db, collection, onSnapshot, doc, updateDoc, setDoc } from '../app/firebase-config.js';

const teamsRef = collection(db, 'teams');
const settingsRef = doc(db, 'settings', 'global');

// 전역 설정 불러오기
onSnapshot(settingsRef, (docSnap) => {
    if (docSnap.exists()) {
        const data = docSnap.data();
        if(data.version === 'A') {
            document.querySelector('input[name="globalVersion"][value="A"]').checked = true;
        } else if(data.version === 'B') {
            document.querySelector('input[name="globalVersion"][value="B"]').checked = true;
        }
        
        if(data.aiConfig) {
            document.getElementById('ai-provider').value = data.aiConfig.provider || 'gemini';
            document.getElementById('ai-api-key').value = data.aiConfig.apiKey || '';
            document.getElementById('ai-config-status').innerText = '저장됨 (API 키 적용중)';
            document.getElementById('ai-config-status').style.color = '#4CAF50';
        }
    }
});

window.saveAiConfig = async function() {
    const provider = document.getElementById('ai-provider').value;
    const apiKey = document.getElementById('ai-api-key').value.trim();
    
    if(!apiKey) {
        alert('API 키를 입력해주세요.');
        return;
    }
    
    try {
        await setDoc(settingsRef, { 
            aiConfig: { provider: provider, apiKey: apiKey } 
        }, { merge: true });
        alert('AI 설정이 저장되었습니다.');
    } catch(e) {
        console.error("AI 설정 저장 실패", e);
        alert('저장 실패!');
    }
}

window.changeGlobalVersion = async function(ver) {
    try {
        await setDoc(settingsRef, { version: ver }, { merge: true });
        // alert(`모든 학생용 앱이 버전 ${ver}(으)로 고정되었습니다.`); // 알림 생략
    } catch(e) {
        console.error("전역 버전 설정 실패", e);
    }
}

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

        let resolutionContent = '-';
        if (data.originalDiet && data.finalDiet) {
            resolutionContent = `<button onclick="openCounselingModal('${doc.id}')" class="btn-primary" style="padding:5px 10px; font-size:0.8rem; border-radius:4px;">상담 결과 보기</button>`;
        } else if (data.dietResolution) {
            resolutionContent = data.dietResolution; // 기존 로직 대비
        }

        html += `
            <tr id="team-row-${doc.id}">
                <td><strong>${data.name || '알 수 없음'}</strong></td>
                <td>${data.version === 'A' ? '물리 조작(A)' : '디지털 전용(B)'}</td>
                <td style="color:var(--color-accent); font-weight:bold;">${statusText}</td>
                <td>${data.startTime ? new Date(data.startTime).toLocaleTimeString() : '-'}</td>
                <td>${data.endTime ? new Date(data.endTime).toLocaleTimeString() : '진행 중'}</td>
                <td style="font-size: 0.9em; max-width: 200px; white-space: normal; word-break: keep-all;">${resolutionContent}</td>
            </tr>
        `;
    });

    document.getElementById('total-teams').innerText = count;
    
    if (count > 0) {
        tbody.innerHTML = html;
    } else {
        tbody.innerHTML = '<tr><td colspan="6" class="empty-state">아직 접속한 모둠이 없습니다.</td></tr>';
    }
});

window.resetData = function() {
    if(confirm('모든 모둠의 진행 기록을 초기화하시겠습니까? (이 작업은 되돌릴 수 없습니다)')) {
        alert('아직 Firebase 연동 전입니다. 차후 구현 예정입니다.');
        // TODO: 일괄 삭제 로직
    }
};

window.openCounselingModal = async function(teamId) {
    const docSnap = await import('../app/firebase-config.js').then(module => {
        return module.getDoc(doc(db, 'teams', teamId));
    });
    
    if (docSnap.exists()) {
        const data = docSnap.data();
        document.getElementById('modal-team-name').innerText = `${data.name} 식단 상담 결과`;
        document.getElementById('modal-original-diet').innerText = data.originalDiet || '기록 없음';
        
        let chatHtml = '';
        if (data.chatHistory && data.chatHistory.length > 0) {
            data.chatHistory.forEach(msg => {
                if (msg.role === 'user') {
                    chatHtml += `<div style="text-align:right; margin-bottom:10px;"><span style="background:#4CAF50; color:white; padding:5px 10px; border-radius:10px; display:inline-block; max-width:80%; text-align:left;">${msg.content}</span></div>`;
                } else if (msg.role === 'assistant') {
                    chatHtml += `<div style="text-align:left; margin-bottom:10px;"><span style="background:#555; color:white; padding:5px 10px; border-radius:10px; display:inline-block; max-width:80%;">${msg.content}</span></div>`;
                }
            });
        } else {
            chatHtml = '<p style="color:#888;">대화 기록이 없습니다.</p>';
        }
        document.getElementById('modal-chat-log').innerHTML = chatHtml;
        
        document.getElementById('modal-final-diet').innerText = data.finalDiet || '기록 없음';
        
        document.getElementById('counseling-modal').style.display = 'flex';
    }
}

window.closeCounselingModal = function() {
    document.getElementById('counseling-modal').style.display = 'none';
}

console.log("대시보드 로드 완료");
