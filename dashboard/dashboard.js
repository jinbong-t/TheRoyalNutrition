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
        if (data.version) {
            document.getElementById('game-version-select').value = data.version;
        }
    }
});



window.saveGameVersion = async function() {
    const version = document.getElementById('game-version-select').value;
    try {
        await setDoc(settingsRef, { version: version }, { merge: true });
        window.filterTeams(); // 버전을 바꾸면 즉시 리스트 필터링
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
        const nameStr = String(data.name || '');
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

        // 3. 최종 식단 표시 및 상세 기록 버튼
        let dietContent = `<span style="color:#666;">-</span>`;
        if (data.originalDiet || data.finalDiet) {
            let shortDiet = data.finalDiet ? data.finalDiet : '제출된 식단 없음';
            dietContent = `
                <div style="font-size: 0.95rem; color: #fff; margin-bottom: 8px; word-break: keep-all; font-weight: bold; line-height: 1.3;" title="${shortDiet}">${shortDiet}</div>
                <button onclick="openCounselingModal('${doc.id}')" class="btn-primary" style="padding: 4px 8px; font-size: 0.8rem; background-color: #444; border: 1px solid #666;">[상세 기록 확인]</button>
            `;
        }

        const versionBadge = data.version === 'combined' 
            ? `<span style="font-size:0.7em; background-color:#8e44ad; color:white; padding:2px 6px; border-radius:4px; margin-left:8px; vertical-align:middle;">결합</span>`
            : `<span style="font-size:0.7em; background-color:#2980b9; color:white; padding:2px 6px; border-radius:4px; margin-left:8px; vertical-align:middle;">온라인</span>`;

        // 4. 과정중심평가 (드롭다운)
        const evalLevel = data.evaluationLevel || '';
        const evalHtml = `
            <div style="display: flex; flex-direction: column; gap: 8px; align-items: center;">
                <div style="font-size: 0.75rem; color: #e6b8a2; font-family: 'Gowun Dodum', sans-serif; text-align: center; line-height: 1.3; background: rgba(0,0,0,0.3); padding: 4px 8px; border-radius: 6px;">
                    🌱 <b>[성취기준]</b> 나의 수라상을 평가하고<br>건강한 식생활 실천하기!
                </div>
                <select onchange="updateEvaluation('${doc.id}', 'level', this.value)" style="padding: 6px; background: rgba(0,0,0,0.5); color: white; border: 1px solid var(--color-accent); border-radius: 4px; font-size: 0.85rem; cursor: pointer;">
                    <option value="">⭐ 성취수준 선택</option>
                    <option value="매우 우수 (A)" ${evalLevel === '매우 우수 (A)' ? 'selected' : ''}>매우 우수 (A)</option>
                    <option value="우수 (B)" ${evalLevel === '우수 (B)' ? 'selected' : ''}>우수 (B)</option>
                    <option value="보통 (C)" ${evalLevel === '보통 (C)' ? 'selected' : ''}>보통 (C)</option>
                    <option value="노력 요함 (D)" ${evalLevel === '노력 요함 (D)' ? 'selected' : ''}>노력 요함 (D)</option>
                </select>
            </div>
        `;

        html += `
            <tr id="team-row-${doc.id}">
                <td><strong>${data.name || '무명 수사관'}</strong>${versionBadge}</td>
                <td>${gateHtml}</td>
                <td style="font-size: 0.95em; max-width: 250px; white-space: normal; word-break: keep-all; color: var(--color-text);">${reason}</td>
                <td style="text-align: center;">${dietContent}</td>
                <td style="text-align: center;">${evalHtml}</td>
            </tr>
        `;
    });

    document.getElementById('total-teams').innerText = count;
    
    updateFilterDropdowns(); // 필터 드롭다운 업데이트
    
    if (count > 0) {
        tbody.innerHTML = html;
        if (typeof window.filterTeams === 'function') window.filterTeams(); // 필터 유지
    } else {
        tbody.innerHTML = '<tr><td colspan="5" style="color: #888; padding: 40px;">입궐한 수사관이 아직 없사옵니다.</td></tr>';
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
    const selectedVersion = document.getElementById('game-version-select') ? document.getElementById('game-version-select').value : 'online';
    
    const rows = document.querySelectorAll('#team-list-body tr');
    let visibleCount = 0;
    
    rows.forEach(row => {
        // 데이터가 없는 행은 무시
        if(row.cells.length === 1) return;
        
        const docId = row.id.replace('team-row-', '');
        const teamData = window.teamsData[docId];
        const teamVersion = teamData ? teamData.version : 'online'; // 기본 온라인
        
        const teamName = row.cells[0].innerText.toLowerCase();
        
        const matchVersion = teamVersion === selectedVersion;
        const matchGrade = filterGrade === "" || teamName.includes(filterGrade);
        const matchClass = filterClass === "" || teamName.includes(filterClass);
        const matchSearch = searchText === "" || teamName.includes(searchText);
        
        if (matchVersion && matchGrade && matchClass && matchSearch) {
            row.style.display = '';
            visibleCount++;
        } else {
            row.style.display = 'none';
        }
    });
    
    document.getElementById('total-teams').innerText = visibleCount;
};

