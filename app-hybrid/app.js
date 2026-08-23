import { db, auth, collection, doc, setDoc, updateDoc, signInAnonymously, onSnapshot } from './firebase-config.js';

// --- 사운드 이펙트 (Web Audio API) ---
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
window.isMuted = false;

window.toggleMute = function() {
    window.isMuted = !window.isMuted;
    const muteIcon = document.getElementById('mute-icon');
    if (muteIcon) {
        muteIcon.innerText = window.isMuted ? '🔇' : '🔊';
    }
}

window.playSound = function(type) {
    if (window.isMuted) return;
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
    } else if (type === 'swipe') {
        // 카드가 휙 뒤집히는 소리
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, now);
        osc.frequency.exponentialRampToValueAtTime(100, now + 0.15);
        gainNode.gain.setValueAtTime(0, now);
        gainNode.gain.linearRampToValueAtTime(0.3, now + 0.05);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
        osc.start(now);
        osc.stop(now + 0.15);
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

window.typewriterEffect = function(elementId, text, speed = 50, callback = null) {
    const el = document.getElementById(elementId);
    if (!el) return;
    el.innerHTML = '';
    let i = 0;
    
    const typeInterval = setInterval(() => {
        if (i < text.length) {
            let char = text.charAt(i);
            if(char === '<') {
                let tag = '';
                while(text.charAt(i) !== '>' && i < text.length) {
                    tag += text.charAt(i);
                    i++;
                }
                tag += '>';
                el.innerHTML += tag;
            } else {
                el.innerHTML += char;
                if (i % 3 === 0) window.playSound('click');
            }
            i++;
        } else {
            clearInterval(typeInterval);
            el.innerHTML += '<span class="typewriter-cursor"></span>';
            if (callback) callback();
        }
    }, speed);
};

let currentVersion = 'combined'; // 고정 (결합 버전)
let teamName = '';
let teamDocId = ''; 
let currentGate = 0;
let globalAiConfig = null;

