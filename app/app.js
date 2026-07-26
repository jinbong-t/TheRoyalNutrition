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
            video.onended = function() {
                document.getElementById('story-narration').style.display = 'block';
                const introText = "전하의 밀지가 당도했다!<br><br><span style='color:var(--color-accent-gold);'>'세자가 원인 모를 병에 걸렸고, 어의마저 누군가에게 납치되었다. 그대들을 특별 암행어사로 임명하니, 몰래 입궁하여 수라간의 비밀을 파헤쳐라!'</span><br><br>입궁을 위해선 납치된 어의가 궁궐 지도에 몰래 남겨둔 암호를 풀어야만 비밀의 문이 열린다.";
                window.typewriterEffect('typewriter-text', introText, 40, () => {
                    document.getElementById('btn-start-mission').style.display = 'inline-block';
                });
            };
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
                <p>세자 저하가 쓰러진 시각은 유시(酉時, 10번째)였소. 이는 알리바이 대조의 핵심 기준이 될 것이오.</p>
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
    
    // 정답 개수만큼 단서 획득 (최대 5개)
    const clueCount = score;
    
    const clueArea = document.getElementById('clue-cards-area');
    clueArea.innerHTML = '';
    
    document.getElementById('online-quiz-area').style.display = 'none';
    
    if(clueCount === 0) {
        window.playSound('error');
        clueArea.innerHTML = `<div style="text-align:center; padding: 20px;"><p style="color:var(--color-accent-red); font-size:1.2rem; font-weight:bold;">전하께서 크게 노하셨다!</p><p class="mt-10">단 한 문제도 맞히지 못하여 단서를 하나도 얻지 못했다... 오직 직감으로만 범인을 찾아내야 한다!</p></div>`;
    } else {
        window.playSound('success');
        
        const scoreMsg = document.createElement('div');
        scoreMsg.style.cssText = "width:100%; text-align:center; margin-bottom:15px;";
        if(clueCount === 5) {
            scoreMsg.innerHTML = `<p style="font-size:1.3rem; color:var(--color-accent-gold); font-weight:bold;">만점이다! 전하께서 5개의 단서를 모두 하사하셨다!</p>`;
        } else {
            scoreMsg.innerHTML = `<p style="font-size:1.2rem; color:#fff;">5문제 중 ${clueCount}문제를 맞혔다! 단서 ${clueCount}개를 획득했다.</p>`;
        }
        clueArea.appendChild(scoreMsg);
        
        const shuffled = [...clueData].sort(() => 0.5 - Math.random());
        const selectedClues = shuffled.slice(0, clueCount);
        selectedClues.sort((a, b) => a.title.localeCompare(b.title));

        selectedClues.forEach(clue => {
            const cardContainer = document.createElement('div');
            cardContainer.className = 'clue-card-container';
            cardContainer.onclick = function() {
                if(!this.classList.contains('flipped')) {
                    window.playSound('swipe');
                    this.classList.add('flipped');
                }
            };
            
            cardContainer.innerHTML = `
                <div class="clue-card-inner">
                    <div class="clue-card-front">
                        <!-- 뒷면 디자인은 CSS ::after로 처리됨 -->
                    </div>
                    <div class="clue-card-back">
                        <div style="border-bottom:1px solid #555; padding-bottom:5px; margin-bottom:10px; text-align:center; width:100%;">
                            <h4 style="color:var(--color-accent-gold); margin:0; font-size:1.1rem;">${clue.title}</h4>
                            <span style="font-size:0.85rem; color:#ccc;">${clue.subtitle}</span>
                        </div>
                        <p style="font-size:0.95rem; line-height:1.5;">${clue.content}</p>
                    </div>
                </div>
            `;
            clueArea.appendChild(cardContainer);
        });

        // 4명의 용의자 확보 서사 추가
        const narrativeBox = document.createElement('div');
        narrativeBox.style.cssText = "width:100%; margin-top:30px; padding: 20px; background: rgba(138, 28, 28, 0.2); border: 2px solid var(--color-accent-red); border-radius: 8px; text-align:left; box-shadow: 0 0 15px rgba(255, 0, 0, 0.2);";
        narrativeBox.innerHTML = `
            <p style="color:var(--color-accent-gold); font-weight:bold; font-size:1.2rem; margin-bottom:10px;">[ 결정적 증거: 용의자 명단 확보 ]</p>
            <p style="color:#ddd; line-height:1.6; font-size: 1.05rem;">하수인은 벌벌 떨며 단서와 함께 낡은 명단을 하나 꺼내놓았다.</p>
            <p style="color:var(--color-accent-red); font-weight:bold; font-style:italic; font-size:1.2rem; margin:15px 0; padding:10px; border-left: 4px solid var(--color-accent-red); background: rgba(0,0,0,0.5);">"저하의 수라를 직접 챙겼던 자들... <span style="color:#fff;">수라간 최상궁, 장내시, 세자빈, 의녀 장덕</span>... 진범은 이 4명 중에 있습니다!"</p>
            <p style="color:#aaa; font-size: 0.95rem;">(다음 관문에서 이들의 심문 기록과 식단을 분석하여 진범을 가려낼 수 있다.)</p>
        `;
        clueArea.appendChild(narrativeBox);
    }
    
    document.getElementById('btn-to-gate6-wrap').classList.remove('hidden');
}

