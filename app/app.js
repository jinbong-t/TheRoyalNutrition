import { db, auth, collection, addDoc, doc, updateDoc, signInAnonymously, onSnapshot } from './firebase-config.js';

let currentVersion = 'A'; // 기본값
let teamName = '';
let teamDocId = ''; 
let currentGate = 0;

// 서버에서 전역 버전 설정 가져오기
const settingsRef = doc(db, 'settings', 'global');
onSnapshot(settingsRef, (docSnap) => {
    if (docSnap.exists()) {
        const data = docSnap.data();
        if(data.version) {
            currentVersion = data.version;
            console.log("전역 버전 업데이트됨:", currentVersion);
        }
    }
});

// 알림창 제어
function showAlert(message) {
    document.getElementById('alert-message').innerText = message;
    document.getElementById('alert-modal').classList.remove('hidden');
}

window.closeAlert = function() {
    document.getElementById('alert-modal').classList.add('hidden');
}

// 게임 시작 (입궐하기)
window.startGame = async function() {
    teamName = document.getElementById('team-name').value.trim();
    
    if (!teamName) {
        showAlert('모둠 이름을 입력해주시오.');
        return;
    }
    
    try {
        // 1. Firebase 익명 로그인
        const userCredential = await signInAnonymously(auth);
        const user = userCredential.user;
        
        // 2. Firestore에 모둠 데이터 생성
        const docRef = await addDoc(collection(db, "teams"), {
            name: teamName,
            version: currentVersion,
            uid: user.uid,
            currentGate: 1,
            startTime: new Date().toISOString(),
            endTime: null,
            answers: {}
        });
        
        teamDocId = docRef.id;
        currentGate = 1;
        
        console.log(`[게임 시작] 팀명: ${teamName}, 버전: ${currentVersion}, DocID: ${teamDocId}`);
        
        // 화면 전환
        document.getElementById('sec-login').classList.remove('active');
        document.getElementById('sec-gate1').classList.add('active');
        document.getElementById('sec-gate1').classList.remove('hidden');
        
    } catch (error) {
        console.error("Error starting game: ", error);
        showAlert('입궐에 실패하였습니다. (네트워크 상태를 확인하시오)');
    }
}

// ================== 관문 1 로직 ==================
window.checkGate1 = async function() {
    const q1 = document.getElementById('g1-q1').value.trim();
    const q2 = document.getElementById('g1-q2').value.trim();
    const q3 = document.getElementById('g1-q3').value.trim();
    
    if(!q1 || !q2 || !q3) {
        showAlert('모든 빈칸을 채우시오.');
        return;
    }
    
    // 정답 체크 (탄수화물, 단백질, 지방)
    if(q1 === '탄수화물' && q2 === '단백질' && q3 === '지방') {
        const code = "231";
        document.getElementById('g1-result').innerHTML = `
            <div class="success-box">
                <p>정답이오! 반절표에 따른 1차 봉인 번호는 <strong>[ ${code} ]</strong> 이다.</p>
                <p class="guide-text">${currentVersion === 'A' ? '이 번호로 3자리 자물쇠 상자를 열어 인장 조각을 맞추시오.' : '다음 관문으로 넘어가시오.'}</p>
                <button class="btn-primary mt-10" onclick="nextGate(2)">다음 관문으로</button>
            </div>
        `;
        document.getElementById('btn-g1-submit').style.display = 'none';
        
        // Firestore 진행 상황 업데이트
        if(teamDocId) {
            await updateDoc(doc(db, "teams", teamDocId), { currentGate: 2 });
        }
    } else {
        showAlert('오답이오. 다시 잘 생각해보시오.');
    }
}

// ================== 관문 2 로직 ==================
window.checkGate2 = async function() {
    const q1 = document.getElementById('g2-q1').value.trim().toLowerCase();
    const q2 = document.getElementById('g2-q2').value.trim().toLowerCase();
    const q3 = document.getElementById('g2-q3').value.trim().toLowerCase();
    const q4 = document.getElementById('g2-q4').value.trim().toLowerCase();
    
    if(!q1 || !q2 || !q3 || !q4) {
        showAlert('모든 원소기호를 채우시오.');
        return;
    }
    
    // 정답 체크: 칼슘(ca), 인(p), 철(fe), 아연(zn)
    if(q1 === 'ca' && q2 === 'p' && q3 === 'fe' && q4 === 'zn') {
        // 거꾸로 읽기 논리: 인(2) 칼슘(1) 아연(4) 철(3) -> 2143
        const code = "2143";
        document.getElementById('g2-result').innerHTML = `
            <div class="success-box">
                <p>암호를 해독하였소!</p>
                <p>거꾸로 쓴 밀지에 따른 2차 봉인 번호는 <strong>[ ${code} ]</strong> 이다.</p>
                <p class="guide-text">${currentVersion === 'A' ? '이 번호로 4자리 자물쇠 상자를 열어 호패 조각을 확인하시오.' : '다음 관문으로 넘어가시오.'}</p>
                <button class="btn-primary mt-10" onclick="nextGate(3)">다음 관문으로</button>
            </div>
        `;
        document.getElementById('btn-g2-submit').style.display = 'none';
        
        // Firestore 진행 상황 업데이트
        if(teamDocId) {
            await updateDoc(doc(db, "teams", teamDocId), { currentGate: 3 });
        }
    } else {
        showAlert('해독 실패. 원소기호가 틀렸거나 오타가 있소.');
    }
}

