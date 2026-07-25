import { db, auth, collection, addDoc, doc, updateDoc, signInAnonymously, onSnapshot } from './firebase-config.js';

// --- 사운드 이펙트 (Web Audio API) ---
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
window.playSound = function(type) {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    const now = audioCtx.currentTime;
    
    if (type === 'success') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, now); 
        osc.frequency.exponentialRampToValueAtTime(1046.50, now + 0.1); 
        gainNode.gain.setValueAtTime(0, now);
        gainNode.gain.linearRampToValueAtTime(0.3, now + 0.05);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
        osc.start(now);
        osc.stop(now + 0.5);
    } else if (type === 'error') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.exponentialRampToValueAtTime(100, now + 0.3);
        gainNode.gain.setValueAtTime(0, now);
        gainNode.gain.linearRampToValueAtTime(0.2, now + 0.05);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
        osc.start(now);
        osc.stop(now + 0.3);
    } else if (type === 'click') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, now);
        osc.frequency.exponentialRampToValueAtTime(400, now + 0.05);
        gainNode.gain.setValueAtTime(0, now);
        gainNode.gain.linearRampToValueAtTime(0.1, now + 0.01);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
        osc.start(now);
        osc.stop(now + 0.05);
    } else if (type === 'doom') {
        // 영화 예고편 같은 근엄하고 웅장한 저음
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(100, now);
        osc.frequency.exponentialRampToValueAtTime(30, now + 3);
        gainNode.gain.setValueAtTime(0, now);
        gainNode.gain.linearRampToValueAtTime(0.8, now + 0.1);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 3);
        osc.start(now);
        osc.stop(now + 3);
    }
};

window.speakText = function(text) {
    // 기계음 대신 선생님이 준비하신 진짜 성우(또는 직접 녹음) 목소리를 재생합니다.
    const audio = new Audio('../narration.mp3');
    audio.play().catch(e => console.log('오디오 재생 실패 (파일이 없거나 권한 문제):', e));
};

document.addEventListener('click', (e) => {
    if (e.target.tagName === 'BUTTON' || e.target.closest('button')) {
        window.playSound('click');
    }
});
// ------------------------------------

let currentVersion = 'A'; // 기본값
let teamName = '';
let teamDocId = ''; 
let currentGate = 0;
let globalAiConfig = null;

// 서버에서 전역 설정 가져오기
const settingsRef = doc(db, 'settings', 'global');
onSnapshot(settingsRef, (docSnap) => {
    if (docSnap.exists()) {
        const data = docSnap.data();
        if(data.version) {
            currentVersion = data.version;
            console.log("전역 버전 업데이트됨:", currentVersion);
        }
        if(data.aiConfig) {
            globalAiConfig = data.aiConfig;
            console.log("AI 설정 업데이트됨");
        }
    }
});

// 알림창 제어
function showAlert(message, isSuccess = false) {
    if (isSuccess) window.playSound('success');
    else window.playSound('error');
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
        document.getElementById('sec-login').classList.add('hidden');
        
        // 영상 화면(스토리)으로 이동
        const nextSec = document.getElementById('sec-story');
        if(nextSec) {
            nextSec.classList.remove('hidden');
            nextSec.classList.add('active');
        }
        
        const video = document.getElementById('intro-video');
        if (video) {
            video.play().catch(e => console.log('Autoplay prevented by browser'));
        }

    } catch (error) {
        console.error("로그인 실패:", error);
        showAlert('오류가 발생했소. 다시 시도하시오.');
    }
}

// ================== 제 1 관문 ==================
window.checkG1Elements = function() {
    const q1 = document.getElementById('g1-q1').value.trim();
    const q2 = document.getElementById('g1-q2').value.trim();
    const q3 = document.getElementById('g1-q3').value.trim();
    
    // 정답 체크 (탄수화물, 단백질, 지방)
    if (q1 === '탄수화물' && q2 === '단백질' && q3 === '지방') {
        const padlockArea = document.getElementById('g1-padlock-area');
        if (padlockArea && padlockArea.classList.contains('hidden')) {
            window.playSound('success');
            padlockArea.classList.remove('hidden');
            padlockArea.classList.add('active');
        }
    }
}