// ================== 관문 6 로직 ==================
const suspectsData = [
    { name: '최상궁', c: true, d: true, e: true },
    { name: '장내시', c: false, d: false, e: false },
    { name: '세자빈', c: false, d: false, e: false },
    { name: '의녀 장덕', c: false, d: false, e: false } // 돼지고기(수육)지만 고추양념은 아님
];

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
    const char1 = document.getElementById('final-ans1').value.trim().replace(/\s+/g, '');
    const char2 = document.getElementById('final-ans2').value.trim().replace(/\s+/g, '');
    const char3 = document.getElementById('final-ans3').value.trim().replace(/\s+/g, '');
    const reason = document.getElementById('final-reason').value.trim();

    if(!char1 || !char2 || !char3) {
        showAlert('진범의 이름 3글자를 외치시오!');
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

// ============================================================================
// [종막] AI 어의 챗봇 상담 로직
// ============================================================================

let aiChatHistory = [];
const systemPrompt = "너는 조선시대 내의원의 최고 어의다. 다음은 수라간 궁녀(학생)가 어제 하루 먹은 식단 또는 질문이다. 6대 영양소(탄수화물, 단백질, 지방, 비타민, 무기질, 물) 관점에서 무엇이 부족하고 과한지 사극 말투로 호통치듯, 하지만 진심으로 건강을 걱정하며 따뜻하게 조언해 다오. 학생이 너무 심한 장난을 치면 엄하게 꾸짖어라.";

async function callAI(userText) {
    if (!globalAiConfig || !globalAiConfig.apiKey) {
        throw new Error("API 키가 설정되지 않았습니다.");
    }

    const provider = globalAiConfig.provider || 'gemini';
    const apiKey = globalAiConfig.apiKey;

    if (provider === 'gemini') {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
        
        let contents = [];
        for(let msg of aiChatHistory) {
            contents.push({ role: msg.role === 'user' ? 'user' : 'model', parts: [{ text: msg.text }] });
        }
        
        let promptText = userText;
        if(aiChatHistory.length === 0) {
             promptText = `${systemPrompt}\n\n[학생의 식단/질문]: ${userText}`;
        }

        contents.push({ role: 'user', parts: [{ text: promptText }] });

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: contents })
        });
        
        const data = await response.json();
        if (data.error) throw new Error(data.error.message);
        
        const reply = data.candidates[0].content.parts[0].text;
        
        aiChatHistory.push({ role: 'user', text: promptText });
        aiChatHistory.push({ role: 'assistant', text: reply });
        
        return reply;
        
    } else if (provider === 'openai') {
        const url = `https://api.openai.com/v1/chat/completions`;
        
        let messages = [
            { role: "system", content: systemPrompt }
        ];
        
        for(let msg of aiChatHistory) {
            messages.push({ role: msg.role, content: msg.text });
        }
        messages.push({ role: "user", content: userText });

        const response = await fetch(url, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: "gpt-3.5-turbo",
                messages: messages
            })
        });

        const data = await response.json();
        if (data.error) throw new Error(data.error.message);
        
        const reply = data.choices[0].message.content;
        
        aiChatHistory.push({ role: 'user', text: userText });
        aiChatHistory.push({ role: 'assistant', text: reply });
        
        return reply;
    }
}

