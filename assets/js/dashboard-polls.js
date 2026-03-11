import { supabase } from "./supabaseClient.js";
import { checkAuth } from "./auth.js";

let pollQueue = [];
let currentPollIndex = -1;
let currentProfile = null;
let answeredPolls = new Set();
let userAnswers = {}; // { pollId: response }
let pollSettings = {
    welcome: { enabled: false, text: '' },
    thank_you: { enabled: false, text: '' }
};

document.addEventListener('DOMContentLoaded', async () => {
    const auth = await checkAuth();
    if (!auth) return;

    currentProfile = auth.profile;
    await initDashboardPolls(auth.profile);
});

async function initDashboardPolls(profile) {
    if (!profile) return;

    // 1. Fetch Active & Published Polls
    const { data: polls, error: pollsError } = await supabase
        .from('polls')
        .select('*')
        .eq('is_active', true)
        .lte('publish_date', new Date().toISOString())
        .or(`end_date.gt.${new Date().toISOString()},end_date.is.null`)
        .order('created_at', { ascending: true });

    if (pollsError || !polls || polls.length === 0) return;

    // 2. Fetch Poll Settings
    const { data: config } = await supabase
        .from('app_configs')
        .select('value')
        .eq('key', 'poll_settings')
        .maybeSingle();

    if (config?.value) pollSettings = config.value;

    // 3. Filter by Target Audience
    const targetPolls = polls.filter(poll => {
        const userYear = profile.academic_year;
        const matchesYear = poll.target_year === 'all' || poll.target_year === userYear;
        const matchesDept = poll.target_department === 'all' || poll.target_department === profile.department;
        return matchesYear && matchesDept;
    });

    if (targetPolls.length === 0) return;

    // 4. Check for already voted polls
    const { data: responses, error: resError } = await supabase
        .from('poll_responses')
        .select('poll_id')
        .eq('user_id', profile.id);

    if (resError) return;

    const votedPollIds = new Set(responses.map(r => r.poll_id));

    // Track answers even for already voted polls (in case user returns via history/nav)
    responses.forEach(r => {
        answeredPolls.add(r.poll_id);
        userAnswers[r.poll_id] = r.response;
    });

    pollQueue = targetPolls.filter(poll => !votedPollIds.has(poll.id));

    if (pollQueue.length === 0) return;

    // 5. Start Flow
    if (pollSettings.welcome?.enabled) {
        currentPollIndex = -1;
        renderPollMessage('welcome');
    } else {
        currentPollIndex = 0;
        renderPollModal(pollQueue[currentPollIndex]);
    }
}

function renderPollMessage(type) {
    let modal = document.getElementById('poll-modal-overlay');
    if (!modal) {
        modal = createOverlay();
    }

    const config = type === 'welcome' ? pollSettings.welcome : pollSettings.thank_you;
    const icon = type === 'welcome' ? '✨' : '💖';

    modal.innerHTML = `
        <div class="poll-modal-card" style="animation: slideUp 0.6s cubic-bezier(0.34, 1.56, 0.64, 1); text-align: center; border: 1px solid #f1f5f9; padding: 1.75rem;">
            <div style="font-size: 2.5rem; margin-bottom: 1.25rem; filter: drop-shadow(0 5px 10px rgba(0,0,0,0.05));">${icon}</div>
            <h2 class="poll-modal-question" style="margin-bottom: 1.75rem; white-space: pre-wrap; color: #0f172a; font-size: 1.4rem; letter-spacing: -0.01em; line-height: 1.35;">${config.text || (type === 'welcome' ? 'أهلاً بك' : 'شكراً لك')}</h2>
            
            <button class="btn btn-primary" onclick="${type === 'welcome' ? 'nextPoll()' : 'finishPollFlow()'}" 
                style="width: 100%; height: 44px; border-radius: 12px; font-weight: 800; font-size: 1.05rem; background: linear-gradient(135deg, #03A9F4 0%, #0288d1 100%); border: none; color: #fff; margin-bottom: 1rem; box-shadow: 0 4px 12px -2px rgba(3, 169, 244, 0.3); cursor: pointer; transition: all 0.2s ease;">
                ${type === 'welcome' ? 'ابدأ الاستفتاء' : 'ماشي'}
            </button>

            ${type === 'thank_you' ? `
                <div style="display: flex; justify-content: center; margin-bottom: 0.25rem;">
                    <button class="nav-arrow-btn-ghost" onclick="prevPoll()" title="رجوع" style="width: 44px; height: 44px; font-size: 1rem;">
                        <i class="fas fa-arrow-left"></i>
                    </button>
                </div>
            ` : ''}

            <div class="poll-modal-footer">
                <img src="assets/images/logo-icon.webp" style="height: 30px; opacity: 0.5;">
                <span>ثانوية.كوم</span>
            </div>
        </div>
    `;
    injectPollModalStyles();
}