// ================== 관문 3 로직 ==================
window.checkGate3 = async function() {
    const q1 = document.getElementById('g3-q1').value;
    const q2 = document.getElementById('g3-q2').value;
    const q3 = document.getElementById('g3-q3').value;
    const q4 = document.getElementById('g3-q4').value;
    const q5 = document.getElementById('g3-q5').value;
    const q6 = document.getElementById('g3-q6').value;

    if(!q1 || !q2 || !q3 || !q4 || !q5 || !q6) {
        showAlert('모든 진단 결과를 짝지으시오.');
        return;
    }

    // 정답: 1-C, 2-E, 3-A, 4-B, 5-F, 6-D
    if(q1==='C' && q2==='E' && q3==='A' && q4==='B' && q5==='F' && q6==='D') {
        showAlert('정확한 진단이오! 다음 관문으로 넘어가시오.');
        if(teamDocId) await updateDoc(doc(db, "teams", teamDocId), { currentGate: 4 });
        nextGate(4);
    } else {
        showAlert('진단에 오류가 있소. (주의: 몸에 저장되지 않아 매일 먹어야 하는 영양소를 다시 생각해보시오)');
    }
}

// ================== 관문 5 로직 ==================
window.showGate5Answer = function() {
    const q1 = document.getElementById('g5-q1').value.trim();
    if(!q1) {
        showAlert('답안을 먼저 작성하시오.');
        return;
    }
    document.getElementById('g5-answer-area').classList.remove('hidden');
    document.getElementById('btn-g5-answer').style.display = 'none';
}

// ================== 관문 6 로직 ==================
const suspectsData = [
    { name: '최상궁', c: true, d: true, e: true },
    { name: '장내시', c: false, d: false, e: false },
    { name: '세자빈', c: false, d: false, e: false },
    { name: '의녀 장덕', c: false, d: false, e: false } // 돼지고기(수육)지만 고추양념은 아님
];

window.updateSuspects = function() {
    const chkC = document.getElementById('chk-c').checked;
    const chkD = document.getElementById('chk-d').checked;
    const chkE = document.getElementById('chk-e').checked;

    let filtered = suspectsData.filter(s => {
        if(chkC && !s.c) return false;
        if(chkD && !s.d) return false;
        if(chkE && !s.e) return false;
        return true;
    });

    document.getElementById('suspect-count').innerText = filtered.length;
    document.getElementById('suspect-names').innerText = filtered.map(s => s.name).join(', ');

    if(filtered.length === 1 && filtered[0].name === '최상궁') {
        document.getElementById('btn-g6-arrest').style.display = 'inline-block';
    } else {
        document.getElementById('btn-g6-arrest').style.display = 'none';
    }
}

window.arrestSuspect = async function() {
    if(teamDocId) await updateDoc(doc(db, "teams", teamDocId), { currentGate: '종막' });
    nextGate('ending');
}

// ================== 종막 로직 ==================
window.declareEnding = async function() {
    const culprit = document.getElementById('final-culprit').value;
    const reason = document.getElementById('final-reason').value.trim();

    if(!culprit) {
        showAlert('진범을 지목하시오.');
        return;
    }
    if(!reason) {
        showAlert('범행 근거를 서술하시오.');
        return;
    }

    if(culprit === '최상궁') {
        // 성공
        document.getElementById('sec-ending').classList.remove('active');
        document.getElementById('sec-ending').classList.add('hidden');
        document.getElementById('sec-final-result').classList.remove('hidden');
        document.getElementById('sec-final-result').classList.add('active');

        if(teamDocId) {
            await updateDoc(doc(db, "teams", teamDocId), { 
                currentGate: '완료',
                endTime: new Date().toISOString(),
                finalReason: reason
            });
        }
    } else {
        showAlert('그자는 진범이 아니오! 소거표를 다시 확인해보시오.');
    }
}

// 다음 관문 이동 유틸리티
window.nextGate = function(gateNum) {
    currentGate = gateNum;
    document.querySelectorAll('section').forEach(sec => {
        sec.classList.remove('active');
        sec.classList.add('hidden');
    });
    
    const nextSec = document.getElementById(`sec-gate${gateNum}`);
    if(nextSec) {
        nextSec.classList.remove('hidden');
        nextSec.classList.add('active');
    }
}

// 초기화
console.log("수라간의 비밀 앱 로드 완료");