// 서버에서 전역 설정 가져오기
const settingsRef = doc(db, 'settings', 'global');
onSnapshot(settingsRef, (docSnap) => {
    if (docSnap.exists()) {
        const data = docSnap.data();
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
    const grade = document.getElementById('team-grade').value.trim();
    const classNum = document.getElementById('team-class').value.trim();
    const nameRaw = document.getElementById('team-name').value.trim();
    
    if (!nameRaw) {
        showAlert('모둠 이름(또는 본인 이름)을 입력해주시오.');
        return;
    }
    
    let combinedName = '';
    if (grade) combinedName += `${grade}학년 `;
    if (classNum) combinedName += `${classNum}반 `;
    combinedName += nameRaw;
    
    teamName = combinedName;
    
    try {
        // 1. Firebase 익명 로그인
        const userCredential = await signInAnonymously(auth);
        const user = userCredential.user;
        
        // 2. Firestore에 모둠 데이터 생성 (팀명을 기반으로 한 고정 ID 사용으로 중복 누적 방지)
        teamDocId = 'team_' + teamName.replace(/\s+/g, '_');
        await setDoc(doc(db, "teams", teamDocId), {
            name: teamName,
            version: currentVersion,
            uid: user.uid,
            currentGate: 1,
            startTime: new Date().toISOString(),
            endTime: null,
            answers: {}
        });
        
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
            video.onended = function() {
                const videoContainer = document.querySelector('.video-container');
                if (videoContainer) videoContainer.style.display = 'none';
                
                document.getElementById('story-narration').style.display = 'block';
                window.typeWriterEffect(storyLines, 'typewriter-text', () => {
                    document.getElementById('btn-start-mission').style.display = 'inline-block';
                });
            };
        }

    } catch (error) {
        console.error("로그인 실패:", error);
        showAlert('오류가 발생했소: ' + error.message);
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
                    <p class="guide-text" style="color:var(--color-accent-gold); font-size:1.1rem; font-weight:bold; margin-top:15px; text-decoration: underline; text-underline-offset: 4px;">이 번호로 1차 금고 자물쇠를 열고 그 안에 있는 '밀지 1'과 '물증 조각 ①'을 획득하시오!</p>
                    <button class="btn-primary mt-10" onclick="nextGate(2)">단서 챙기고 다음 관문으로</button>
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
            padlockArea.classList.add('active');
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
                    <p>밀지를 거꾸로 읽어 2차 봉인 번호 <strong style="white-space: nowrap;">[ ${code} ]</strong>를 정확히 추리했소.</p>
                    <p class="guide-text" style="color:var(--color-accent-gold); font-size:1.1rem; font-weight:bold; margin-top:15px; text-decoration: underline; text-underline-offset: 4px;">이 번호로 2차 금고 자물쇠를 열고 그 안에 있는 '물증 조각 ②'를 획득하시오!</p>
                    <button class="btn-primary mt-10" onclick="nextGate(3)">단서 챙기고 다음 관문으로</button>
                </div>
            `;
            document.getElementById('btn-g2-submit').style.display = 'none';
            
            // Firestore 진행 상황 업데이트
            if(teamDocId) {
                await updateDoc(doc(db, "teams", teamDocId), { currentGate: 3 });
            }
        } else {
            window.g2FailCount = (window.g2FailCount || 0) + 1;
            if(window.g2FailCount >= 1) {
                const hintEl = document.getElementById('g2-padlock-hint');
                const introEl = document.getElementById('g2-padlock-intro');
                if(hintEl) hintEl.style.display = 'block';
                if(introEl) introEl.style.display = 'none';
            }
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
        window.playSound('success');
        document.getElementById('g3-result').innerHTML = `
            <div class="success-box">
                <p>정확한 진단이오!</p>
                <p>진범이 영양소를 고의로 빼앗은 수법을 정확히 파악했소.</p>
                <button class="btn-primary mt-10" onclick="nextGate(4)">다음 관문으로</button>
            </div>
        `;
        document.getElementById('btn-g3-submit').style.display = 'none';
        
        if(teamDocId) await updateDoc(doc(db, "teams", teamDocId), { currentGate: 4 });
    } else {
        showAlert('진단에 오류가 있소. (주의: 몸에 저장되지 않아 매일 먹어야 하는 영양소를 다시 생각해보시오)');
    }
}

// ================== 관문 4 로직 ==================
window.checkGate4 = async function() {
    const ans = document.getElementById('g4-answer').value;
    if(!ans) {
        showAlert('세자 저하가 쓰러진 시각을 선택하시오.');
        return;
    }
    
    if(ans === '유') {
        window.playSound('success');
        document.getElementById('g4-result').innerHTML = `
            <div class="success-box">
                <p>정확하오!</p>
                <p>세자 저하가 쓰러진 시각은 십이지신 중 10번째인 유시(酉時, 17~19시)였소. 이는 알리바이 대조의 핵심 기준이 될 것이오.</p>
                <button class="btn-primary mt-10" onclick="nextGate(5)">다음 관문으로</button>
            </div>
        `;
        document.getElementById('btn-g4-submit').style.display = 'none';
        
        if(teamDocId) await updateDoc(doc(db, "teams", teamDocId), { currentGate: 5 });
    } else {
        showAlert('계산이 틀렸소. 조건(받침 수가 가장 적고 1g당 열량이 가장 높음)을 만족하는 영양소를 찾고, 그 받침 수에서 열량만큼 더해보시오.');
    }
}

// ================== 관문 5 로직 ==================
window.closeG5Modal = function() {
    window.playSound('click');
    document.getElementById('g5-story-modal').classList.remove('active');
    document.getElementById('g5-story-modal').classList.add('hidden');
    document.getElementById('g5-puzzle-area').style.display = 'block';
}

window.checkGate5 = async function() {
    const checkboxes = document.querySelectorAll('input[name="g5-recipe"]:checked');
    const values = Array.from(checkboxes).map(cb => cb.value);
    
    if(values.length !== 3) {
        showAlert('반드시 이로운 처방 3가지를 정확히 선택해야 하오.');
        return;
    }
    
    // 정답: 1, 3, 5
    if(values.includes('1') && values.includes('3') && values.includes('5')) {
        window.playSound('success');
        document.getElementById('g5-result-area').classList.remove('hidden');
        document.getElementById('g5-result-msg').innerHTML = '<span style="font-size: 1.2rem; color: var(--color-accent-gold);"><strong>훌륭한 처방이오, 임시 어의!</strong></span><br><br>산책으로 비타민 D를 합성하고, 견과류로 두뇌를 깨우며, 버섯과 타락죽으로 칼슘을 든든하게 채워 저하의 시큰거리던 뼈마디가 멎고 눈빛이 다시 맑아지셨소.<br><br><span style="color: #aaa;">(급한 불을 껐으니, 이제 지체 없이 진범을 마저 쫓으러 가십시다!)</span>';
        document.getElementById('btn-g5-submit').style.display = 'none';
        document.getElementById('btn-to-gate5_5').classList.remove('hidden');
        
        if(teamDocId) await updateDoc(doc(db, "teams", teamDocId), { currentGate: 5.5 });
    } else {
        showAlert('독이 될 수 있는 처방이 섞여있소! 짠 음식이나 카페인, 운동 부족은 뼈를 삭게 하니 빼시오.');
    }
}

// ================== 관문 5.5 로직 ==================
const clueData = [
    { title: "단서 카드 A", subtitle: "(영양학적 증상)", content: "“세자 저하의 증상(야맹증, 괴혈병, 구루병)은 비타민 A, 비타민 C, 비타민 D, 그리고 칼슘이 장기간 결핍되었을 때 나타나는 현상이다.”" },
    { title: "단서 카드 B", subtitle: "(환경적 요인)", content: "“세자 저하의 안질(눈병) 때문에 저하의 처소는 낮에도 모든 창을 가려 햇빛이 전혀 들지 않는 어두운 상태를 유지했다.”<br><span style='font-size:0.85rem; color:#aaa; display:block; margin-top:5px;'>(힌트: 햇빛을 받지 못하면 몸 안에서 비타민 D가 합성되지 않아 결핍됨)</span>" },
    { title: "단서 카드 C", subtitle: "(피해자의 체질)", content: "“세자 저하는 최근 심한 위장 질환을 앓고 계셔서 매콤한 초피나 고추 같은 매운 음식을 먹으면 위장에 심한 쇼크를 일으키신다.”" },
    { title: "단서 카드 D", subtitle: "(의료 기록)", content: "“저하가 드신 음식물의 위 속 잔여물을 분석한 결과, 영양소가 최종 소화된 산물인 '포도당' 성분이 아주 다량으로 검출되었다.”<br><span style='font-size:0.85rem; color:#aaa; display:block; margin-top:5px;'>(힌트: 다당류 음료인 식혜와 쌀밥의 소화 결과)</span>" },
    { title: "단서 카드 E", subtitle: "(결정적 목격담)", content: "“사건 당일, 세자 저하의 옷자락에서 붉은 고추 양념이 묻은 돼지고기 기름 자국이 발견되었다.”" }
];

window.submitOnlineQuiz = function() {
    const q1 = document.querySelector('input[name="q1"]:checked');
    const q2 = document.querySelector('input[name="q2"]:checked');
    const q3 = document.querySelector('input[name="q3"]:checked');
    const q4 = document.querySelector('input[name="q4"]:checked');
    const q5 = document.querySelector('input[name="q5"]:checked');
    
    if(!q1 || !q2 || !q3 || !q4 || !q5) {
        showAlert('전하의 어명이다! 5문제를 모두 풀거라!');
        return;
    }
    
    let score = 0;
    if(q1.value === 'B') score++;
    if(q2.value === 'B') score++;
    if(q3.value === 'A') score++;
    if(q4.value === 'B') score++;
    if(q5.value === 'A') score++;
    
    if(score === 5) {
        window.playSound('success');
        document.getElementById('online-quiz-area').style.display = 'none';
        
        const piece3Area = document.getElementById('piece3-area');
        if (piece3Area) {
            piece3Area.classList.remove('hidden');
            setTimeout(() => {
                piece3Area.scrollIntoView({behavior: 'smooth', block: 'end'});
            }, 100);
        }
        
    } else {
        window.playSound('error');
        showAlert(`전하께서 노하셨다! ${score}문제만 맞혀서는 단서를 내어줄 수 없느니라! 5문제를 모두 맞히거라!`);
    }
}

window.checkAllCluesFlipped = function() {
    const allCards = document.querySelectorAll('.clue-card-container');
    const flippedCards = document.querySelectorAll('.clue-card-container.flipped');
    if (allCards.length > 0 && allCards.length === flippedCards.length) {
        document.getElementById('btn-to-gate6-wrap').classList.remove('hidden');
        setTimeout(() => {
            document.getElementById('btn-to-gate6-wrap').scrollIntoView({behavior: 'smooth', block: 'end'});
        }, 100);
    }
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

    const countEl = document.getElementById('suspect-count');
    const namesEl = document.getElementById('suspect-names');
    if(countEl) countEl.innerText = filtered.length;
    if(namesEl) namesEl.innerText = filtered.map(s => s.name).join(', ');
    
    // 단서를 하나라도 체크하면 진범 지목 영역 활성화
    const gridArea = document.getElementById('suspect-grid-area');
    if (gridArea) {
        if (chkC || chkD || chkE) {
            gridArea.style.opacity = '1';
            gridArea.style.pointerEvents = 'auto';
        } else {
            gridArea.style.opacity = '0.5';
            gridArea.style.pointerEvents = 'none';
        }
    }
}

window.selectCulprit = function(name) {
    const suspectArea = document.getElementById('suspects-area');
    const msgArea = document.getElementById('suspect-selected-msg');
    
    suspectArea.classList.remove('hidden');

    if(name === '최상궁') {
        window.playSound('doom');
        suspectArea.style.boxShadow = 'inset 0 0 20px rgba(255, 0, 0, 0.5), 0 0 15px rgba(255, 0, 0, 0.8)';
        suspectArea.style.background = 'rgba(50, 0, 0, 0.5)';
        suspectArea.style.border = '1px solid var(--color-accent-red)';
        
        msgArea.innerText = "모든 단서가 가리키는 유일한 진범이다!";
        msgArea.style.color = "var(--color-accent-red)";
        
        if (currentVersion === 'B') {
            document.getElementById('btn-g6-compare').style.display = 'inline-block';
            document.getElementById('btn-g6-arrest').style.display = 'none';
        } else {
            document.getElementById('btn-g6-arrest').style.display = 'inline-block';
            document.getElementById('btn-g6-compare').style.display = 'none';
        }
    } else {
        window.playSound('error');
        suspectArea.style.boxShadow = 'none';
        suspectArea.style.background = 'transparent';
        suspectArea.style.border = 'none';

        msgArea.innerText = "단서와 일치하지 않는 자다. 다시 확인하라.";
        msgArea.style.color = "#ccc";

        document.getElementById('btn-g6-arrest').style.display = 'none';
        document.getElementById('btn-g6-compare').style.display = 'none';
    }
}

window.showDigitalCompare = function() {
    document.getElementById('compare-modal').classList.remove('hidden');
    document.getElementById('compare-modal').classList.add('active');
}

window.openInterrogationModal = function() {
    // 모달 열기
    document.getElementById('interrogation-modal').classList.remove('hidden');
    document.getElementById('interrogation-modal').classList.add('active');
    
    // 소거표(체크박스) 잠금 해제
    document.getElementById('chk-warning-msg').style.display = 'none';
    const checklistArea = document.getElementById('checklist-area');
    checklistArea.style.opacity = '1';
    checklistArea.style.pointerEvents = 'auto';
}

window.closeCompareModal = function() {
    document.getElementById('compare-modal').classList.remove('active');
    document.getElementById('compare-modal').classList.add('hidden');
}

window.confirmArrest = async function() {
    window.playSound('success');
    closeCompareModal();
    if(teamDocId) await updateDoc(doc(db, "teams", teamDocId), { currentGate: 6.5 });
    document.getElementById('piece4-modal').classList.remove('hidden');
    document.getElementById('piece4-modal').classList.add('active');
}

window.arrestSuspect = async function() {
    window.playSound('success');
    if(teamDocId) await updateDoc(doc(db, "teams", teamDocId), { currentGate: 6.5 });
    document.getElementById('piece4-modal').classList.remove('hidden');
    document.getElementById('piece4-modal').classList.add('active');
}

window.goToGate6_5 = function() {
    document.getElementById('piece4-modal').classList.remove('active');
    document.getElementById('piece4-modal').classList.add('hidden');
    nextGate('6_5');
}

window.previewPhoto = function(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            document.getElementById('photo-preview').src = e.target.result;
            document.getElementById('photo-preview-container').classList.remove('hidden');
            document.getElementById('ai-result-area').classList.add('hidden');
            document.getElementById('manual-fallback-area').classList.add('hidden');
        }
        reader.readAsDataURL(file);
    }
}

window.showManualFallback = function() {
    document.getElementById('manual-fallback-area').classList.remove('hidden');
    // 진행 상황 스크롤
    setTimeout(() => {
        document.getElementById('manual-fallback-area').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
}

window.analyzePhoto = async function() {
    const imgEl = document.getElementById('photo-preview');
    if (!imgEl.src) return;
    
    document.getElementById('ai-loading').classList.remove('hidden');
    document.getElementById('ai-result-area').classList.add('hidden');
    document.getElementById('manual-fallback-area').classList.add('hidden');
    
    // Gemini API 호출 로직
    try {
        const docSnap = await getDoc(doc(db, 'settings', 'global'));
        let apiKey = '';
        if (docSnap.exists() && docSnap.data().aiConfig) {
            apiKey = docSnap.data().aiConfig.apiKey;
        }
        
        if (!apiKey) {
            throw new Error("어의의 신통력(API 키)이 부여되지 않았사옵니다.");
        }

        const base64Image = imgEl.src.split(',')[1];
        
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [
                        { text: "사진 속 나무패 조각들에 다음 네 가지 흔적이 모두 보이는지 확인하라. 1. 붉은 고추기름 얼룩 2. 쌀알 또는 엿기름 알갱이 자국 3. 돼지 털이나 비계 흔적 4. '尙宮' 두 글자가 새겨진 낙관(도장). 네 가지가 모두 뚜렷이 보이면 COMPLETE, 하나라도 안 보이거나 불명확하면 INCOMPLETE라고만 답하라. 다른 설명은 덧붙이지 마라." },
                        { inline_data: { mime_type: "image/jpeg", data: base64Image } }
                    ]
                }]
            })
        });

        const data = await response.json();
        const textResponse = data.candidates[0].content.parts[0].text.trim();
        
        document.getElementById('ai-loading').classList.add('hidden');
        document.getElementById('ai-result-area').classList.remove('hidden');
        
        const resultMsg = document.getElementById('ai-result-msg');
        const btnNext = document.getElementById('btn-to-ending');
        
        if (textResponse.includes("COMPLETE")) {
            window.playSound('success');
            resultMsg.innerHTML = '<span style="color:var(--color-accent-gold); font-weight:bold; font-size:1.2rem;">[ 판독 완료: 증거 일치 ]</span><br><br>네 가지 흔적이 모두 완벽히 들어맞소! 진범이 빼도 박도 못할 완벽한 증거요!';
            btnNext.classList.remove('hidden');
        } else {
            throw new Error("일부 조각이 잘 보이지 않거나 흔적이 불명확하오.");
        }
    } catch (error) {
        document.getElementById('ai-loading').classList.add('hidden');
        document.getElementById('manual-fallback-area').classList.remove('hidden');
        console.error(error);
    }
}

window.manualVerifyPass = async function() {
    const chk = document.getElementById('chk-manual-verify');
    if(chk && chk.checked) {
        window.playSound('success');
        nextGate(7);
    } else {
        showAlert('수사관의 명예를 걸고 직접 확인했다면 체크를 먼저 해주시오.');
    }
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
    const char1 = document.getElementById('final-ans1').value.trim().replace(/\s+/g, '');
    const char2 = document.getElementById('final-ans2').value.trim().replace(/\s+/g, '');
    const char3 = document.getElementById('final-ans3').value.trim().replace(/\s+/g, '');
    const reason = document.getElementById('final-reason').value.trim();

    if(!char1 || !char2 || !char3) {
        showAlert('진정한 처방 3글자를 외치시오!');
        return;
    }
    
    const culprit = char1 + char2 + char3;
    
    if(!reason) {
        showAlert('범행 근거를 서술하시오.');
        return;
    }

    if(culprit === '골고루') {
        // 성공
        window.playSound('success');
        document.getElementById('sec-ending').classList.remove('active');
        document.getElementById('sec-ending').classList.add('hidden');
        document.getElementById('sec-final-result').classList.remove('hidden');
        document.getElementById('sec-final-result').classList.add('active');
        
        const endingVideo = document.getElementById('ending-video');
        if(endingVideo) {
            endingVideo.play().catch(e => console.log('Autoplay prevented by browser'));
        }

        if(teamDocId) {
            await updateDoc(doc(db, "teams", teamDocId), { 
                currentGate: '완료',
                endTime: new Date().toISOString(),
                finalReason: reason
            });
        }
    } else {
        showAlert('그자는 진범이 아니오! 붉은 양념이 묻은 도형의 위치를 다시 확인해보시오.');
    }
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
        'sec-gate5_5': '../5. [관문 5.5] 단서를 불태우려던 하수인 심문.png',
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
    if (gateNum === 7) gateNum = 'ending';
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

        if (gateNum === 5) {
            const g5Modal = document.getElementById('g5-story-modal');
            if(g5Modal) {
                g5Modal.classList.remove('hidden');
                g5Modal.classList.add('active');
                document.getElementById('g5-puzzle-area').style.display = 'none';
            }
        }
    }
    
    // 관문 이동 시 인벤토리 상태 업데이트
    window.updateInventory();
}

// 인벤토리 상태 업데이트 로직
window.updateInventory = function() {
    let unlockedCount = 0;
    
    let numGate = parseFloat(String(currentGate).replace('_', '.'));
    if (currentGate === 'ending') numGate = 7;
    if (isNaN(numGate)) numGate = 0;

    // 조각 1 (관문 2 완료 시, 즉 currentGate >= 3)
    if (numGate >= 3) { 
        document.getElementById('inv-p1').classList.remove('hidden'); 
        document.getElementById('inv-q1').style.display = 'none';
        unlockedCount++; 
    }
    // 조각 2 (관문 4 완료 시, 즉 currentGate >= 5)
    if (numGate >= 5) { 
        document.getElementById('inv-p2').classList.remove('hidden'); 
        document.getElementById('inv-q2').style.display = 'none';
        unlockedCount++; 
    }
    // 조각 3 (관문 5 완료 시, 즉 currentGate >= 6)
    if (numGate >= 6) { 
        document.getElementById('inv-p3').classList.remove('hidden'); 
        document.getElementById('inv-q3').style.display = 'none';
        unlockedCount++; 
    }
    // 조각 4 (관문 6 완료 시, 즉 currentGate >= 6.5)
    if (numGate >= 6.5) { 
        document.getElementById('inv-p4').classList.remove('hidden'); 
        document.getElementById('inv-q4').style.display = 'none';
        unlockedCount++; 
    }
    
    const btnInv = document.getElementById('btn-inventory');
    if (btnInv) {
        btnInv.innerText = `🎒 단서 가방 (${unlockedCount}/4)`;
        if (numGate >= 2 && numGate !== 7) {
            btnInv.style.display = 'block';
        } else {
            btnInv.style.display = 'none';
        }
    }
}

window.openInventory = function() {
    document.getElementById('inventory-modal').classList.remove('hidden');
}

window.closeInventory = function() {
    document.getElementById('inventory-modal').classList.add('hidden');
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

window.typeWriterEffect = function(lines, containerId, callback) {
    const container = document.getElementById(containerId);
    if (!container) return;
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
                    window.typeWriterEffect(storyLines, 'typewriter-text', () => {
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

// ============================================================================
// [종막] 다이어트 앱 스타일 식단 분석 로직
// ============================================================================

const foodDB = [
    // --- 밥/면 (주식) ---
    { id: 1, name: "흰 쌀밥", icon: "🍚", category: "밥/면", cal: 300, carbs: 65, protein: 5, fat: 0, vit: 0, min: 1, water: 29 },
    { id: 2, name: "현미밥", icon: "🌾", category: "밥/면", cal: 320, carbs: 60, protein: 7, fat: 2, vit: 10, min: 15, water: 6 },
    { id: 3, name: "보리밥", icon: "🌾", category: "밥/면", cal: 300, carbs: 62, protein: 6, fat: 1, vit: 5, min: 10, water: 16 },
    { id: 4, name: "잡곡밥", icon: "🍱", category: "밥/면", cal: 330, carbs: 60, protein: 8, fat: 2, vit: 15, min: 20, water: 15 },
    { id: 5, name: "팥밥", icon: "🍙", category: "밥/면", cal: 310, carbs: 61, protein: 7, fat: 1, vit: 5, min: 12, water: 14 },
    { id: 6, name: "흑미밥", icon: "🍙", category: "밥/면", cal: 325, carbs: 63, protein: 6, fat: 1, vit: 8, min: 15, water: 12 },
    { id: 7, name: "콩나물밥", icon: "🍲", category: "밥/면", cal: 250, carbs: 45, protein: 10, fat: 3, vit: 20, min: 15, water: 30 },
    { id: 8, name: "비빔밥", icon: "🍛", category: "밥/면", cal: 500, carbs: 65, protein: 15, fat: 12, vit: 40, min: 20, water: 20 },
    { id: 9, name: "김치볶음밥", icon: "🍛", category: "밥/면", cal: 450, carbs: 60, protein: 10, fat: 15, vit: 10, min: 25, water: 15 },
    { id: 10, name: "새우볶음밥", icon: "🍤", category: "밥/면", cal: 480, carbs: 55, protein: 15, fat: 18, vit: 5, min: 15, water: 10 },
    { id: 11, name: "오므라이스", icon: "🍳", category: "밥/면", cal: 520, carbs: 58, protein: 14, fat: 20, vit: 10, min: 10, water: 12 },
    { id: 12, name: "짜장면", icon: "🍜", category: "밥/면", cal: 700, carbs: 100, protein: 15, fat: 20, vit: 5, min: 25, water: 10 },
    { id: 13, name: "짬뽕", icon: "🍜", category: "밥/면", cal: 650, carbs: 80, protein: 25, fat: 15, vit: 15, min: 35, water: 40 },
    { id: 14, name: "잔치국수", icon: "🍜", category: "밥/면", cal: 350, carbs: 60, protein: 10, fat: 3, vit: 5, min: 20, water: 50 },
    { id: 15, name: "비빔국수", icon: "🍝", category: "밥/면", cal: 420, carbs: 70, protein: 12, fat: 8, vit: 10, min: 15, water: 15 },
    { id: 16, name: "냉면", icon: "🍜", category: "밥/면", cal: 400, carbs: 75, protein: 12, fat: 4, vit: 5, min: 10, water: 30 },
    { id: 17, name: "칼국수", icon: "🍜", category: "밥/면", cal: 450, carbs: 70, protein: 15, fat: 5, vit: 5, min: 20, water: 45 },
    { id: 18, name: "수제비", icon: "🍲", category: "밥/면", cal: 430, carbs: 68, protein: 12, fat: 4, vit: 5, min: 15, water: 40 },
    { id: 19, name: "떡국", icon: "🍲", category: "밥/면", cal: 480, carbs: 75, protein: 18, fat: 8, vit: 2, min: 10, water: 45 },
    { id: 20, name: "만두국", icon: "🥟", category: "밥/면", cal: 500, carbs: 60, protein: 20, fat: 15, vit: 5, min: 15, water: 40 },
    { id: 21, name: "카레라이스", icon: "🍛", category: "밥/면", cal: 550, carbs: 70, protein: 12, fat: 15, vit: 15, min: 10, water: 15 },
    { id: 22, name: "돈까스", icon: "🥩", category: "밥/면", cal: 600, carbs: 50, protein: 25, fat: 30, vit: 5, min: 10, water: 5 },
    { id: 23, name: "초밥", icon: "🍣", category: "밥/면", cal: 400, carbs: 60, protein: 25, fat: 5, vit: 5, min: 10, water: 15 },
    { id: 24, name: "김밥", icon: "🍘", category: "밥/면", cal: 450, carbs: 65, protein: 10, fat: 12, vit: 15, min: 10, water: 10 },
    
    // --- 국/탕 ---
    { id: 25, name: "된장찌개", icon: "🥘", category: "국/탕", cal: 150, carbs: 12, protein: 15, fat: 5, vit: 10, min: 35, water: 60 },
    { id: 26, name: "김치찌개", icon: "🥘", category: "국/탕", cal: 200, carbs: 15, protein: 18, fat: 10, vit: 15, min: 40, water: 55 },
    { id: 27, name: "미역국", icon: "🥣", category: "국/탕", cal: 100, carbs: 5, protein: 10, fat: 3, vit: 10, min: 45, water: 70 },
    { id: 28, name: "소고기무국", icon: "🥣", category: "국/탕", cal: 180, carbs: 8, protein: 20, fat: 8, vit: 5, min: 20, water: 65 },
    { id: 29, name: "콩나물국", icon: "🥣", category: "국/탕", cal: 50, carbs: 4, protein: 4, fat: 1, vit: 15, min: 15, water: 80 },
    { id: 30, name: "설렁탕", icon: "🍲", category: "국/탕", cal: 450, carbs: 10, protein: 35, fat: 25, vit: 2, min: 10, water: 70 },
    { id: 31, name: "갈비탕", icon: "🍲", category: "국/탕", cal: 500, carbs: 15, protein: 40, fat: 30, vit: 5, min: 15, water: 65 },
    { id: 32, name: "삼계탕", icon: "🍗", category: "국/탕", cal: 800, carbs: 40, protein: 60, fat: 35, vit: 10, min: 20, water: 60 },
    { id: 33, name: "육개장", icon: "🥘", category: "국/탕", cal: 350, carbs: 20, protein: 30, fat: 15, vit: 15, min: 35, water: 60 },
    { id: 34, name: "부대찌개", icon: "🥘", category: "국/탕", cal: 600, carbs: 40, protein: 30, fat: 35, vit: 10, min: 50, water: 50 },
    { id: 35, name: "청국장", icon: "🥘", category: "국/탕", cal: 180, carbs: 15, protein: 20, fat: 6, vit: 5, min: 30, water: 55 },
    { id: 36, name: "동태탕", icon: "🥘", category: "국/탕", cal: 250, carbs: 10, protein: 35, fat: 5, vit: 10, min: 25, water: 65 },
    { id: 37, name: "어묵탕", icon: "🍢", category: "국/탕", cal: 200, carbs: 15, protein: 12, fat: 8, vit: 2, min: 35, water: 70 },
    { id: 38, name: "순두부찌개", icon: "🥘", category: "국/탕", cal: 220, carbs: 10, protein: 20, fat: 12, vit: 5, min: 20, water: 60 },
    { id: 39, name: "아욱국", icon: "🥣", category: "국/탕", cal: 70, carbs: 8, protein: 5, fat: 1, vit: 25, min: 20, water: 75 },

    // --- 반찬(육류/생선) ---
    { id: 40, name: "제육볶음", icon: "🥓", category: "반찬(육류/생선)", cal: 450, carbs: 15, protein: 25, fat: 35, vit: 10, min: 15, water: 20 },
    { id: 41, name: "불고기", icon: "🥩", category: "반찬(육류/생선)", cal: 350, carbs: 20, protein: 30, fat: 15, vit: 5, min: 15, water: 25 },
    { id: 42, name: "갈비찜", icon: "🍖", category: "반찬(육류/생선)", cal: 600, carbs: 25, protein: 40, fat: 40, vit: 5, min: 20, water: 20 },
    { id: 43, name: "삼겹살구이", icon: "🥓", category: "반찬(육류/생선)", cal: 650, carbs: 0, protein: 35, fat: 60, vit: 0, min: 5, water: 10 },
    { id: 44, name: "수육", icon: "🥩", category: "반찬(육류/생선)", cal: 400, carbs: 0, protein: 40, fat: 25, vit: 2, min: 10, water: 25 },
    { id: 45, name: "닭강정", icon: "🍗", category: "반찬(육류/생선)", cal: 500, carbs: 50, protein: 20, fat: 25, vit: 2, min: 10, water: 10 },
    { id: 46, name: "계란말이", icon: "🥚", category: "반찬(육류/생선)", cal: 150, carbs: 2, protein: 12, fat: 10, vit: 15, min: 10, water: 20 },
    { id: 47, name: "고등어구이", icon: "🐟", category: "반찬(육류/생선)", cal: 250, carbs: 0, protein: 30, fat: 15, vit: 10, min: 15, water: 40 },
    { id: 48, name: "갈치구이", icon: "🐟", category: "반찬(육류/생선)", cal: 220, carbs: 0, protein: 25, fat: 12, vit: 5, min: 10, water: 40 },
    { id: 49, name: "오징어볶음", icon: "🦑", category: "반찬(육류/생선)", cal: 200, carbs: 15, protein: 25, fat: 5, vit: 10, min: 20, water: 30 },
    { id: 50, name: "낙지볶음", icon: "🐙", category: "반찬(육류/생선)", cal: 180, carbs: 12, protein: 22, fat: 3, vit: 15, min: 25, water: 35 },
    { id: 51, name: "새우튀김", icon: "🍤", category: "반찬(육류/생선)", cal: 300, carbs: 25, protein: 15, fat: 18, vit: 2, min: 10, water: 10 },
    { id: 52, name: "장어구이", icon: "🐍", category: "반찬(육류/생선)", cal: 350, carbs: 5, protein: 30, fat: 25, vit: 20, min: 15, water: 20 },
    { id: 53, name: "멸치볶음", icon: "🐟", category: "반찬(육류/생선)", cal: 150, carbs: 10, protein: 15, fat: 5, vit: 5, min: 45, water: 5 },
    { id: 54, name: "두부조림", icon: "🧊", category: "반찬(육류/생선)", cal: 120, carbs: 5, protein: 12, fat: 6, vit: 5, min: 15, water: 40 },
    { id: 55, name: "장조림", icon: "🥩", category: "반찬(육류/생선)", cal: 180, carbs: 10, protein: 25, fat: 5, vit: 2, min: 25, water: 25 },
    { id: 56, name: "메추리알", icon: "🥚", category: "반찬(육류/생선)", cal: 100, carbs: 2, protein: 10, fat: 8, vit: 10, min: 10, water: 15 },
    { id: 57, name: "게장", icon: "🦀", category: "반찬(육류/생선)", cal: 250, carbs: 15, protein: 20, fat: 8, vit: 5, min: 35, water: 20 },
    { id: 58, name: "꼬막무침", icon: "🦪", category: "반찬(육류/생선)", cal: 120, carbs: 8, protein: 18, fat: 2, vit: 5, min: 25, water: 25 },

    // --- 반찬(채소) ---
    { id: 59, name: "배추김치", icon: "🥬", category: "반찬(채소)", cal: 30, carbs: 6, protein: 2, fat: 0, vit: 25, min: 30, water: 30 },
    { id: 60, name: "깍두기", icon: "🟥", category: "반찬(채소)", cal: 40, carbs: 8, protein: 1, fat: 0, vit: 20, min: 25, water: 30 },
    { id: 61, name: "오이소박이", icon: "🥒", category: "반찬(채소)", cal: 35, carbs: 7, protein: 1, fat: 0, vit: 30, min: 20, water: 40 },
    { id: 62, name: "시금치나물", icon: "🥗", category: "반찬(채소)", cal: 50, carbs: 5, protein: 3, fat: 3, vit: 45, min: 30, water: 25 },
    { id: 63, name: "콩나물무침", icon: "🥗", category: "반찬(채소)", cal: 40, carbs: 4, protein: 4, fat: 2, vit: 20, min: 15, water: 35 },
    { id: 64, name: "고사리나물", icon: "🌿", category: "반찬(채소)", cal: 60, carbs: 10, protein: 3, fat: 2, vit: 15, min: 20, water: 20 },
    { id: 65, name: "도라지무침", icon: "🌿", category: "반찬(채소)", cal: 55, carbs: 12, protein: 2, fat: 1, vit: 20, min: 15, water: 25 },
    { id: 66, name: "무생채", icon: "🥗", category: "반찬(채소)", cal: 45, carbs: 10, protein: 1, fat: 1, vit: 25, min: 15, water: 35 },
    { id: 67, name: "애호박볶음", icon: "🥒", category: "반찬(채소)", cal: 60, carbs: 8, protein: 2, fat: 4, vit: 20, min: 10, water: 30 },
    { id: 68, name: "가지볶음", icon: "🍆", category: "반찬(채소)", cal: 70, carbs: 10, protein: 2, fat: 5, vit: 15, min: 10, water: 25 },
    { id: 69, name: "감자조림", icon: "🥔", category: "반찬(채소)", cal: 120, carbs: 25, protein: 3, fat: 2, vit: 10, min: 15, water: 15 },
    { id: 70, name: "연근조림", icon: "🥔", category: "반찬(채소)", cal: 110, carbs: 22, protein: 2, fat: 1, vit: 5, min: 20, water: 15 },
    { id: 71, name: "우엉조림", icon: "🌿", category: "반찬(채소)", cal: 100, carbs: 20, protein: 2, fat: 1, vit: 5, min: 25, water: 10 },
    { id: 72, name: "브로콜리", icon: "🥦", category: "반찬(채소)", cal: 30, carbs: 5, protein: 3, fat: 0, vit: 50, min: 20, water: 30 },
    { id: 73, name: "샐러드", icon: "🥗", category: "반찬(채소)", cal: 80, carbs: 10, protein: 2, fat: 5, vit: 40, min: 15, water: 35 },
    { id: 74, name: "버섯볶음", icon: "🍄", category: "반찬(채소)", cal: 70, carbs: 8, protein: 4, fat: 4, vit: 15, min: 20, water: 25 },
    { id: 75, name: "파전", icon: "🥞", category: "반찬(채소)", cal: 300, carbs: 40, protein: 8, fat: 15, vit: 20, min: 15, water: 15 },
    { id: 76, name: "김", icon: "⬛", category: "반찬(채소)", cal: 20, carbs: 2, protein: 2, fat: 1, vit: 10, min: 30, water: 5 },

    // --- 간식/후식 ---
    { id: 77, name: "사과", icon: "🍎", category: "간식/후식", cal: 100, carbs: 25, protein: 0, fat: 0, vit: 50, min: 10, water: 15 },
    { id: 78, name: "바나나", icon: "🍌", category: "간식/후식", cal: 105, carbs: 27, protein: 1, fat: 0, vit: 20, min: 15, water: 36 },
    { id: 79, name: "귤", icon: "🍊", category: "간식/후식", cal: 40, carbs: 10, protein: 0, fat: 0, vit: 45, min: 5, water: 45 },
    { id: 80, name: "포도", icon: "🍇", category: "간식/후식", cal: 60, carbs: 15, protein: 1, fat: 0, vit: 30, min: 10, water: 40 },
    { id: 81, name: "수박", icon: "🍉", category: "간식/후식", cal: 30, carbs: 8, protein: 1, fat: 0, vit: 25, min: 5, water: 80 },
    { id: 82, name: "딸기", icon: "🍓", category: "간식/후식", cal: 35, carbs: 8, protein: 1, fat: 0, vit: 60, min: 10, water: 50 },
    { id: 83, name: "복숭아", icon: "🍑", category: "간식/후식", cal: 50, carbs: 13, protein: 1, fat: 0, vit: 20, min: 10, water: 45 },
    { id: 84, name: "떡볶이", icon: "🥘", category: "간식/후식", cal: 400, carbs: 80, protein: 10, fat: 5, vit: 10, min: 25, water: 20 },
    { id: 85, name: "순대", icon: "🌭", category: "간식/후식", cal: 300, carbs: 30, protein: 15, fat: 15, vit: 5, min: 20, water: 10 },
    { id: 86, name: "튀김", icon: "🍤", category: "간식/후식", cal: 350, carbs: 40, protein: 5, fat: 25, vit: 2, min: 10, water: 5 },
    { id: 87, name: "핫도그", icon: "🌭", category: "간식/후식", cal: 280, carbs: 30, protein: 10, fat: 15, vit: 0, min: 15, water: 5 },
    { id: 88, name: "호떡", icon: "🥞", category: "간식/후식", cal: 250, carbs: 40, protein: 5, fat: 10, vit: 0, min: 5, water: 5 },
    { id: 89, name: "붕어빵", icon: "🐟", category: "간식/후식", cal: 200, carbs: 35, protein: 4, fat: 5, vit: 0, min: 5, water: 5 },
    { id: 90, name: "아이스크림", icon: "🍦", category: "간식/후식", cal: 200, carbs: 25, protein: 4, fat: 10, vit: 5, min: 10, water: 10 },
    { id: 91, name: "초콜릿", icon: "🍫", category: "간식/후식", cal: 150, carbs: 15, protein: 2, fat: 10, vit: 0, min: 5, water: 0 },
    { id: 92, name: "과자", icon: "🍪", category: "간식/후식", cal: 200, carbs: 30, protein: 2, fat: 10, vit: 0, min: 5, water: 0 },
    { id: 93, name: "빵", icon: "🍞", category: "간식/후식", cal: 250, carbs: 40, protein: 8, fat: 5, vit: 2, min: 10, water: 10 },
    { id: 94, name: "케이크", icon: "🍰", category: "간식/후식", cal: 350, carbs: 45, protein: 5, fat: 20, vit: 5, min: 10, water: 5 },
    { id: 95, name: "우유", icon: "🥛", category: "간식/후식", cal: 120, carbs: 10, protein: 8, fat: 7, vit: 10, min: 30, water: 35 },
    { id: 96, name: "식혜", icon: "🥤", category: "간식/후식", cal: 150, carbs: 35, protein: 1, fat: 0, vit: 2, min: 5, water: 60 },
    { id: 97, name: "수정과", icon: "🍵", category: "간식/후식", cal: 140, carbs: 35, protein: 0, fat: 0, vit: 5, min: 5, water: 60 },
    { id: 98, name: "아메리카노", icon: "☕", category: "간식/후식", cal: 10, carbs: 2, protein: 0, fat: 0, vit: 0, min: 5, water: 90 },
    { id: 99, name: "콜라", icon: "🥤", category: "간식/후식", cal: 150, carbs: 38, protein: 0, fat: 0, vit: 0, min: 5, water: 50 },
    { id: 100, name: "오렌지주스", icon: "🧃", category: "간식/후식", cal: 120, carbs: 28, protein: 1, fat: 0, vit: 40, min: 10, water: 60 },
    { id: 101, name: "녹차", icon: "🍵", category: "간식/후식", cal: 5, carbs: 1, protein: 0, fat: 0, vit: 10, min: 5, water: 95 },
    { id: 102, name: "마카롱", icon: "🍔", category: "간식/후식", cal: 150, carbs: 20, protein: 2, fat: 8, vit: 0, min: 5, water: 5 },
    { id: 103, name: "탕후루", icon: "🍡", category: "간식/후식", cal: 250, carbs: 60, protein: 0, fat: 0, vit: 15, min: 5, water: 35 },
    { id: 104, name: "약과", icon: "🍩", category: "간식/후식", cal: 180, carbs: 25, protein: 2, fat: 8, vit: 0, min: 2, water: 5 }
];

// 2022 (2020 개정) 한국인 영양소 섭취기준 (12~14세 청소년 1끼 기준, 1/3)
const TARGET_NUTRITION_M = {
    cal: 833,     // 하루 2500kcal / 3
    carbs: 115,   // 약 55%
    protein: 20,  // 하루 55g / 3
    fat: 23,      // 약 25%
    vit: 100,
    min: 100,
    water: 100
};

const TARGET_NUTRITION_F = {
    cal: 667,     // 하루 2000kcal / 3
    carbs: 90,
    protein: 17,  // 하루 50g / 3
    fat: 18,
    vit: 100,
    min: 100,
    water: 100
};

let currentGender = 'M'; // 기본값 남학생

window.setGender = function(gender) {
    currentGender = gender;
    document.getElementById('btn-gender-m').classList.toggle('active', gender === 'M');
    document.getElementById('btn-gender-f').classList.toggle('active', gender === 'F');
    
    // 목표가 변경되었으므로 현재 담은 식판의 퍼센트 재계산
    window.updateTrayUI();
}

function getTargetNutrition() {
    return currentGender === 'M' ? TARGET_NUTRITION_M : TARGET_NUTRITION_F;
}

let myTray = [];

let currentFoodCategory = '전체';

// 앱 초기화시 한 번 호출되도록 설계
window.renderFoodList = function() {
    const container = document.getElementById('food-grid');
    if(!container) return;
    container.innerHTML = '';
    
    const filteredDB = currentFoodCategory === '전체' 
        ? foodDB 
        : foodDB.filter(food => food.category === currentFoodCategory);
    
    filteredDB.forEach(food => {
        const btn = document.createElement('div');
        btn.className = 'food-item';
        btn.innerHTML = `<div class="food-icon">${food.icon}</div><div class="food-name">${food.name}</div><div class="food-cal">${food.cal}kcal</div>`;
        btn.onclick = () => {
            window.playSound('click');
            window.addFoodToTray(food);
        };
        container.appendChild(btn);
    });
}

// 카테고리 필터 기능
window.filterFood = function(category) {
    currentFoodCategory = category;
    
    // 버튼 활성화 스타일 변경
    const buttons = document.querySelectorAll('.btn-category');
    buttons.forEach(btn => {
        if(btn.innerText.includes(category) || (category === '전체' && btn.innerText === '전체')) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
    
    window.renderFoodList();
}

window.addFoodToTray = function(food) {
    if (myTray.length >= 12) {
        showAlert('수라상에 더 이상 올릴 자리가 없사옵니다! (최대 12개)');
        return;
    }
    myTray.push(food);
    window.updateTrayUI();
}

window.removeFoodFromTray = function(index) {
    window.playSound('swipe');
    myTray.splice(index, 1);
    window.updateTrayUI();
}

window.updateTrayUI = function() {
    // 1. 식판 렌더링
    const trayEl = document.getElementById('my-tray-list');
    if(!trayEl) return;
    trayEl.innerHTML = '';
    
    let total = { cal: 0, carbs: 0, protein: 0, fat: 0, vit: 0, min: 0, water: 0 };
    
    myTray.forEach((food, index) => {
        const item = document.createElement('div');
        item.className = 'tray-item';
        item.innerHTML = `<span>${food.icon} ${food.name}</span> <span class="remove-btn" onclick="removeFoodFromTray(${index})">❌</span>`;
        trayEl.appendChild(item);
        
        total.cal += food.cal;
        total.carbs += food.carbs;
        total.protein += food.protein;
        total.fat += food.fat;
        total.vit += food.vit;
        total.min += food.min;
        total.water += food.water;
    });
    
    if(myTray.length === 0) {
        trayEl.innerHTML = '<div style="color:#aaa; font-style:italic; padding:10px;">수라상이 비어있습니다. 음식을 클릭해 담아주세요.</div>';
    }

    // 2. 게이지 바 업데이트
    const updateBar = (id, current, target) => {
        const percent = Math.min(150, Math.round((current / target) * 100)); // 최대 150% 까지만 게이지 표시
        const bar = document.getElementById(`bar-${id}`);
        const text = document.getElementById(`text-${id}`);
        if(bar) bar.style.width = Math.min(100, percent) + '%';
        if(text) text.innerText = `${percent}%`;
        
        // 색상 변경 로직 (절대 색상값 사용으로 캐시 문제 원천 차단)
        const COLOR_RED = '#ff5252';
        const COLOR_GREEN = '#4caf50';
        const COLOR_ORANGE = '#ff9800';

        if (id === 'cal') {
            if (percent > 120) bar.style.backgroundColor = COLOR_RED;
            else if (percent >= 80) bar.style.backgroundColor = COLOR_GREEN;
            else bar.style.backgroundColor = COLOR_ORANGE;
        } else {
            if (percent > 150) bar.style.backgroundColor = COLOR_RED; // 과다
            else if (percent >= 70) bar.style.backgroundColor = COLOR_GREEN; // 충분
            else bar.style.backgroundColor = COLOR_ORANGE; // 부족
        }
        return percent;
    };

    const target = getTargetNutrition();

    const pCal = updateBar('cal', total.cal, target.cal);
    const pCarbs = updateBar('carbs', total.carbs, target.carbs);
    const pProtein = updateBar('protein', total.protein, target.protein);
    const pFat = updateBar('fat', total.fat, target.fat);
    const pVit = updateBar('vit', total.vit, target.vit);
    const pMin = updateBar('min', total.min, target.min);
    const pWater = updateBar('water', total.water, target.water);

    // 3. 어의 피드백 (AI 시뮬레이션 평가)
    const feedbackEl = document.getElementById('diet-feedback-text');
    let feedback = "";
    let isPerfect = false;

    if (myTray.length === 0) {
        feedback = "전하, 수라상에 올릴 음식을 골라주시옵소서.";
    } else if (pCal > 130) {
        feedback = "이놈! 칼로리가 폭발 직전이옵니다! 옥체가 둥글게 변하실까 염려되오니 음식을 조금 덜어내시옵소서!";
    } else if (pCal < 40 && myTray.length >= 3) {
        feedback = "전하, 이리 적게 드시고 어찌 정무를 돌보시려 하십니까? 고기나 밥을 더 챙겨 드시옵소서.";
    } else if (pFat > 140 || pCarbs > 150) {
        feedback = "기름지거나 단 음식이 너무 많사옵니다. 피가 끈적해지고 혈관이 막히실까 심히 우려되옵니다!";
    } else if (pVit < 50) {
        feedback = "수라에 채소와 과일이 턱없이 부족하옵니다. 이대로면 잇몸에 피가 나는 괴혈병에 걸리시옵니다. 나물이나 과일을 더 올리라 명하소서!";
    } else if (pMin < 50) {
        feedback = "뼈를 튼튼하게 할 무기질(칼슘 등)이 부족하옵니다. 우유나 뼈째 먹는 생선, 콩나물국 등을 더 찾아보시옵소서.";
    } else if (pProtein < 50) {
        feedback = "기력이 쇠하시옵니다. 근육과 피가 될 고기나 생선, 두부 반찬을 어서 더 얹으시옵소서!";
    } else if (pWater < 50) {
        feedback = "수분이 부족하여 옥체에 열이 오를 수 있사옵니다. 국물이나 시원한 과일, 마실 것을 더 추가하심이 옳사옵니다.";
    } else if (pCal >= 70 && pCal <= 120 && pCarbs >= 70 && pProtein >= 70 && pFat <= 120 && pVit >= 70 && pMin >= 70 && pWater >= 70) {
        if (myTray.length >= 7) {
            feedback = "오오! 6대 영양소가 완벽하게 조화를 이룬 훌륭한 12첩 수라상이옵니다! 당장 전하께 이 수라를 올리시옵소서!";
            isPerfect = true;
        } else {
            feedback = "영양소는 훌륭하나, 가짓수가 적어 수라상이 다소 휑해 보이옵니다. 음식을 몇 가지 더 추가하여 풍성하게 채워주시옵소서.";
        }
    } else {
        feedback = "음... 영양소가 꽤 차올랐으나 아직 2% 부족하옵니다. 6가지 게이지를 모두 70% 이상의 '초록색'으로 만들어 보시옵소서!";
    }

    if(feedbackEl) feedbackEl.innerText = feedback;
    
    // 4. 제출 버튼 활성화
    const submitBtn = document.getElementById('btn-submit-diet');
    if (submitBtn) {
        if (isPerfect) {
            submitBtn.disabled = false;
            submitBtn.classList.remove('disabled-btn');
            submitBtn.style.animation = "pulse 1s infinite";
        } else {
            submitBtn.disabled = true;
            submitBtn.classList.add('disabled-btn');
            submitBtn.style.animation = "none";
        }
    }
}

window.submitDietApp = async function() {
    if (myTray.length === 0) return;
    
    const foodNames = myTray.map(f => f.name).join(', ');
    const totalCal = myTray.reduce((sum, f) => sum + f.cal, 0);
    const finalDietStr = `[영양 만점 수라상] ${foodNames} (총 ${totalCal}kcal)`;
    
    try {
        const teamRef = doc(db, 'teams', teamDocId);
        await updateDoc(teamRef, {
            originalDiet: '다이어트 앱 모드로 대체됨',
            finalDiet: finalDietStr,
            currentGate: '완료',
            endTime: new Date().toISOString()
        });
        
        document.getElementById('diet-app-area').classList.add('hidden');
        document.getElementById('final-farewell').classList.remove('hidden');
        
        // 팝업 임명장 띄우기
        const teamNameText = window.teamName || '수사관';
        document.getElementById('plaque-team-name').innerText = teamNameText;
        document.getElementById('appointment-modal').classList.remove('hidden');
        document.getElementById('appointment-modal').classList.add('active');
        
        window.playSound('doom'); // 종료 소리
        setTimeout(() => window.playSound('success'), 800); // 도장 찍힐 때 소리
        
    } catch(e) {
        console.error(e);
        showAlert('기록 전달에 실패하였소.');
    }
}

// 초기 다이어트 앱 UI 렌더링
window.renderFoodList();
window.updateTrayUI();

window.goToDietApp = function() {
    // 현재 활성화된 모든 섹션(화면) 숨기기
    const activeSecs = document.querySelectorAll('section:not(.hidden)');
    activeSecs.forEach(sec => {
        sec.classList.add('hidden');
        sec.classList.remove('active');
    });
    
    // 수라상 섹션 표시
    document.getElementById('sec-diet-app').classList.remove('hidden');
    document.getElementById('sec-diet-app').classList.add('active');
    
    // 영상이 재생 중이라면 정지
    const video = document.getElementById('ending-video');
    if(video) {
        video.pause();
    }
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// 최종 시각 입력 확인
window.checkFinalTime = function(val) {
    if (val.trim() === '유시' || val.trim() === '유시(酉時)') {
        window.playSound('success');
        
        // 입력창 숨기고 정답 텍스트 보이기
        document.getElementById('final-time-input').style.display = 'none';
        document.getElementById('final-time-text').style.display = 'block';
        
        // 출입 시각 박스 빨간색 테두리로 변경
        document.getElementById('final-time-box').style.border = '1px solid var(--color-accent-red)';
        
        // 출입 기록부 목록에서 최상궁 행 빨간색으로 강조
        const choiLog = document.getElementById('suspect-choi-log');
        if (choiLog) {
            choiLog.style.background = 'rgba(200, 0, 0, 0.15)';
            choiLog.style.borderLeft = '3px solid maroon';
            choiLog.style.paddingLeft = '8px';
            choiLog.style.fontWeight = 'bold';
            choiLog.style.transition = 'all 0.5s ease';
        }
        
        // 검거 확정 버튼과 메시지 표시
        document.getElementById('arrest-msg').style.display = 'block';
        document.getElementById('btn-confirm-arrest').style.display = 'block';
    }
}

// 임명장 모달 닫기
window.closeAppointmentModal = function() {
    document.getElementById('appointment-modal').classList.remove('active');
    document.getElementById('appointment-modal').classList.add('hidden');
}