function createOverlay() {
    const modal = document.createElement('div');
    modal.id = 'poll-modal-overlay';
    modal.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(15, 23, 42, 0.85); backdrop-filter: blur(12px);
        z-index: 10000; display: flex; align-items: center; justify-content: center;
        padding: 20px; animation: fadeIn 0.4s ease;
    `;
    document.body.appendChild(modal);
    document.body.style.overflow = 'hidden';
    return modal;
}

window.closePollOverlay = () => {
    const overlay = document.getElementById('poll-modal-overlay');
    if (overlay) {
        overlay.style.animation = 'fadeOutDown 0.6s ease forwards';
        setTimeout(() => {
            overlay.remove();
            document.body.style.overflow = '';
        }, 600);
    }
};

window.finishPollFlow = () => {
    // Check if any required poll is unanswered
    const unansweredRequiredIndex = pollQueue.findIndex((p, idx) => p.is_required !== false && !answeredPolls.has(p.id));

    if (unansweredRequiredIndex !== -1) {
        showPollNotification('بعد إذنك جاوب على الاستفتاءات ⚠️');
        currentPollIndex = unansweredRequiredIndex;
        // Small delay to let user see notification before modal content changes
        setTimeout(() => {
            renderPollModal(pollQueue[currentPollIndex]);
        }, 1200);
        return;
    }

    closePollOverlay();
};

function showPollNotification(msg) {
    let notify = document.getElementById('poll-top-notify');
    if (!notify) {
        notify = document.createElement('div');
        notify.id = 'poll-top-notify';
        notify.style.cssText = `
            position: fixed; top: -100px; left: 50%; transform: translateX(-50%);
            background: #ef4444; color: white; padding: 15px 30px;
            border-radius: 0 0 20px 20px; font-weight: 800; z-index: 11000;
            box-shadow: 0 10px 15px -3px rgba(0,0,0,0.2); transition: all 0.5s ease;
            font-size: 1.1rem; text-align: center; width: 90%; max-width: 400px;
            direction: rtl;
        `;
        document.body.appendChild(notify);
    }
    notify.innerText = msg;
    notify.style.top = '0';
    setTimeout(() => { notify.style.top = '-100px'; }, 3000);
}

window.nextPoll = () => {
    currentPollIndex++;
    if (currentPollIndex < pollQueue.length) {
        renderPollModal(pollQueue[currentPollIndex]);
    } else {
        // Final check for mandatory polls before showing end screen
        const unansweredRequiredIndex = pollQueue.findIndex((p, idx) => p.is_required !== false && !answeredPolls.has(p.id));
        if (unansweredRequiredIndex !== -1) {
            showPollNotification('بعد إذنك جاوب على الاستفتاءات ⚠️');
            currentPollIndex = unansweredRequiredIndex;
            setTimeout(() => {
                renderPollModal(pollQueue[currentPollIndex]);
            }, 500);
            return;
        }

        if (pollSettings.thank_you?.enabled) {
            currentPollIndex = pollQueue.length;
            renderPollMessage('thank_you');
        } else {
            finishPollFlow();
        }
    }
};

window.prevPoll = () => {
    if (currentPollIndex > 0) {
        currentPollIndex--;
        renderPollModal(pollQueue[currentPollIndex]);
    } else if (currentPollIndex === 0 && pollSettings.welcome?.enabled) {
        currentPollIndex = -1;
        renderPollMessage('welcome');
    }
};

function renderPollModal(poll) {
    let modal = document.getElementById('poll-modal-overlay');
    if (!modal) modal = createOverlay();

    const progress = `${currentPollIndex + 1} من ${pollQueue.length}`;

    let optionsHtml = '';
    const existingAnswer = userAnswers[poll.id];

    if (poll.type === 'choice') {
        optionsHtml = `
            <div style="display: flex; flex-direction: column; gap: 12px; margin-top: 1.5rem;">
                ${poll.options.map((opt, index) => {
            const isSelected = existingAnswer === String(index);
            return `
                    <button class="poll-modal-option ${isSelected ? 'selected' : ''}" onclick="handlePollSubmit('${poll.id}', '${index}')">
                        <span class="option-text">${opt}</span>
                        <i class="fas ${isSelected ? 'fa-check-circle' : 'fa-chevron-left'}"></i>
                    </button>
                `;
        }).join('')}
            </div>
        `;
    } else {
        optionsHtml = `
            <div style="display: flex; gap: 8px; justify-content: center; margin-top: 1.5rem; flex-direction: row-reverse; align-items: flex-end; flex-wrap: wrap;">
                ${[5, 4, 3, 2, 1].map(star => {
            const emojis = {
                1: { e: '😡', c: '#ef4444', bg: '#fee2e2' },
                2: { e: '☹️', c: '#f97316', bg: '#ffedd5' },
                3: { e: '😐', c: '#848d95', bg: '#f1f5f9' },
                4: { e: '🙂', c: '#0ea5e9', bg: '#e0f2fe' },
                5: { e: '😍', c: '#10b981', bg: '#d1fae5' }
            };
            const config = emojis[star];
            const isSelected = existingAnswer === String(star);
            return `
                    <div style="display: flex; flex-direction: column; align-items: center; gap: 6px;">
                        <span style="font-size: 0.85rem; font-weight: 800; color: ${config.c}; background: ${config.bg}; width: 26px; height: 26px; display: flex; align-items: center; justify-content: center; border-radius: 50%; border: ${isSelected ? '1.5px solid ' + config.c : 'none'}; box-shadow: ${isSelected ? '0 0 8px ' + config.c + '44' : 'none'};">${config.e}</span>
                        <div style="position: relative; cursor: pointer;" onclick="handlePollSubmit('${poll.id}', '${star}')">
                            <i class="fas fa-star modal-poll-star ${isSelected ? 'active' : ''}" data-value="${star}" style="font-size: 2rem; color: ${isSelected ? '#f59e0b' : '#f1f5f9'};"></i>
                            <span style="position: absolute; top: 52%; left: 50%; transform: translate(-50%, -50%); font-size: 0.7rem; font-weight: 900; color: ${isSelected ? '#fff' : '#334155'}; pointer-events: none; text-shadow: 0 0 2px #fff;">${star}</span>
                        </div>
                    </div>
                `;
        }).join('')}
            </div>
        `;
    }

    modal.innerHTML = `
        <div class="poll-modal-card" style="animation: slideUp 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);">
            <div class="poll-modal-header">
                <div class="poll-badge">إستفتاء سريع ✨</div>
                <div class="poll-progress">${progress}</div>
            </div>
            
            <h2 class="poll-modal-question">${poll.question}</h2>
            
            <div id="poll-content-area-modal">
                ${optionsHtml}
            </div>

            <div style="display: flex; justify-content: center; gap: 15px; margin-top: 1.25rem;">
                <button class="nav-arrow-btn" onclick="nextPoll()" title="التالي" style="width: 44px; height: 44px; font-size: 1rem;">
                    <i class="fas fa-arrow-right"></i>
                </button>
                <button class="nav-arrow-btn" onclick="prevPoll()" title="السابق" style="width: 44px; height: 44px; font-size: 1rem;">
                    <i class="fas fa-arrow-left"></i>
                </button>
            </div>

            <div class="poll-modal-footer">
                <img src="assets/images/logo-icon.webp" style="height: 30px; opacity: 0.5;">
                <span>ثانوية.كوم</span>
            </div>
        </div>
    `;

    injectPollModalStyles();
}

function injectPollModalStyles() {
    if (document.getElementById('poll-modal-styles')) return;

    const style = document.createElement('style');
    style.id = 'poll-modal-styles';
    style.innerHTML = `
        .poll-modal-card {
            background: white;
            width: 100%;
            max-width: 480px;
            max-height: 85vh;
            border-radius: 28px;
            padding: 2rem;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
            position: relative;
            border: 1px solid rgba(255, 255, 255, 0.2);
            display: flex;
            flex-direction: column;
        }
        .poll-modal-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 1.25rem;
            flex-shrink: 0;
        }
        .poll-badge {
            background: #e0f2fe;
            color: #03A9F4;
            padding: 6px 16px;
            border-radius: 50px;
            font-size: 0.8rem;
            font-weight: 900;
        }
        .poll-progress {
            color: #94a3b8;
            font-weight: 800;
            font-size: 0.85rem;
        }
        .poll-modal-question {
            color: #0f172a;
            font-size: 1.35rem;
            font-weight: 900;
            line-height: 1.4;
            margin: 0 0 1.25rem;
            text-align: center;
            flex-shrink: 0;
        }
        #poll-content-area-modal {
            overflow-y: auto;
            flex: 1;
            padding-right: 5px;
            margin: 0 -5px;
        }
        #poll-content-area-modal::-webkit-scrollbar {
            width: 6px;
        }
        #poll-content-area-modal::-webkit-scrollbar-track {
            background: transparent;
        }
        #poll-content-area-modal::-webkit-scrollbar-thumb {
            background: #e2e8f0;
            border-radius: 10px;
        }
        #poll-content-area-modal::-webkit-scrollbar-thumb:hover {
            background: #cbd5e1;
        }
        
        .poll-modal-option {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 15px 20px;
            background: #f8fafc;
            border: 2px solid #f1f5f9;
            border-radius: 18px;
            cursor: pointer;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            text-align: right;
            width: 100%;
            outline: none;
            margin-bottom: 8px;
        }
        .poll-modal-option:hover {
            background: #e0f2fe;
            border-color: #03A9F4;
            transform: translateY(-2px);
            box-shadow: 0 10px 15px -3px rgba(3, 169, 244, 0.1);
        }
        .poll-modal-option .option-text {
            font-weight: 800;
            color: #1e293b;
            font-size: 0.95rem;
        }
        .poll-modal-option i {
            color: #03A9F4;
            opacity: 0;
            transform: translateX(10px);
            transition: all 0.3s ease;
        }
        .poll-modal-option:hover i { 
            opacity: 1; 
            transform: translateX(0);
        }
        .poll-modal-option.selected {
            background: #e0f2fe;
            border-color: #03A9F4;
            box-shadow: 0 10px 15px -3px rgba(3, 169, 244, 0.1);
        }
        .poll-modal-option.selected i {
            opacity: 1;
            transform: translateX(0);
        }
        
        .modal-poll-star {
            font-size: 2.8rem;
            color: #f1f5f9;
            cursor: pointer;
            transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        .modal-poll-star:hover, .modal-poll-star:hover ~ .modal-poll-star {
            color: #f59e0b;
            transform: scale(1.1) rotate(5deg);
            filter: drop-shadow(0 0 10px rgba(245, 158, 11, 0.3));
        }

        .poll-modal-footer {
            margin-top: 1.25rem;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 12px;
            color: #94a3b8;
            font-size: 0.85rem;
            font-weight: 700;
            flex-shrink: 0;
        }

        @media (max-width: 600px) {
            .poll-modal-card {
                padding: 1.25rem;
                border-radius: 20px;
                max-width: 92%;
            }
            .poll-modal-question {
                font-size: 1.2rem;
            }
            .poll-modal-option {
                padding: 12px 16px;
            }
            .poll-modal-option .option-text {
                font-size: 0.9rem;
            }
            .modal-poll-star {
                font-size: 2.2rem;
            }
        }

        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { 
            from { opacity: 0; transform: translateY(60px) scale(0.9); } 
            to { opacity: 1; transform: translateY(0) scale(1); } 
        }
        @keyframes fadeOutDown { 
            to { opacity: 0; transform: translateY(30px) scale(0.95); } 
        }

        .nav-arrow-btn {
            width: 50px;
            height: 50px;
            border-radius: 50%;
            background: #f1f5f9;
            border: 1px solid #e2e8f0;
            color: #475569;
            font-size: 1.2rem;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            transition: all 0.3s ease;
            outline: none;
        }
        .nav-arrow-btn:hover {
            background: #03A9F4;
            color: white;
            border-color: #03A9F4;
            transform: scale(1.1);
            box-shadow: 0 4px 12px rgba(3, 169, 244, 0.2);
        }
        .nav-arrow-btn-ghost {
            width: 50px;
            height: 50px;
            border-radius: 50%;
            background: transparent;
            border: 1.5px solid #e2e8f0;
            color: #94a3b8;
            font-size: 1.1rem;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            outline: none;
        }
        .nav-arrow-btn-ghost:hover {
            background: #f8fafc;
            color: #475569;
            border-color: #cbd5e1;
            transform: translateY(-2px);
        }
    `;
    document.head.appendChild(style);
}

window.handlePollSubmit = async (pollId, response) => {
    if (!currentProfile) return;

    const contentArea = document.getElementById('poll-content-area-modal');
    contentArea.innerHTML = `
        <div style="text-align:center; padding: 2.5rem; animation: fadeIn 0.4s;">
            <div class="poll-spinner" style="width:50px; height:50px; border:5px solid #e0f2fe; border-top-color:#03A9F4; border-radius:50%; animation: spin 0.8s linear infinite; margin:0 auto;"></div>
        </div>
        <style>@keyframes spin { to { transform: rotate(360deg); } }</style>
    `;

    const { error } = await supabase
        .from('poll_responses')
        .upsert({
            poll_id: pollId,
            user_id: currentProfile.id,
            response: response
        }, { onConflict: ['poll_id', 'user_id'] });

    if (error) {
        console.error("Poll submission error:", error);
        return;
    }

    userAnswers[pollId] = response;
    answeredPolls.add(pollId);

    // Interactive feedback
    contentArea.innerHTML = `
        <div style="text-align:center; padding: 2.5rem; animation: slideUp 0.5s ease;">
            <div style="width: 80px; height: 80px; background: #dcfce7; color: #15803d; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 10px; font-size: 2.5rem; box-shadow: 0 10px 15px -3px rgba(21, 128, 61, 0.2);">
                <i class="fas fa-check"></i>
            </div>
            <h3 style="margin:0; color: #0f172a; font-weight: 800; font-size: 1.3rem;">تم تسجيل ردك</h3>
        </div>
    `;

    setTimeout(() => {
        nextPoll();
    }, 1500);
};