window.updateEvaluation = async function(teamId, type, value) {
    try {
        const teamRef = doc(db, 'teams', teamId);
        if (type === 'competency') {
            await updateDoc(teamRef, { evaluationCompetency: value });
        } else if (type === 'level') {
            await updateDoc(teamRef, { evaluationLevel: value });
        }
    } catch (e) {
        console.error("평가 저장 오류:", e);
        alert("평가 기록 중 오류가 발생했사옵니다.");
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
            document.getElementById('team-list-body').innerHTML = '<tr><td colspan="5" style="color: #888; padding: 40px;">입궐한 수사관이 아직 없사옵니다.</td></tr>';
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

window.downloadCSV = function() {
    if (Object.keys(window.teamsData).length === 0) {
        alert('다운로드할 기록이 없사옵니다.');
        return;
    }

    let csvContent = "\uFEFF수사관(모둠),진행방식,현재 관문,범행 추리 근거,최종 제출 식단,성취수준(평가)\n";

    // 화면에 보이는 리스트 순서나 필터링된 결과만 다운받게 하려면 rows를 순회하는게 좋지만,
    // 전체 데이터를 다운로드하는 것이 일반적이므로 teamsData를 순회합니다.
    // 만약 필터링된 결과만 받고 싶다면, 화면에 보이는(display: none이 아닌) tr을 찾아 ID로 추출할 수 있습니다.
    const rows = document.querySelectorAll('#team-list-body tr');
    let count = 0;

    rows.forEach(row => {
        if (row.cells.length === 1 || row.style.display === 'none') return; // 데이터 없음 또는 숨김 처리됨
        const docId = row.id.replace('team-row-', '');
        const data = window.teamsData[docId];
        if (data) {
            let name = data.name || '무명 수사관';
            let version = data.version === 'combined' ? '온오프라인 결합' : '온라인 단독';
            let currentGate = data.currentGate || '1';
            let finalReason = (data.finalReason || '').replace(/"/g, '""');
            let finalDiet = (data.finalDiet || '').replace(/"/g, '""');
            let evalLevel = data.evaluationLevel || '';
            
            csvContent += `"${name}","${version}","${currentGate}","${finalReason}","${finalDiet}","${evalLevel}"\n`;
            count++;
        }
    });

    if (count === 0) {
        alert('현재 화면에 표시된 (다운로드할) 기록이 없사옵니다.');
        return;
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    const dateStr = new Date().toISOString().slice(0,10);
    link.setAttribute("download", `수라간의_비밀_기록_${dateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

window.downloadImage = function() {
    const mainElement = document.querySelector('main');
    if (!mainElement) return;
    
    const btn = document.querySelector('button[onclick="downloadImage()"]');
    if (btn) {
        btn.innerText = "저장 중...";
        btn.disabled = true;
    }

    // html2canvas가 로드되지 않은 경우 예외 처리
    if (typeof html2canvas === 'undefined') {
        alert('그림 그리는 장인을 불러오지 못했사옵니다. 새로고침 후 다시 시도해주시옵소서.');
        if (btn) {
            btn.innerText = "화면 이미지 저장";
            btn.disabled = false;
        }
        return;
    }

    html2canvas(mainElement, {
        backgroundColor: '#1f1a18', // dashboard.css의 배경색과 유사하게
        scale: 2
    }).then(canvas => {
        const imgData = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.href = imgData;
        const dateStr = new Date().toISOString().slice(0,10);
        link.download = `수라간의_비밀_대시보드_${dateStr}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        if (btn) {
            btn.innerText = "화면 이미지 저장";
            btn.disabled = false;
        }
    }).catch(err => {
        console.error("이미지 저장 오류:", err);
        alert("이미지 저장 중 기운이 엇갈렸사옵니다.");
        if (btn) {
            btn.innerText = "화면 이미지 저장";
            btn.disabled = false;
        }
    });
};

console.log("교사용 관제실(대시보드) 로드 완료");