window.checkGate1 = async function() {
    const q1 = document.getElementById('g1-q1').value.trim();
    const q2 = document.getElementById('g1-q2').value.trim();
    const q3 = document.getElementById('g1-q3').value.trim();
    const code = window.getPadlockValue('g1-padlock');
    
    if(!q1 || !q2 || !q3 || !code) {
        showAlert('모든 빈칸과 추리한 암호를 채우시오.');
        return;
    }
    
    // 정답 체크 (탄수화물, 단백질, 지방)
    if(q1 === '탄수화물' && q2 === '단백질' && q3 === '지방') {
        if(code === '231') {
            window.playSound('success');
            document.getElementById('g1-result').innerHTML = `
                <div class="success-box">
                    <p>정답이오! 반절표에 따른 1차 봉인 번호 <strong>[ ${code} ]</strong>을 정확히 추리하였소.</p>
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
            showAlert('영양소 이름은 맞았으나, 암호가 틀렸소. 힌트를 잘 보고 각 단어의 특징(받침)을 찾아보시오.');
        }
    } else {
        showAlert('오답이오. 영양소 이름부터 다시 잘 생각해보시오.');
    }
}

// ================== 제 2 관문 ==================
window.checkG2Elements = function() {
    const q1 = document.getElementById('g2-q1').value.trim().toLowerCase();
    const q2 = document.getElementById('g2-q2').value.trim().toLowerCase();
    const q3 = document.getElementById('g2-q3').value.trim().toLowerCase();
    const q4 = document.getElementById('g2-q4').value.trim().toLowerCase();
    
    if (q1 === 'ca' && q2 === 'p' && q3 === 'fe' && q4 === 'zn') {
        const padlockArea = document.getElementById('g2-padlock-area');
        if (padlockArea && padlockArea.classList.contains('hidden')) {
            window.playSound('success'); // 성공 효과음으로 짜잔!
            padlockArea.classList.remove('hidden');
            padlockArea.classList.add('active'); // CSS에서 block 또는 flex로 처리되게 하거나 그냥 hidden만 지움
        }
    }
}

window.checkGate2 = async function() {
    const q1 = document.getElementById('g2-q1').value.trim().toLowerCase();
    const q2 = document.getElementById('g2-q2').value.trim().toLowerCase();
    const q3 = document.getElementById('g2-q3').value.trim().toLowerCase();
    const q4 = document.getElementById('g2-q4').value.trim().toLowerCase();
    const code = window.getPadlockValue('g2-padlock');
    
    if(!q1 || !q2 || !q3 || !q4 || !code) {
        showAlert('모든 원소기호와 추리한 암호를 채우시오.');
        return;
    }
    
    // 정답 체크: 칼슘(ca), 인(p), 철(fe), 아연(zn)
    if(q1 === 'ca' && q2 === 'p' && q3 === 'fe' && q4 === 'zn') {
        if(code === '2143') {
            window.playSound('success');
            document.getElementById('g2-result').innerHTML = `
                <div class="success-box">
                    <p>암호를 해독하였소!</p>
                    <p>밀지를 거꾸로 읽어 2차 봉인 번호 <strong>[ ${code} ]</strong>를 정확히 추리했소.</p>
                    <p class="guide-text">이 번호(2143)는 종막 어전에 입장할 때 쓰이니 반드시 기억해두시오.</p>
                    <button class="btn-primary mt-10" onclick="nextGate(3)">다음 관문으로</button>
                </div>
            `;
            document.getElementById('btn-g2-submit').style.display = 'none';
            
            // Firestore 진행 상황 업데이트
            if(teamDocId) {
                await updateDoc(doc(db, "teams", teamDocId), { currentGate: 3 });
            }
        } else {
            showAlert('원소기호는 맞았으나, 암호가 틀렸소. 거꾸로 된 밀지가 가리키는 순서를 다시 조합해 보시오.');
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
        showAlert('정확한 진단이오! 다음 관문으로 넘어가시오.', true);
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

// ================== 관문 5.5 로직 ==================
const clueData = [
    { title: "단서 카드 A", subtitle: "(영양학적 증상)", content: "“세자 저하의 증상(야맹증, 괴혈병, 구루병)은 비타민 A, 비타민 C, 비타민 D, 그리고 칼슘이 장기간 결핍되었을 때 나타나는 현상이다.”" },
    { title: "단서 카드 B", subtitle: "(환경적 요인)", content: "“세자 저하의 안질(눈병) 때문에 저하의 처소는 낮에도 모든 창을 가려 햇빛이 전혀 들지 않는 어두운 상태를 유지했다.”<br><span style='font-size:0.85rem; color:#aaa; display:block; margin-top:5px;'>(힌트: 햇빛을 받지 못하면 몸 안에서 비타민 D가 합성되지 않아 결핍됨)</span>" },
    { title: "단서 카드 C", subtitle: "(피해자의 체질)", content: "“세자 저하는 최근 심한 위장 질환을 앓고 계셔서 매콤한 초피나 고추 같은 매운 음식을 먹으면 위장에 심한 쇼크를 일으키신다.”" },
    { title: "단서 카드 D", subtitle: "(의료 기록)", content: "“저하가 드신 음식물의 위 속 잔여물을 분석한 결과, 영양소가 최종 소화된 산물인 '포도당' 성분이 아주 다량으로 검출되었다.”<br><span style='font-size:0.85rem; color:#aaa; display:block; margin-top:5px;'>(힌트: 다당류 음료인 식혜와 쌀밥의 소화 결과)</span>" },
    { title: "단서 카드 E", subtitle: "(결정적 목격담)", content: "“사건 당일, 세자 저하의 옷자락에서 붉은 고추 양념이 묻은 돼지고기 기름 자국이 발견되었다.”" }
];

window.getClueCards = function() {
    const scoreStr = document.getElementById('quiz-score').value.trim();
    if (scoreStr === '') {
        showAlert('의학 서책 퀴즈 점수를 입력하시오.');
        return;
    }
    const score = parseInt(scoreStr, 10);
    if (score < 0 || score > 10) {
        showAlert('0에서 10 사이의 점수를 정확히 입력하시오.');
        return;
    }

    let clueCount = 0;
    if (score === 10) clueCount = 5;
    else if (score >= 7) clueCount = 3;
    else if (score >= 4) clueCount = 2;
    else clueCount = 0;

    const clueArea = document.getElementById('clue-cards-area');
    clueArea.innerHTML = '';

    if (clueCount === 0) {
        window.playSound('error');
        clueArea.innerHTML = '<div style="text-align:center; padding: 20px;"><p style="color:var(--color-accent-red); font-size:1.2rem; font-weight:bold;">단서 획득 실패 (세자 저하를 구하지 못함)</p><p class="mt-10">오직 직감으로만 범인을 찾아내야 한다!</p></div>';
    } else {
        window.playSound('success');
        const shuffled = [...clueData].sort(() => 0.5 - Math.random());
        const selectedClues = shuffled.slice(0, clueCount);
        selectedClues.sort((a, b) => a.title.localeCompare(b.title));

        selectedClues.forEach(clue => {
            const card = document.createElement('div');
            card.style.cssText = 'border: 2px solid var(--color-accent-gold); border-radius: 8px; padding: 15px; background: rgba(0,0,0,0.6); width: 220px; text-align: left; box-shadow: 0 4px 6px rgba(0,0,0,0.3);';
            card.innerHTML = `
                <div style="border-bottom:1px solid #555; padding-bottom:5px; margin-bottom:10px; text-align:center;">
                    <h4 style="color:var(--color-accent-gold); margin:0; font-size:1.1rem;">${clue.title}</h4>
                    <span style="font-size:0.85rem; color:#ccc;">${clue.subtitle}</span>
                </div>
                <p style="font-size:0.95rem; line-height:1.5;">${clue.content}</p>
            `;
            clueArea.appendChild(card);
        });
    }

    document.getElementById('btn-get-clues').style.display = 'none';
    document.getElementById('quiz-score').disabled = true;
    document.getElementById('btn-to-gate6-wrap').classList.remove('hidden');
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
        if (currentVersion === 'B') {
            document.getElementById('btn-g6-compare').style.display = 'inline-block';
            document.getElementById('btn-g6-arrest').style.display = 'none';
        } else {
            document.getElementById('btn-g6-arrest').style.display = 'inline-block';
            document.getElementById('btn-g6-compare').style.display = 'none';
        }
    } else {
        document.getElementById('btn-g6-arrest').style.display = 'none';
        document.getElementById('btn-g6-compare').style.display = 'none';
    }
}

window.showDigitalCompare = function() {
    document.getElementById('compare-modal').classList.remove('hidden');
    document.getElementById('compare-modal').classList.add('active');
}

window.closeCompareModal = function() {
    document.getElementById('compare-modal').classList.remove('active');
    document.getElementById('compare-modal').classList.add('hidden');
}

window.confirmArrest = async function() {
    window.playSound('success');
    closeCompareModal();
    if(teamDocId) await updateDoc(doc(db, "teams", teamDocId), { currentGate: '종막' });
    nextGate('ending');
}

window.arrestSuspect = async function() {
    window.playSound('success');
    if(teamDocId) await updateDoc(doc(db, "teams", teamDocId), { currentGate: '종막' });
    nextGate('ending');
}

// ================== 종막 로직 ==================
window.unlockEnding = function() {
    const code = window.getPadlockValue('final-padlock');
    if (code === '2143') {
        window.playSound('success');
        document.getElementById('ending-code-area').classList.add('hidden');
        document.getElementById('ending-report-area').classList.remove('hidden');
    } else {
        showAlert('암호가 틀렸소. 2차 봉인 번호를 다시 확인하시오.');
    }
}

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
        window.playSound('success');
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

let chatHistory = [];
let originalDiet = '';

const systemPrompt = "당신은 조선시대 내의원 최고 어의입니다. 학생이 어제 먹은 식단(아침, 점심, 저녁, 간식)을 보고, 6대 영양소(탄수화물, 단백질, 지방, 무기질, 비타민, 물) 관점에서 어떤 점이 부족하거나 과한지 사극 말투(예: ~하옵니다, 저하, 통촉하시옵소서 등)로 재미있고 친절하게 분석해주세요. 학생의 질문에 대답하며 함께 더 나은 '추천 식단'을 만들어가는 것이 목표입니다.";

window.startAiCounseling = function() {
    originalDiet = document.getElementById('original-diet-input').value.trim();
    if(!originalDiet) {
        showAlert('어제 먹은 식단을 먼저 상세히 적어주시옵소서.');
        return;
    }
    
    if(!globalAiConfig || !globalAiConfig.apiKey) {
        showAlert('어의(AI)가 아직 출근하지 않았습니다. 선생님께 대시보드에서 AI 설정을 부탁드리세요.');
        return;
    }

    document.getElementById('btn-start-counseling').style.display = 'none';
    document.getElementById('original-diet-input').disabled = true;
    document.getElementById('ai-chat-area').classList.remove('hidden');
    
    appendMessage('assistant', '오셨사옵니까! 어제 드신 식단을 꼼꼼히 진맥해 보겠습니다. 잠시만 기다려 주시옵소서...');
    
    // 첫 프롬프트 전송
    chatHistory = [];
    callAiApi(`이것이 내가 어제 먹은 식단이야:\n${originalDiet}\n\n이 식단을 분석해주고, 어떻게 개선하면 좋을지 조선시대 어의 말투로 친근하게 상담을 시작해줘.`);
}

window.sendChatMessage = function() {
    const input = document.getElementById('chat-input');
    const msg = input.value.trim();
    if(!msg) return;
    
    input.value = '';
    appendMessage('user', msg);
    callAiApi(msg);
}

// 엔터 키로 채팅 전송
document.getElementById('chat-input')?.addEventListener('keypress', function (e) {
    if (e.key === 'Enter') {
        window.sendChatMessage();
    }
});

function appendMessage(role, text) {
    const chatBox = document.getElementById('chat-messages');
    const div = document.createElement('div');
    if(role === 'user') {
        div.style.textAlign = 'right';
        div.innerHTML = `<span style="background:var(--color-primary); color:white; padding:10px 14px; border-radius:15px 15px 0 15px; display:inline-block; max-width:85%; text-align:left;">${text}</span>`;
    } else {
        div.style.textAlign = 'left';
        // 간단한 마크다운 볼드 처리
        const formattedText = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        div.innerHTML = `<span style="background:rgba(212,175,55,0.2); border: 1px solid var(--color-accent-gold); color:#eee; padding:10px 14px; border-radius:15px 15px 15px 0; display:inline-block; max-width:85%;">${formattedText}</span>`;
    }
    chatBox.appendChild(div);
    chatBox.scrollTop = chatBox.scrollHeight;
}

async function callAiApi(userMessage) {
    chatHistory.push({ role: 'user', content: userMessage });
    
    try {
        let aiResponseText = "";
        
        if (globalAiConfig.provider === 'gemini') {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${globalAiConfig.apiKey}`;
            
            let contents = [
                { role: 'user', parts: [{ text: systemPrompt }] },
                { role: 'model', parts: [{ text: '명을 받들겠사옵니다. 식단을 낱낱이 살펴 건강을 지켜드리겠나이다.' }] }
            ];
            chatHistory.forEach(msg => {
                contents.push({
                    role: msg.role === 'user' ? 'user' : 'model',
                    parts: [{ text: msg.content }]
                });
            });
            
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: contents })
            });
            
            const data = await res.json();
            if(data.error) throw new Error(data.error.message);
            aiResponseText = data.candidates[0].content.parts[0].text;
            
        } else if (globalAiConfig.provider === 'openai') {
            const url = `https://api.openai.com/v1/chat/completions`;
            
            let messages = [
                { role: 'system', content: systemPrompt }
            ];
            chatHistory.forEach(msg => messages.push(msg));
            
            const res = await fetch(url, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${globalAiConfig.apiKey}`
                },
                body: JSON.stringify({ 
                    model: 'gpt-4o-mini', 
                    messages: messages 
                })
            });
            
            const data = await res.json();
            if(data.error) throw new Error(data.error.message);
            aiResponseText = data.choices[0].message.content;
        }
        
        chatHistory.push({ role: 'assistant', content: aiResponseText });
        
        // "잠시만..." 첫 메시지 제거 (임시 방편)
        const chatBox = document.getElementById('chat-messages');
        const children = chatBox.children;
        for(let i=0; i<children.length; i++) {
            if(children[i].innerText.includes('잠시만 기다려 주시옵소서')) {
                chatBox.removeChild(children[i]);
                break;
            }
        }
        
        appendMessage('assistant', aiResponseText);
        
    } catch(e) {
        console.error("AI API Error:", e);
        appendMessage('assistant', '통촉하시옵소서... 의술서(서버 통신)에 문제가 생겨 진맥을 이어갈 수 없사옵니다. (API 오류가 발생했습니다. 키를 확인해주세요)');
        chatHistory.pop(); // 에러 난 유저 메시지 삭제
    }
}

window.submitFinalDiet = async function() {
    const finalDiet = document.getElementById('final-diet-input').value.trim();
    if(!finalDiet) {
        showAlert('어의와 상담하여 결정한 최종 추천 식단을 적어주시오.');
        return;
    }

    if(teamDocId) {
        await updateDoc(doc(db, "teams", teamDocId), { 
            originalDiet: originalDiet,
            chatHistory: chatHistory,
            finalDiet: finalDiet
        });
    }

    document.getElementById('diet-diagnosis-area').classList.add('hidden');
    document.getElementById('final-farewell').classList.remove('hidden');
}

window.updateBackground = function(sectionId) {
    const bgOverlay = document.querySelector('.bg-overlay');
    if (!bgOverlay) return;
    
    const bgMap = {
        'sec-gate1': '../1관문 배경.png',
        'sec-gate2': '../2관문 배경 이미지.png',
        'sec-gate3': '../3관문 배경 이미지.png',
        'sec-gate4': '../4관문 이미지.png',
        'sec-gate5': '../5관문 이미지.png',
        'sec-gate5_5': '../5관문 이미지.png',
        'sec-gate6': '../6관문 이지미배경.png',
        'sec-ending': '../7관문 이미지.png',
        'sec-final-result': '../7관문 이미지.png'
    };
    
    if (bgMap[sectionId]) {
        bgOverlay.style.background = `url('${bgMap[sectionId]}') center/cover no-repeat fixed`;
    } else {
        bgOverlay.style.background = 'radial-gradient(circle at center, rgba(40,40,40,1) 0%, rgba(10,10,10,1) 100%)';
    }
};

// 다음 관문 이동 유틸리티
window.nextGate = function(gateNum) {
    currentGate = gateNum;
    document.querySelectorAll('section').forEach(sec => {
        sec.classList.remove('active');
        sec.classList.add('hidden');
    });
    
    let nextSec = document.getElementById(`sec-gate${gateNum}`);
    if(!nextSec) nextSec = document.getElementById(`sec-${gateNum}`); // 'ending' 같은 예외 처리
    
    if(nextSec) {
        nextSec.classList.remove('hidden');
        nextSec.classList.add('active');
        window.updateBackground(nextSec.id);
    }
}

// 초기화
console.log("수라간의 비밀 앱 로드 완료");

const introVideo = document.getElementById('intro-video');
const storyLines = [
    { text: "평화롭던 조선의 궁궐, 차기 왕위를 이을 세자 저하께서 원인을 알 수 없는 괴질로 쓰러지셨다." },
    { text: "어의가 백방으로 원인을 찾으려 애썼으나, 병세는 호전되기는커녕 날이 갈수록 악화될 뿐이었다." },
    { text: "궁궐 내에는 누군가 세자 저하를 해하려 한다는 흉흉한 소문이 돌기 시작했고..." },
    { text: "그러던 중, 내의원 한구석에서 어의가 남긴 찢어진 서책과 수상한 약병이 발견된다." },
    { text: "\"세자 저하의 병은 단순한 병이 아니다. 누군가 수라상에 교묘하게 손을 대어 영양을 소실시킨 것이다!\"", style: "color:var(--color-accent-gold);" },
    { text: "이제 당신은 궁중 내의원이 되어, 어의가 남긴 서책의 암호를 풀고 수라간 식단의 비밀을 파헤쳐야 한다." },
    { text: "수라간 최상궁부터 장내시, 의녀 장덕, 심지어 세자빈까지... 모두가 용의선상에 올랐다." },
    { text: "사라진 영양소의 진실을 밝혀내고, 세자 저하를 위기에서 구하라!", style: "color:var(--color-accent-red); font-size: 1.1rem; font-weight: bold; text-align: center;" }
];

function typeWriterEffect(lines, containerId, callback) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';
    let lineIndex = 0;
    let charIndex = 0;
    let currentP = null;

    function typeChar() {
        if (lineIndex < lines.length) {
            if (charIndex === 0) {
                currentP = document.createElement('p');
                currentP.className = "mt-10";
                if (lines[lineIndex].style) {
                    currentP.style.cssText = lines[lineIndex].style;
                }
                container.appendChild(currentP);
                
                if (lines[lineIndex].text.includes("위기에서 구하라!")) {
                    window.playSound('doom'); // 근엄한 배경음
                    window.speakText(lines[lineIndex].text); // 근엄한 기계 음성 읽어주기
                }
            }
            
            currentP.innerHTML += lines[lineIndex].text.charAt(charIndex);
            charIndex++;

            if (charIndex >= lines[lineIndex].text.length) {
                lineIndex++;
                charIndex = 0;
                if (lineIndex < lines.length) {
                    setTimeout(typeChar, 800); // 문장 끝나고 0.8초 대기
                } else {
                    if (callback) callback();
                }
            } else {
                setTimeout(typeChar, 40); // 글자당 0.04초
            }
        }
    }
    typeChar();
}

if (introVideo) {
    introVideo.addEventListener('ended', () => {
        // 영상 컨테이너 숨기기
        const videoContainer = document.querySelector('.video-container');
        if (videoContainer) videoContainer.style.display = 'none';

        const narration = document.getElementById('story-narration');
        if (narration) {
            narration.style.display = 'block';
            narration.scrollIntoView({ behavior: 'smooth' });
            
            // 타이핑 효과 시작
            typeWriterEffect(storyLines, 'typewriter-text', () => {
                // 타이핑이 모두 끝나면 시작 버튼 등장
                const btn = document.getElementById('btn-start-mission');
                if (btn) btn.style.display = 'block';
            });
        }
    });
}

// 모달 및 스토리 제어
window.closePosterAndGoToLogin = function() {
    window.playSound('click');
    const posterModal = document.getElementById('poster-modal');
    posterModal.classList.remove('active');
    posterModal.classList.add('hidden');
    
    const loginSec = document.getElementById('sec-login');
    loginSec.classList.remove('hidden');
    loginSec.classList.add('active');
    
    window.updateBackground('sec-login');
}

// 비밀 스킵 버튼 로직 (선생님용)
window.secretSkip = function() {
    window.playSound('click');
    console.log("Secret skip activated!");
    const posterModal = document.getElementById('poster-modal');
    if (posterModal && posterModal.classList.contains('active')) {
        closePosterAndGoToLogin();
        return;
    }
    
    const activeSec = document.querySelector('section.active') || document.getElementById('sec-story');
    
    if (activeSec) {
        let currentId = activeSec.id;
        
        if (currentId === 'sec-login') {
            document.getElementById('team-name').value = "테스트(스킵)";
            startGame();
        } else if (currentId === 'sec-story') {
            const narration = document.getElementById('story-narration');
            if (narration && narration.style.display === 'block') {
                // 나레이션이 이미 나와있는 상태면 관문 1로 스킵
                nextGate(1);
            } else {
                // 영상 재생 중 스킵하면 영상을 멈추고 나레이션 시작
                const video = document.getElementById('intro-video');
                if(video) video.pause();
                
                const videoContainer = document.querySelector('.video-container');
                if (videoContainer) videoContainer.style.display = 'none';
                
                if (narration) {
                    narration.style.display = 'block';
                    narration.scrollIntoView({ behavior: 'smooth' });
                    
                    // 타이핑 효과 시작
                    typeWriterEffect(storyLines, 'typewriter-text', () => {
                        const btn = document.getElementById('btn-start-mission');
                        if (btn) btn.style.display = 'block';
                    });
                }
            }
        } else if (currentId.startsWith('sec-gate')) {
            let gateNum = parseInt(currentId.replace('sec-gate', ''));
            if (gateNum < 6) {
                nextGate(gateNum + 1);
            } else if (gateNum === 6) {
                activeSec.classList.remove('active');
                activeSec.classList.add('hidden');
                document.getElementById('sec-ending').classList.remove('hidden');
                document.getElementById('sec-ending').classList.add('active');
            }
        } else if (currentId === 'sec-ending') {
            const reportArea = document.getElementById('ending-report-area');
            if (reportArea && reportArea.classList.contains('hidden')) {
                window.playSound('success');
                document.getElementById('ending-code-area').classList.add('hidden');
                document.getElementById('ending-report-area').classList.remove('hidden');
            } else {
                document.getElementById('final-culprit').value = "최상궁";
                declareEnding();
            }
        }
    }
}

// 비밀 뒤로가기 버튼 로직 (선생님용)
window.secretBack = function() {
    window.playSound('click');
    console.log("Secret back activated!");
    
    const posterModal = document.getElementById('poster-modal');
    if (posterModal && posterModal.classList.contains('active')) {
        return; // 첫 화면에서는 뒤로 갈 곳이 없음
    }
    
    const activeSec = document.querySelector('section.active');
    if (!activeSec) return;
    
    let currentId = activeSec.id;
    
    // 현재 화면 숨기기
    activeSec.classList.remove('active');
    activeSec.classList.add('hidden');
    
    let prevSecId = '';
    
    if (currentId === 'sec-login') {
        document.getElementById('poster-modal').classList.remove('hidden');
        document.getElementById('poster-modal').classList.add('active');
        return;
    } else if (currentId === 'sec-story') {
        prevSecId = 'sec-login';
    } else if (currentId === 'sec-gate1') {
        prevSecId = 'sec-story';
    } else if (currentId === 'sec-gate2') {
        prevSecId = 'sec-gate1';
    } else if (currentId === 'sec-gate3') {
        prevSecId = 'sec-gate2';
    } else if (currentId === 'sec-gate4') {
        prevSecId = 'sec-gate3';
    } else if (currentId === 'sec-gate5') {
        prevSecId = 'sec-gate4';
    } else if (currentId === 'sec-gate5_5') {
        prevSecId = 'sec-gate5';
    } else if (currentId === 'sec-gate6') {
        prevSecId = 'sec-gate5_5';
    } else if (currentId === 'sec-ending') {
        prevSecId = 'sec-gate6';
    } else if (currentId === 'sec-final-result') {
        prevSecId = 'sec-ending';
    }
    
    if (prevSecId) {
        document.getElementById(prevSecId).classList.remove('hidden');
        document.getElementById(prevSecId).classList.add('active');
        window.updateBackground(prevSecId);
    }
}

// 자물쇠(Padlock) 로직
window.createPadlock = function(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const digits = parseInt(container.getAttribute('data-digits'));
    container.innerHTML = '';
    
    for (let i = 0; i < digits; i++) {
        const wheel = document.createElement('div');
        wheel.className = 'digit-wheel';
        
        const btnUp = document.createElement('button');
        btnUp.className = 'wheel-btn';
        btnUp.innerHTML = '▲';
        
        const display = document.createElement('div');
        display.className = 'digit-display';
        display.innerText = '0';
        
        const btnDown = document.createElement('button');
        btnDown.className = 'wheel-btn';
        btnDown.innerHTML = '▼';
        
        btnUp.onclick = () => {
            window.playSound('click');
            let val = parseInt(display.innerText);
            display.innerText = val === 9 ? 0 : val + 1;
        };
        
        btnDown.onclick = () => {
            window.playSound('click');
            let val = parseInt(display.innerText);
            display.innerText = val === 0 ? 9 : val - 1;
        };
        
        wheel.appendChild(btnUp);
        wheel.appendChild(display);
        wheel.appendChild(btnDown);
        container.appendChild(wheel);
    }
}

window.getPadlockValue = function(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return '';
    let code = '';
    container.querySelectorAll('.digit-display').forEach(d => {
        code += d.innerText;
    });
    return code;
}

// 자물쇠 UI 초기화
window.createPadlock('g1-padlock');
window.createPadlock('g2-padlock');
window.createPadlock('final-padlock');

