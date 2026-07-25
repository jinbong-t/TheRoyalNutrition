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

// ================== 관문 1 로직 ==================
window.checkGate1 = async function() {
    const q1 = document.getElementById('g1-q1').value.trim();
    const q2 = document.getElementById('g1-q2').value.trim();
    const q3 = document.getElementById('g1-q3').value.trim();
    const code = document.getElementById('g1-code').value.trim();
    
    if(!q1 || !q2 || !q3 || !code) {
        showAlert('모든 빈칸과 추리한 암호를 채우시오.');
        return;
    }
    
    // 정답 체크 (탄수화물, 단백질, 지방)
    if(q1 === '탄수화물' && q2 === '단백질' && q3 === '지방') {
        if(code === '231') {
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

// ================== 관문 2 로직 ==================
window.checkGate2 = async function() {
    const q1 = document.getElementById('g2-q1').value.trim().toLowerCase();
    const q2 = document.getElementById('g2-q2').value.trim().toLowerCase();
    const q3 = document.getElementById('g2-q3').value.trim().toLowerCase();
    const q4 = document.getElementById('g2-q4').value.trim().toLowerCase();
    const code = document.getElementById('g2-code').value.trim();
    
    if(!q1 || !q2 || !q3 || !q4 || !code) {
        showAlert('모든 원소기호와 추리한 암호를 채우시오.');
        return;
    }
    
    // 정답 체크: 칼슘(ca), 인(p), 철(fe), 아연(zn)
    if(q1 === 'ca' && q2 === 'p' && q3 === 'fe' && q4 === 'zn') {
        if(code === '2143') {
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
    closeCompareModal();
    if(teamDocId) await updateDoc(doc(db, "teams", teamDocId), { currentGate: '종막' });
    nextGate('ending');
}

window.arrestSuspect = async function() {
    if(teamDocId) await updateDoc(doc(db, "teams", teamDocId), { currentGate: '종막' });
    nextGate('ending');
}

// ================== 종막 로직 ==================
window.unlockEnding = function() {
    const code = document.getElementById('final-code').value.trim();
    if (code === '2143') {
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

window.submitDietDiagnosis = async function() {
    const resolution = document.getElementById('diet-resolution').value.trim();
    if(!resolution) {
        showAlert('부족한 영양소를 채울 다짐을 한 줄 적어주시오.');
        return;
    }

    const chks = document.querySelectorAll('.diet-chk:checked');
    const checkedItems = Array.from(chks).map(c => c.value);

    if(teamDocId) {
        await updateDoc(doc(db, "teams", teamDocId), { 
            dietChecked: checkedItems,
            dietResolution: resolution
        });
    }

    document.getElementById('diet-diagnosis-area').classList.add('hidden');
    document.getElementById('final-farewell').classList.remove('hidden');
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
    document.getElementById('poster-modal').classList.remove('active');
    document.getElementById('poster-modal').classList.add('hidden');
    
    document.getElementById('sec-login').classList.remove('hidden');
    document.getElementById('sec-login').classList.add('active');
}

// 비밀 스킵 버튼 로직 (선생님용)
window.secretSkip = function() {
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
                document.getElementById('final-code').value = '2143';
                unlockEnding();
            } else {
                document.getElementById('final-culprit').value = "최상궁";
                declareEnding();
            }
        }
    }
}

