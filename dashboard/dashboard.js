import { db, collection, onSnapshot, doc, updateDoc, setDoc, deleteDoc } from '../app/firebase-config.js';

window.onerror = function(msg, url, line, col, error) {
    alert("관제실 스크립트 오류: " + msg + " (줄: " + line + ")");
};

const teamsRef = collection(db, 'teams');
const settingsRef = doc(db, 'settings', 'global');

window.teamsData = {};
window.availableGrades = new Set();
window.availableClasses = new Set();

// 전역 설정 리스너 (API Key 및 게임 버전 로드)
onSnapshot(settingsRef, (docSnap) => {
    if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.aiConfig && data.aiConfig.apiKey) {
            document.getElementById('ai-api-key').value = data.aiConfig.apiKey;
        }
        if (data.version) {
            document.getElementById('game-version-select').value = data.version;
        }
    }
});

window.saveApiKey = async function() {
    const apiKey = document.getElementById('ai-api-key').value;
    try {
        await setDoc(settingsRef, { aiConfig: { apiKey: apiKey, model: 'gemini-1.5-flash' } }, { merge: true });
        const statusEl = document.getElementById('api-save-status');
        statusEl.style.display = 'inline';
        setTimeout(() => { statusEl.style.display = 'none'; }, 3000);
    } catch (e) {
        alert("신통력(API 키) 부여 중 기운이 엇갈렸사옵니다: " + e.message);
    }
};

window.saveGameVersion = async function() {
    const version = document.getElementById('game-version-select').value;
    try {
        await setDoc(settingsRef, { version: version }, { merge: true });
    } catch (e) {
        alert("진행 방식 설정 중 오류가 발생했사옵니다: " + e.message);
    }
};

onSnapshot(teamsRef, (snapshot) => {
    const tbody = document.getElementById('team-list-body');
    let html = '';
    let count = 0;

    window.teamsData = {};
    window.availableGrades.clear();
    window.availableClasses.clear();

    snapshot.forEach((doc) => {
        const data = doc.data();
        window.teamsData[doc.id] = data;
        count++;
        
        // 학년/반 정보 추출 (예: '1학년 3반 1모둠')
        const nameStr = data.name || '';
        const gradeMatch = nameStr.match(/(\d+)학년/);
        if (gradeMatch) window.availableGrades.add(gradeMatch[1]);
        const classMatch = nameStr.match(/(\d+)반/);
        if (classMatch) window.availableClasses.add(classMatch[1]);
        
        // 1. 관문 통과 현황 (불빛 - 호롱불 테마 적용)
        // 팀의 진행 버전에 따라 관문 순서를 동적으로 설정
        let gateOrder = [1, 2, 3, 4, 5, 5.5, 6, '종막', '완료']; // 기본(온라인)
        if (data.version === 'combined') {
            gateOrder = [1, 2, 3, 4, 5, 5.5, 6, 6.5, '종막', '완료'];
        }
        let currentIndex = gateOrder.indexOf(data.currentGate);
        if (currentIndex === -1) currentIndex = 0; // fallback

        let gateHtml = '<div style="display: flex; gap: 8px; flex-wrap: wrap; align-items: center; justify-content: center;">';
        gateOrder.forEach((gate, idx) => {
            let gateClass = 'gate-indicator gate-pending';
            if (idx < currentIndex) {
                gateClass = 'gate-indicator gate-passed';
            } else if (idx === currentIndex) {
                gateClass = 'gate-indicator gate-current';
            }
            
            let label = gate === '종막' ? '종막' : (gate === '완료' ? '수라' : `${gate}`);
            gateHtml += `
                <div style="display: flex; flex-direction: column; align-items: center; gap: 4px;">
                    <div class="${gateClass}"></div>
                    <span style="font-size: 0.75rem; color: #a89f91; font-family: 'Gowun Dodum', sans-serif;">${label}</span>
                </div>
            `;
        });
        gateHtml += '</div>';

        // 2. 범행 근거 (주관식)
        const reason = data.finalReason ? data.finalReason : '<span style="color:#666;">아직 기록되지 않았사옵니다.</span>';

        // 3. 어의 문진표 (상담 결과 보기 버튼)
        let dietContent = `<span style="color:#666;">-</span>`;
        if (data.originalDiet || data.finalDiet) {
            dietContent = `<button onclick="openCounselingModal('${doc.id}')" class="btn-primary" style="padding: 6px 12px; font-size: 0.9rem;">[문진표 확인]</button>`;
        }

        const versionBadge = data.version === 'combined' 
            ? `<span style="font-size:0.7em; background-color:#8e44ad; color:white; padding:2px 6px; border-radius:4px; margin-left:8px; vertical-align:middle;">결합</span>`
            : `<span style="font-size:0.7em; background-color:#2980b9; color:white; padding:2px 6px; border-radius:4px; margin-left:8px; vertical-align:middle;">온라인</span>`;

        html += `
            <tr id="team-row-${doc.id}">
                <td><strong>${data.name || '무명 수사관'}</strong>${versionBadge}</td>
                <td>${gateHtml}</td>
                <td style="font-size: 0.95em; max-width: 250px; white-space: normal; word-break: keep-all; color: var(--color-text);">${reason}</td>
                <td style="text-align: center;">${dietContent}</td>
            </tr>
        `;
    });

    document.getElementById('total-teams').innerText = count;
    
    updateFilterDropdowns(); // 필터 드롭다운 업데이트
    
    if (count > 0) {
        tbody.innerHTML = html;
        if (typeof window.filterTeams === 'function') window.filterTeams(); // 필터 유지
    } else {
        tbody.innerHTML = '<tr><td colspan="4" style="color: #888; padding: 40px;">입궐한 수사관이 아직 없사옵니다.</td></tr>';
    }
});