function appendChatMessage(role, text) {
    const chatContainer = document.getElementById('chat-messages');
    const msgDiv = document.createElement('div');
    msgDiv.style.maxWidth = '80%';
    msgDiv.style.padding = '8px 12px';
    msgDiv.style.borderRadius = '8px';
    msgDiv.style.marginBottom = '5px';
    
    if (role === 'user') {
        msgDiv.style.alignSelf = 'flex-end';
        msgDiv.style.backgroundColor = 'rgba(212,175,55,0.2)';
        msgDiv.style.border = '1px solid var(--color-accent-gold)';
        msgDiv.innerHTML = `<strong>나:</strong> ${text}`;
    } else {
        msgDiv.style.alignSelf = 'flex-start';
        msgDiv.style.backgroundColor = 'rgba(255,255,255,0.1)';
        msgDiv.style.border = '1px solid #777';
        msgDiv.innerHTML = `<strong style="color:var(--color-accent-gold);">어의:</strong> ${text}`;
    }
    
    chatContainer.appendChild(msgDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

window.startAiCounseling = async function() {
    const dietInput = document.getElementById('original-diet-input').value.trim();
    if(!dietInput) {
        showAlert('어제 먹은 식단을 먼저 상세히 적어주시오!');
        return;
    }
    if(!globalAiConfig || !globalAiConfig.apiKey) {
        showAlert('현재 어의가 자리에 없소 (선생님 대시보드에서 AI API 키 설정 필요).');
        return;
    }

    // 초기화
    aiChatHistory = [];
    document.getElementById('chat-messages').innerHTML = '';
    
    // UI 전환
    document.getElementById('ai-chat-area').classList.remove('hidden');
    document.getElementById('original-diet-input').disabled = true;
    document.getElementById('btn-start-counseling').classList.add('hidden');
    
    appendChatMessage('user', dietInput);
    appendChatMessage('assistant', '진맥을 짚고 있소... (어의가 식단을 분석 중입니다)');
    
    try {
        const reply = await callAI(dietInput);
        const chatContainer = document.getElementById('chat-messages');
        chatContainer.removeChild(chatContainer.lastChild);
        
        appendChatMessage('assistant', reply);
        window.playSound('success');
    } catch(err) {
        const chatContainer = document.getElementById('chat-messages');
        chatContainer.removeChild(chatContainer.lastChild);
        appendChatMessage('assistant', `(통신 오류: ${err.message})`);
    }
}

window.sendChatMessage = async function() {
    const inputEl = document.getElementById('chat-input');
    const text = inputEl.value.trim();
    if(!text) return;
    
    inputEl.value = '';
    appendChatMessage('user', text);
    appendChatMessage('assistant', '고민 중이오...');
    
    try {
        const reply = await callAI(text);
        const chatContainer = document.getElementById('chat-messages');
        chatContainer.removeChild(chatContainer.lastChild);
        
        appendChatMessage('assistant', reply);
        window.playSound('click');
    } catch(err) {
        const chatContainer = document.getElementById('chat-messages');
        chatContainer.removeChild(chatContainer.lastChild);
        appendChatMessage('assistant', `(통신 오류: ${err.message})`);
    }
}

window.submitFinalDiet = async function() {
    const finalDiet = document.getElementById('final-diet-input').value.trim();
    if(!finalDiet) {
        showAlert('최종 추천 식단을 적고 제출하시오!');
        return;
    }
    
    const originalDiet = document.getElementById('original-diet-input').value.trim();
    
    try {
        const teamRef = doc(db, 'teams', teamDocId);
        await updateDoc(teamRef, {
            originalDiet: originalDiet,
            finalDiet: finalDiet,
            currentGate: '완료',
            endTime: new Date().toISOString()
        });
        
        document.getElementById('diet-diagnosis-area').classList.add('hidden');
        document.getElementById('final-farewell').classList.remove('hidden');
        window.playSound('doom'); // 웅장한 마무리 소리
        
    } catch(e) {
        console.error(e);
        showAlert('기록 전달에 실패하였소.');
    }
}