function updateFilterDropdowns() {
    const gradeSelect = document.getElementById('filter-grade');
    const classSelect = document.getElementById('filter-class');
    if (!gradeSelect || !classSelect) return;
    
    const currentGrade = gradeSelect.value;
    const currentClass = classSelect.value;
    
    let gradeOptions = '<option value="">전체 학년</option>';
    Array.from(window.availableGrades).sort((a,b)=>a-b).forEach(g => {
        gradeOptions += `<option value="${g}학년">${g}학년</option>`;
    });
    gradeSelect.innerHTML = gradeOptions;
    gradeSelect.value = currentGrade; 
    if(gradeSelect.selectedIndex === -1) gradeSelect.selectedIndex = 0;
    
    let classOptions = '<option value="">전체 반</option>';
    Array.from(window.availableClasses).sort((a,b)=>a-b).forEach(c => {
        classOptions += `<option value="${c}반">${c}반</option>`;
    });
    classSelect.innerHTML = classOptions;
    classSelect.value = currentClass;
    if(classSelect.selectedIndex === -1) classSelect.selectedIndex = 0;
}

window.filterTeams = function() {
    const searchText = document.getElementById('search-input').value.toLowerCase();
    const filterGrade = document.getElementById('filter-grade') ? document.getElementById('filter-grade').value : '';
    const filterClass = document.getElementById('filter-class') ? document.getElementById('filter-class').value : '';
    
    const rows = document.querySelectorAll('#team-list-body tr');
    let visibleCount = 0;
    
    rows.forEach(row => {
        // 데이터가 없는 행은 무시
        if(row.cells.length === 1) return;
        
        const teamName = row.cells[0].innerText.toLowerCase();
        
        const matchGrade = filterGrade === "" || teamName.includes(filterGrade);
        const matchClass = filterClass === "" || teamName.includes(filterClass);
        const matchSearch = searchText === "" || teamName.includes(searchText);
        
        if (matchGrade && matchClass && matchSearch) {
            row.style.display = '';
            visibleCount++;
        } else {
            row.style.display = 'none';
        }
    });
    
    // 검색 결과 수 표시 (옵션)
    if (searchText || filterGrade || filterClass) {
        document.getElementById('total-teams').innerText = visibleCount + ' (필터링됨)';
    } else {
        document.getElementById('total-teams').innerText = Object.keys(window.teamsData).length;
    }
};

window.resetData = async function() {
    if(confirm('모든 수사관의 진척도를 파기하시겠사옵니까? (어명을 거둘 수 없사옵니다)')) {
        const teamIds = Object.keys(window.teamsData);
        if (teamIds.length === 0) {
            alert('파기할 기록이 없사옵니다.');
            return;
        }
        
        try {
            // 모든 문서를 순회하며 삭제
            const deletePromises = teamIds.map(id => deleteDoc(doc(db, 'teams', id)));
            await Promise.all(deletePromises);
            
            alert('어명에 따라 모든 수사 기록이 불태워졌사옵니다. (초기화 완료)');
            
            // 전역 변수 초기화 및 화면 갱신
            window.teamsData = {};
            window.availableGrades.clear();
            window.availableClasses.clear();
            updateFilterDropdowns();
            document.getElementById('team-list-body').innerHTML = '<tr><td colspan="4" style="color: #888; padding: 40px;">입궐한 수사관이 아직 없사옵니다.</td></tr>';
            document.getElementById('total-teams').innerText = 0;
            
        } catch (error) {
            alert('기록 파기 중 문제가 발생하였사옵니다: ' + error.message);
            console.error("삭제 오류:", error);
        }
    }
};

window.openCounselingModal = function(teamId) {
    const data = window.teamsData[teamId];
    
    if (data) {
        document.getElementById('modal-team-name').innerText = `[${data.name}] 수사관 어의 문진 기록`;
        document.getElementById('modal-original-diet').innerText = data.originalDiet || '입력된 수라상이 없사옵니다.';
        
        let chatHtml = '';
        if (data.chatHistory && data.chatHistory.length > 0) {
            data.chatHistory.forEach(msg => {
                if (msg.role === 'user') {
                    chatHtml += `<div class="chat-msg-user"><span>${msg.content}</span></div>`;
                } else if (msg.role === 'assistant') {
                    chatHtml += `<div class="chat-msg-ai"><span>${msg.content}</span></div>`;
                }
            });
        } else {
            chatHtml = '<div style="text-align:center; color:#888; margin-top: 30px;">어의(AI)와의 문진 내역이 없사옵니다.</div>';
        }
        document.getElementById('modal-chat-log').innerHTML = chatHtml;
        
        document.getElementById('modal-final-diet').innerText = data.finalDiet || '어명(최종 식단)이 아직 내려지지 않았사옵니다.';
        
        document.getElementById('counseling-modal').style.display = 'flex';
    } else {
        alert('해당 수사관의 기록을 찾을 수 없사옵니다.');
    }
}

window.closeCounselingModal = function() {
    document.getElementById('counseling-modal').style.display = 'none';
}

console.log("교사용 관제실(대시보드) 로드 완료");
