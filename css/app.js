// =========================================================================
// === MODULE 1: EXAM STATE (MODEL) - ניהול המידע ===
// =========================================================================
const ExamState = {
    questions: [],
    parts: [
        { id: 'A', name: 'חלק ראשון' },
        { id: 'B', name: 'חלק שני' },
        { id: 'C', name: 'חלק שלישי' }
    ],
    currentTab: 'A',
    studentName: '',
    examTitle: 'מבחן בגרות', 
    logoData: null,
    solutionDataUrl: null,
    instructions: {
        general: '',
        parts: {} 
    },
    partNamesList: ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שביעי", "שמיני", "תשיעי", "עשירי"],
    subLabels: ["א", "ב", "ג", "ד", "ה", "ו", "ז", "ח", "ט", "י"],
    tempSubQuestions: [], // Holds sub-questions currently being edited
    editingId: null, // Tracks if we are editing an existing question

    // Methods to mutate state
    addQuestion: function(q) { this.questions.push(q); },
    updateQuestion: function(updatedQ) {
        const index = this.questions.findIndex(q => q.id === updatedQ.id);
        if (index !== -1) {
            this.questions[index] = updatedQ;
        }
    },
    removeQuestion: function(id) { this.questions = this.questions.filter(q => q.id !== id); },
    addPart: function(part) { this.parts.push(part); },
    removePart: function(id) {
        this.questions = this.questions.filter(q => q.part !== id);
        this.parts = this.parts.filter(p => p.id !== id);
        delete this.instructions.parts[id];
    },
    updatePartName: function(id, name) {
        const p = this.parts.find(p => p.id === id);
        if (p) p.name = name;
    },
    getNextPartId: function() {
        const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
        for (let i=0; i<letters.length; i++) {
            if (!this.parts.find(p => p.id === letters[i])) return letters[i];
        }
        return 'P' + Date.now();
    }
};

// =========================================================================
// === MODULE 2: UI RENDERING (VIEW) - תצוגה ואינטראקציה ===
// =========================================================================
const UI = {
    elements: {}, // Will be populated on init
    
    initElements: function() {
        const idList = [
            'qPart', 'partNameInput', 'partInstructions', 'partNameLabel', 
            'qPoints', 'qText', 'qModelAnswer', 'qVideo', 'qImage', 
            'previewQuestionsContainer', 'statsContainer', 'totalPoints', 
            'studentNameInput', 'filenamePreview', 'previewTabs', 
            'examInstructions', 'previewInstructionsBox', 'examTitleInput', 
            'previewExamTitle', 'previewLogo', 'examDurationInput', 
            'unlockCodeInput', 'teacherEmailInput', 'driveFolderInput', 
            'subQuestionsList', 'mainModelAnswerContainer', 
            'toastContainer', 'confirmModal', 'importExamInput',
            'btnAddQuestion', 'btnCancelEdit' // Added buttons for edit mode
        ];
        
        // Inject Cancel Button dynamically if not in HTML
        if (!document.getElementById('btnCancelEdit')) {
            const btnAdd = document.querySelector('.btn-add');
            if (btnAdd) {
                btnAdd.id = 'btnAddQuestion';
                const btnCancel = document.createElement('button');
                btnCancel.id = 'btnCancelEdit';
                btnCancel.innerText = 'ביטול עריכה';
                btnCancel.style.display = 'none';
                btnCancel.style.backgroundColor = '#95a5a6';
                btnCancel.style.color = 'white';
                btnCancel.style.marginTop = '5px';
                btnCancel.onclick = App.cancelEdit;
                btnAdd.parentNode.insertBefore(btnCancel, btnAdd.nextSibling);
            }
        }

        idList.forEach(id => {
            const el = document.getElementById(id);
            if(el) this.elements[id] = el;
        });
    },

    showToast: function(message, type = 'success') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        this.elements.toastContainer.appendChild(toast);
        void toast.offsetWidth; // Trigger reflow
        toast.classList.add('visible');
        setTimeout(() => {
            toast.classList.remove('visible');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    },

    showConfirm: function(title, text, callback) {
        document.getElementById('modalTitle').textContent = title;
        document.getElementById('modalText').textContent = text;
        this.elements.confirmModal.classList.add('open');
        this.confirmCallback = callback;
    },

    closeModal: function() {
        this.elements.confirmModal.classList.remove('open');
        this.confirmCallback = null;
    },

    setEditMode: function(isEditing) {
        if (isEditing) {
            this.elements.btnAddQuestion.innerText = '💾 עדכן שאלה';
            this.elements.btnAddQuestion.style.background = 'linear-gradient(135deg, #f39c12, #d35400)';
            if(this.elements.btnCancelEdit) this.elements.btnCancelEdit.style.display = 'block';
        } else {
            this.elements.btnAddQuestion.innerText = '➕ הוסף שאלה';
            this.elements.btnAddQuestion.style.background = ''; // Reset to CSS default
            if(this.elements.btnCancelEdit) this.elements.btnCancelEdit.style.display = 'none';
            
            // Clear form
            this.elements.qText.value = '';
            this.elements.qModelAnswer.value = '';
            this.elements.qPoints.value = '10';
            this.elements.qVideo.value = '';
            this.elements.qImage.value = '';
            this.elements.qText.focus();
            ExamState.tempSubQuestions = [];
            this.renderSubQuestionInputs();
        }
    },

    fillQuestionForm: function(q) {
        this.elements.qText.value = q.text;
        this.elements.qModelAnswer.value = q.modelAnswer || '';
        this.elements.qPoints.value = q.points;
        this.elements.qVideo.value = q.videoUrl || '';
        this.elements.qImage.value = q.imageUrl || '';
        this.elements.qPart.value = q.part;
        
        // Handle Sub Questions - Deep copy to prevent mutating original before save
        ExamState.tempSubQuestions = q.subQuestions ? JSON.parse(JSON.stringify(q.subQuestions)) : [];
        this.renderSubQuestionInputs();
        
        // Trigger part change to update tabs/UI if needed
        App.onPartSelectChange();
    },

    renderPartSelector: function() {
        const el = this.elements.qPart;
        el.innerHTML = '';
        ExamState.parts.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p.id;
            opt.textContent = p.name;
            el.appendChild(opt);
        });
        el.value = ExamState.currentTab;
    },

    renderTabs: function() {
        const container = this.elements.previewTabs;
        container.innerHTML = '';
        ExamState.parts.forEach(p => {
            const div = document.createElement('div');
            div.className = `tab ${p.id === ExamState.currentTab ? 'active' : ''}`;
            div.textContent = p.name;
            div.onclick = () => App.setTab(p.id);
            container.appendChild(div);
        });
    },

    updateStats: function() {
        const container = this.elements.statsContainer;
        container.innerHTML = '';
        let total = 0;
        
        ExamState.parts.forEach(p => {
            const count = ExamState.questions.filter(q => q.part === p.id).length;
            const div = document.createElement('div');
            div.className = 'stat-row';
            div.innerHTML = `<span>${p.name}:</span> <span>${count}</span>`;
            container.appendChild(div);
        });

        ExamState.questions.forEach(q => total += q.points);
        this.elements.totalPoints.textContent = total;
    },

    renderPreview: function() {
        const container = this.elements.previewQuestionsContainer;
        const filtered = ExamState.questions.filter(q => q.part === ExamState.currentTab);
        
        if (filtered.length === 0) {
            container.innerHTML = `
            <div style="text-align: center; color: #bdc3c7; margin-top: 50px;">
                <h3>עדיין אין שאלות בחלק זה</h3>
                <p>הוסף שאלות מהתפריט הימני</p>
            </div>`;
            return;
        }

        container.innerHTML = filtered.map((q, idx) => {
            let mediaHTML = '';
            const imgSrc = Utils.getImageSrc(q.imageUrl);
            if (imgSrc) mediaHTML += `<div class="image-wrapper"><img src="${imgSrc}" alt="Question Image"></div>`;

            const embedSrc = Utils.getVideoEmbedUrl(q.videoUrl);
            if (embedSrc) mediaHTML += `<div class="video-wrapper"><div class="video-shield"></div><iframe sandbox="allow-scripts allow-same-origin allow-presentation" src="${embedSrc}" frameborder="0"></iframe></div>`;

            let subQuestionsHTML = '';
            let modelAnsPreview = '';

            if (q.subQuestions && q.subQuestions.length > 0) {
                subQuestionsHTML = q.subQuestions.map((sq, si) => {
                    const label = ExamState.subLabels[si] || (si + 1);
                    return `<div class="preview-sub-q">
                        <div class="preview-sub-badge">${label}' (${sq.points} נק')</div>
                        <div style="margin-bottom:10px;">${sq.text}</div>
                        <div class="preview-input" style="height:8vh;">תשובה לסעיף...</div>
                        ${sq.modelAnswer ? `<div style="background:#fff3cd; padding:0.5vh; margin-top:0.5vh; border-radius:0.4em; font-size:0.8rem; color:#856404; border:1px solid #ffeeba;"><strong>👁️ מחוון:</strong> ${sq.modelAnswer}</div>` : ''}
                    </div>`;
                }).join('');
            } else {
                modelAnsPreview = q.modelAnswer ? `<div style="background:#fff3cd; padding:1vh; margin-top:1vh; border-radius:0.4em; font-size:0.9rem; color:#856404; border:1px solid #ffeeba;"><strong>👁️ מחוון למורה:</strong> ${q.modelAnswer}</div>` : '';
            }

            // Edit button added below
            return `
            <div class="question-card" style="${ExamState.editingId === q.id ? 'border: 2px solid var(--accent);' : ''}">
                <div style="position: absolute; top: 3vh; left: 0; display:flex; gap:5px;">
                    <button class="btn-delete" style="position:static; margin:0;" onclick="App.editQuestion(${q.id})" title="ערוך שאלה וסעיפים">✏️ ערוך</button>
                    <button class="btn-delete" style="position:static; margin:0;" onclick="App.deleteQuestion(${q.id})" title="מחק שאלה">🗑️ הסר</button>
                </div>
                <div class="badge">שאלה ${idx + 1} • ${q.points} נקודות</div>
                <div class="q-text">${q.text}</div>
                ${mediaHTML}
                ${q.subQuestions && q.subQuestions.length > 0 ? subQuestionsHTML : '<div class="preview-input">תיבת טקסט לתשובת התלמיד...</div>'}
                ${modelAnsPreview}
            </div>`;
        }).join('');
    },

    renderSubQuestionInputs: function() {
        const list = this.elements.subQuestionsList;
        list.innerHTML = '';
        ExamState.tempSubQuestions.forEach((sq, idx) => {
            const label = ExamState.subLabels[idx] || (idx + 1);
            const row = document.createElement('div');
            row.className = 'sub-q-row';
            row.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:5px;">
                    <strong>סעיף ${label}'</strong>
                    <button class="btn-small-remove" onclick="App.removeSubQuestionField(${sq.id})">❌</button>
                </div>
                <input type="text" placeholder="תוכן הסעיף" value="${sq.text}" oninput="App.updateSubQuestionData(${sq.id}, 'text', this.value)" style="margin-bottom:5px;">
                <div style="display:flex; gap:10px;">
                    <input type="number" placeholder="נקודות" value="${sq.points}" oninput="App.updateSubQuestionData(${sq.id}, 'points', parseInt(this.value)||0)" style="width:80px;">
                    <input type="text" placeholder="מחוון לסעיף" value="${sq.modelAnswer}" oninput="App.updateSubQuestionData(${sq.id}, 'modelAnswer', this.value)" style="flex:1; border-color:#f39c12; background:#fffdf5;">
                </div>
            `;
            list.appendChild(row);
        });

        // Update main points and visibility
        if (ExamState.tempSubQuestions.length > 0) {
            const total = ExamState.tempSubQuestions.reduce((acc, curr) => acc + (curr.points || 0), 0);
            this.elements.qPoints.value = total;
            this.elements.qPoints.disabled = true;
            this.elements.mainModelAnswerContainer.style.display = 'none';
        } else {
            this.elements.qPoints.disabled = false;
            this.elements.mainModelAnswerContainer.style.display = 'block';
        }
    },

    populateInputsFromState: function() {
        this.elements.examTitleInput.value = ExamState.examTitle;
        this.elements.previewExamTitle.textContent = ExamState.examTitle;
        this.elements.examInstructions.value = ExamState.instructions.general || '';
        this.elements.previewInstructionsBox.textContent = ExamState.instructions.general || '';
        this.elements.previewInstructionsBox.style.display = ExamState.instructions.general ? 'block' : 'none';
        
        if (ExamState.logoData) {
            this.elements.previewLogo.src = ExamState.logoData;
            this.elements.previewLogo.style.display = 'block';
        }
    }
};

// =========================================================================
// === MODULE 3: UTILS - פונקציות עזר ===
// =========================================================================
const Utils = {
    getVideoEmbedUrl: function(url) {
        if (!url) return null;
        const driveMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
        if (driveMatch && url.includes('drive.google.com')) {
            return `https://drive.google.com/file/d/${driveMatch[1]}/preview`;
        }
        const iframeMatch = url.match(/src=["'](.*?)["']/);
        const link = iframeMatch ? iframeMatch[1] : url;
        const ytRegExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=|shorts\/)([^#&?"]*).*/;
        const ytMatch = link.match(ytRegExp);
        if (ytMatch && ytMatch[2].length === 11) {
            return `https://www.youtube-nocookie.com/embed/${ytMatch[2]}?rel=0&modestbranding=1&showinfo=0`;
        }
        return null;
    },

    getImageSrc: function(url) {
        if (!url) return null;
        const driveMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
        if (driveMatch && url.includes('drive.google.com')) {
            return `https://drive.google.com/thumbnail?id=${driveMatch[1]}&sz=w1600`;
        }
        return url;
    },

    simpleHash: function(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = (hash << 5) - hash + char;
            hash |= 0;
        }
        return hash.toString();
    },

    setupResizers: function() {
        const resizerRight = document.getElementById('dragHandleRight');
        const rightCol = document.getElementById('rightPanel');
        if(resizerRight && rightCol) {
            resizerRight.addEventListener('mousedown', (e) => {
                e.preventDefault();
                document.body.style.cursor = 'col-resize';
                resizerRight.classList.add('resizing');
                const onMove = (e) => {
                    const newWidth = window.innerWidth - e.clientX;
                    if (newWidth > 200 && newWidth < window.innerWidth * 0.6) {
                        rightCol.style.width = newWidth + 'px';
                        rightCol.style.flex = 'none';
                    }
                };
                const onUp = () => {
                    document.removeEventListener('mousemove', onMove);
                    document.removeEventListener('mouseup', onUp);
                    document.body.style.cursor = 'default';
                    resizerRight.classList.remove('resizing');
                };
                document.addEventListener('mousemove', onMove);
                document.addEventListener('mouseup', onUp);
            });
        }

        const resizerLeft = document.getElementById('dragHandleLeft');
        const leftCol = document.getElementById('leftPanel');
        if(resizerLeft && leftCol) {
            resizerLeft.addEventListener('mousedown', (e) => {
                e.preventDefault();
                document.body.style.cursor = 'col-resize';
                resizerLeft.classList.add('resizing');
                const onMove = (e) => {
                    const newWidth = e.clientX;
                    if (newWidth > 150 && newWidth < window.innerWidth * 0.4) {
                        leftCol.style.width = newWidth + 'px';
                        leftCol.style.flex = 'none';
                    }
                };
                const onUp = () => {
                    document.removeEventListener('mousemove', onMove);
                    document.removeEventListener('mouseup', onUp);
                    document.body.style.cursor = 'default';
                    resizerLeft.classList.remove('resizing');
                };
                document.addEventListener('mousemove', onMove);
                document.addEventListener('mouseup', onUp);
            });
        }
    }
};

// =========================================================================
// === MODULE 4: GENERATOR - לוגיקה ליצירת קובץ התלמיד ===
// =========================================================================
const Generator = {
    generateAndDownload: function() {
        const name = ExamState.studentName || 'תלמיד';
        const duration = UI.elements.examDurationInput.value || 90;
        const unlockCodePlain = UI.elements.unlockCodeInput.value || '1234';
        const unlockCodeHash = Utils.simpleHash(unlockCodePlain);
        const teacherEmail = UI.elements.teacherEmailInput.value.trim();
        const driveLink = UI.elements.driveFolderInput.value.trim();

        // Prepare config object for re-importing later
        const examConfig = {
            questions: ExamState.questions,
            instructions: ExamState.instructions,
            examTitle: ExamState.examTitle,
            logoData: ExamState.logoData,
            solutionDataUrl: ExamState.solutionDataUrl,
            duration: duration,
            parts: ExamState.parts,
            teacherEmail: teacherEmail,
            driveLink: driveLink
        };
        const jsonConfig = JSON.stringify(examConfig);

        const htmlContent = this.buildStudentHTML(name, ExamState.questions, ExamState.instructions, ExamState.examTitle, ExamState.logoData, ExamState.solutionDataUrl, duration, unlockCodeHash, ExamState.parts, teacherEmail, driveLink, jsonConfig);
        
        const blob = new Blob([htmlContent], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${name} - מבחן.html`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        UI.showToast('קובץ המבחן הורד בהצלחה!');
    },

    buildStudentHTML: function(studentName, questions, instructions, examTitle, logoData, solutionDataUrl, duration, unlockCodeHash, parts, teacherEmail, driveLink, jsonConfig) {
        
        const tabsHTML = parts.map((p, idx) => `<button class="tab-btn ${idx===0?'active':''}" onclick="showPart('${p.id}')">${p.name}</button>`).join('');

        const sectionsHTML = parts.map((p, idx) => {
            const partQuestions = questions.filter(q => q.part === p.id);
            const partInstrHtml = instructions.parts[p.id] ? `<div class="part-instructions">${instructions.parts[p.id]}</div>` : '';
            
            let qHtml = '';
            if(partQuestions.length === 0) {
                qHtml = '<p style="text-align:center; color:#95a5a6; padding:20px;">אין שאלות בחלק זה</p>';
            } else {
                qHtml = partQuestions.map((q, qIdx) => {
                    const embedSrc = Utils.getVideoEmbedUrl(q.videoUrl);
                    let vid = embedSrc ? `<div class="video-wrapper"><div class="video-shield"></div><div class="media-container"><iframe sandbox="allow-scripts allow-same-origin allow-presentation" src="${embedSrc}" frameborder="0"></iframe></div></div>` : '';
                    const imgSrc = Utils.getImageSrc(q.imageUrl);
                    let img = imgSrc ? `<div class="image-wrapper"><img src="${imgSrc}" alt="Question Image"></div>` : '';

                    let interactionHTML = '';
                    let gradingHTML = '';
                    let modelAnsHtml = '';

                    if (q.subQuestions && q.subQuestions.length > 0) {
                        interactionHTML = q.subQuestions.map((sq, si) => {
                            const label = ExamState.subLabels[si] || (si + 1);
                            const sqModelAns = sq.modelAnswer ? `<div class="model-answer-secret" style="display:none; margin-top:5px; background:#fff3cd; color:#856404; padding:5px; border-radius:4px; font-size:0.9em; border:1px solid #ffeeba;"><strong>מחוון (${label}'):</strong> <span class="model-ans-text-content">${sq.modelAnswer}</span></div>` : '';
                            return `
                            <div class="sub-question-block" style="margin-top:25px; border-right:4px solid #eee; padding-right:20px;">
                                <div class="sub-q-title" style="font-weight:bold; color:#3498db; margin-bottom:10px; font-size:1.1rem;">סעיף ${label}' (${sq.points} נק')</div>
                                <div class="sub-q-text" id="q-text-${q.id}-${si}">${sq.text}</div>
                                <div class="answer-area" style="margin-top:15px;">
                                    <textarea class="student-ans" id="student-ans-${q.id}-${si}" placeholder="תשובה לסעיף ${label}'..." onpaste="return false;" style="height:12vh;"></textarea>
                                </div>
                                <div class="grading-area">
                                    <div style="display:flex; align-items:center; gap:1vw;">
                                        <label>ניקוד:</label>
                                        <input type="number" class="grade-input" id="grade-input-${q.id}-${si}" min="0" max="${sq.points}" oninput="calcTotal()" disabled>
                                        <span class="grade-max">מתוך ${sq.points}</span>
                                    </div>
                                    <input type="text" class="teacher-comment" id="comment-input-${q.id}-${si}" placeholder="הערה לסעיף..." disabled>
                                    ${sqModelAns}
                                </div>
                            </div>`;
                        }).join('');
                        
                        gradingHTML = `<div style="margin-top:15px; text-align:left;">
                            <button class="ai-grade-btn" onclick="askAI_Multi('${q.id}', ${q.subQuestions.length})" title="קבל המלצת ציון לכל הסעיפים" disabled>✨ בדיקת כל הסעיפים (AI)</button>
                        </div>`;
                    } else {
                        modelAnsHtml = q.modelAnswer ? `<div class="model-answer-secret" style="display:none; margin-top:15px; background:#fff3cd; color:#856404; padding:10px; border-radius:5px; border:1px solid #ffeeba;"><strong>🔑 תשובה לדוגמא (למורה):</strong><br><div style="white-space:pre-wrap; margin-top:5px;" id="model-ans-text-${q.id}" class="model-ans-text-content">${q.modelAnswer}</div></div>` : '';
                        interactionHTML = `<div class="answer-area"><label>תשובה:</label><textarea class="student-ans" id="student-ans-${q.id}" placeholder="כתוב את תשובתך כאן..." onpaste="return false;"></textarea></div>`;
                        gradingHTML = `<div class="grading-area"><div style="display:flex; align-items:center; gap:1vw;"><label>ניקוד:</label><input type="number" class="grade-input" id="grade-input-${q.id}" min="0" max="${q.points}" oninput="calcTotal()" disabled><span class="grade-max">מתוך ${q.points}</span></div><input type="text" class="teacher-comment" id="comment-input-${q.id}" placeholder="הערה מילולית..." disabled><button class="ai-grade-btn" onclick="askAI('${q.id}', ${q.points})" title="קבל המלצת ציון מ-AI" disabled>✨ AI</button>${modelAnsHtml}</div>`;
                    }

                    return `<div class="q-block"><div class="q-header"><span class="q-points">(${q.points} נק' סה"כ)</span><strong id="q-label-${q.id}" style="font-size:1.2rem;">שאלה ${qIdx+1}:</strong></div><div class="q-content" id="q-main-text-${q.id}">${q.text}</div>${img}${vid}${interactionHTML}${gradingHTML}</div>`;
                }).join('');
            }
            return `<div id="part-${p.id}" class="exam-section ${idx===0?'active':''}">
                <h2 style="color:#2c3e50; border-bottom:0.3vh solid #3498db; font-weight: 700; padding-bottom:1vh; margin-bottom:3vh; font-size:1.8rem;">${p.name}</h2>
                ${partInstrHtml}${qHtml}</div>`;
        }).join('');

        const globalInstructionsHTML = instructions.general ? `<div class="instructions-box global-instructions"><h3>הנחיות כלליות</h3><div class="instructions-text">${instructions.general}</div></div>` : '';
        const logoHTML = logoData ? `<img src="${logoData}" alt="Logo" class="school-logo">` : '';

        // Injecting the JSON config, Fullscreen logic, and updated CSS for readability
        return `<!DOCTYPE html><html lang="he" dir="rtl"><head><meta charset="UTF-8"><title>מבחן - ${studentName}</title><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Rubik:wght@300;400;500;700&display=swap"><style>
        :root{--primary:#2c3e50;--accent:#3498db;--success:#27ae60;--danger:#e74c3c;}
        body{font-family:'Rubik',sans-serif;background:#f4f6f8;margin:0;padding:2%;color:#2c3e50;user-select:none; line-height: 1.6;}
        .container{max-width:800px;margin:0 auto;background:white;padding:5%;border-radius:1em;box-shadow:0 1vh 3vh rgba(0,0,0,0.05);}
        
        /* Typography Improvements */
        .q-block { margin-bottom: 3.5rem; padding: 2.5rem; background: #fff; border: 1px solid #e0e0e0; border-radius: 12px; box-shadow: 0 4px 10px rgba(0,0,0,0.03); }
        .q-header { margin-bottom: 1.5rem; border-bottom: 2px dashed #eee; padding-bottom: 1rem; }
        .q-content { font-size: 1.25rem; line-height: 1.8; margin-bottom: 2rem; color: #2c3e50; white-space: pre-wrap; }
        .sub-q-text { font-size: 1.15rem; line-height: 1.7; margin-bottom: 1rem; color: #34495e; }
        .part-instructions { font-size: 1.1rem; line-height: 1.7; background-color: #f8f9fa; padding: 1.5rem; border-radius: 8px; border-right: 5px solid #95a5a6; margin-bottom: 2rem; }
        .instructions-text { font-size: 1.1rem; line-height: 1.8; }
        
        textarea{width:100%;height:20vh;padding:15px;border:1px solid #bdc3c7;border-radius:0.8em;font-family:inherit;font-size:1.1rem;transition:border 0.3s;}
        textarea:focus { border-color: var(--accent); outline: none; box-shadow: 0 0 0 3px rgba(52,152,219,0.1); }
        
        button{cursor:pointer;}
        .tab-btn{padding:12px 25px;background:#eee;border:none;margin:5px;border-radius:30px;font-size:1rem;font-weight:500;transition:all 0.3s;}
        .tab-btn:hover { background: #e0e0e0; }
        .tab-btn.active{background:var(--accent);color:white;box-shadow: 0 4px 10px rgba(52,152,219,0.3);}
        
        .exam-section{display:none; animation: fadeIn 0.5s ease;}
        .exam-section.active{display:block;}
        @keyframes fadeIn { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }

        /* Modals */
        #startScreen,#timesUpModal,#securityModal,#successModal{position:fixed;top:0;left:0;width:100%;height:100%;background:#2c3e50;color:white;display:flex;align-items:center;justify-content:center;flex-direction:column;z-index:9999;}
        #timesUpModal,#securityModal,#successModal{display:none;}
        #timerBadge{position:fixed;top:15px;left:15px;background:white;color:black;padding:10px 20px;border-radius:30px;border:2px solid #2c3e50;font-weight:bold;z-index:5000;display:none;box-shadow: 0 4px 10px rgba(0,0,0,0.2);}
        
        /* Teacher Controls Visibility Logic */
        .teacher-controls { display: none; border-bottom:1px solid #ccc; padding-bottom:20px; margin-bottom:20px; background: #fff3e0; padding: 20px; border-radius: 8px; }
        body[data-status="submitted"] .teacher-controls { display: block !important; }
        body[data-status="submitted"] .student-submit-area { display: none !important; }
        .model-answer-secret { display: none; margin-top: 15px; color: #d35400; font-size: 1rem; background: #fff5eb; padding: 15px; border-radius: 8px; border: 1px solid #fae5d3; }
        </style>
        <script id="exam-configuration" type="application/json">${jsonConfig}</script>
        </head><body oncontextmenu="return false;"><div id="startScreen"><h1>${examTitle}</h1><p>משך הבחינה: ${duration} דקות</p><button onclick="startExamTimer()" style="padding:15px 30px;font-size:1.5em;background:#27ae60;color:white;border:none;border-radius:10px;">התחל בחינה</button></div><div id="timerBadge">זמן: <span id="timerText">--:--</span></div><div id="timesUpModal"><h2>הזמן נגמר!</h2><button onclick="submitExam()">הגש בחינה</button></div><div id="securityModal"><h2>המבחן ננעל!</h2><input type="password" id="teacherCodeInput" placeholder="קוד מורה"><button onclick="unlockExam()">שחרר</button></div><div id="successModal"><h1>סיימת!</h1><div id="submissionActions"></div></div><div class="container" id="mainContainer" style="filter:blur(5px);"><div style="text-align:center;">${logoHTML}<h1>${examTitle}</h1></div>
        
        <div class="teacher-controls"><button onclick="enableGrading()">🔓 כניסת מורה</button><div id="gradingTools" style="display:none;margin-top:10px;"><button onclick="saveGradedExam()" style="background:#27ae60;color:white;padding:5px 10px;border:none;border-radius:5px;">💾 שמור בדיקה</button><button onclick="exportToDoc()" style="background:#3498db;color:white;padding:5px 10px;border:none;border-radius:5px;margin-right:10px;">📄 ייצוא ל-Word</button><div id="apiKeyContainer" style="margin-top:10px;"><label>Gemini API Key:</label><input type="password" id="apiKeyInput" onchange="enableAIButtons()"></div></div></div>
        
        <div style="background:#fff;padding:20px;border:1px solid var(--accent);border-radius:10px;margin-bottom:20px;"><label>שם תלמיד:</label><input type="text" id="studentNameField" value="${studentName}" style="width:100%;padding:10px;font-size:1.2rem;"></div>${globalInstructionsHTML}<div class="tabs">${tabsHTML}</div><form id="examForm">${sectionsHTML}</form><div style="text-align:center;margin-top:50px;border-top:1px solid #eee;padding-top:20px;">ציון סופי: <span id="finalScore">--</span><div class="student-submit-area"><br><button onclick="submitExam()" style="background:#27ae60;color:white;padding:15px 40px;font-size:1.3em;border:none;border-radius:50px;box-shadow: 0 4px 15px rgba(39, 174, 96, 0.4);">הגש בחינה</button></div></div></div><script>
        // Student Script embedded
        let totalTime=${duration}*60,timerInterval,examStarted=false;
        function simpleHash(s){if(!s)return 0;let h=0;for(let i=0;i<s.length;i++)h=(h<<5)-h+s.charCodeAt(i)|0;return h.toString();}
        function startExamTimer(){
            var elem = document.documentElement;
            if(elem.requestFullscreen) elem.requestFullscreen();
            else if(elem.webkitRequestFullscreen) elem.webkitRequestFullscreen();
            else if(elem.msRequestFullscreen) elem.msRequestFullscreen();
            document.getElementById('startScreen').style.display='none';document.getElementById('mainContainer').style.filter='none';document.getElementById('timerBadge').style.display='block';examStarted=true;runTimer();updateTimer();
        }
        function runTimer(){clearInterval(timerInterval);timerInterval=setInterval(()=>{totalTime--;updateTimer();if(totalTime<=0){clearInterval(timerInterval);document.getElementById('timesUpModal').style.display='flex';}},1000);}
        function updateTimer(){let m=Math.floor(totalTime/60),s=totalTime%60;document.getElementById('timerText').innerText=(m<10?'0'+m:m)+':'+(s<10?'0'+s:s);}
        function showPart(id){document.querySelectorAll('.exam-section').forEach(e=>e.classList.remove('active'));document.getElementById('part-'+id).classList.add('active');document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));event.target.classList.add('active');}
        function calcTotal(){let t=0;document.querySelectorAll('.grade-input').forEach(i=>{if(i.value)t+=parseFloat(i.value)});document.getElementById('finalScore').innerText=t;}
        function checkSec(){
            if(!examStarted||document.body.dataset.status==='submitted')return;
            if(document.hidden || (!document.fullscreenElement && !document.webkitFullscreenElement && !document.msFullscreenElement)){
                clearInterval(timerInterval);document.getElementById('securityModal').style.display='flex';
            }
        }
        document.addEventListener('visibilitychange',checkSec);
        document.addEventListener('fullscreenchange', checkSec);
        document.addEventListener('webkitfullscreenchange', checkSec);
        document.addEventListener('mozfullscreenchange', checkSec);
        document.addEventListener('MSFullscreenChange', checkSec);

        function unlockExam(){if(simpleHash(document.getElementById('teacherCodeInput').value)==="${unlockCodeHash}"){document.getElementById('securityModal').style.display='none';
            var elem = document.documentElement;
            if(elem.requestFullscreen) elem.requestFullscreen().catch(e=>{});
            runTimer();}else{alert('קוד שגוי');}}
        function submitExam(){
            document.body.dataset.status='submitted';
            clearInterval(timerInterval);document.getElementById('timerBadge').style.display='none';
            // Explicitly show controls for immediate feedback before save
            document.querySelector('.teacher-controls').style.display = 'block';
            
            const name=document.getElementById('studentNameField').value||'student';
            // Persist values
            document.querySelectorAll('input,textarea').forEach(e=>{
                e.setAttribute('value',e.value);
                if(!e.classList.contains('grade-input')&&!e.classList.contains('teacher-comment')) e.setAttribute('readonly','true');
            });
            // Update innerHTML for textareas to persist
            document.querySelectorAll('textarea').forEach(t=>t.innerHTML=t.value);
            
            const html="<!DOCTYPE html>"+document.documentElement.outerHTML;
            const b=new Blob([html],{type:'text/html'});const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download="פתור-"+name+".html";a.click();
            document.getElementById('successModal').style.display='flex';
            const acts=document.getElementById('submissionActions');
            if("${teacherEmail}"){const l="https://mail.google.com/mail/?view=cm&to=${teacherEmail}&su=Exam:"+name+"&body=Please attach file";acts.innerHTML+='<a href="'+l+'" target="_blank" style="display:block;margin:10px;padding:10px;background:#3498db;color:white;text-decoration:none;">שלח במייל (צרף קובץ!)</a>';}
            if("${driveLink}"){acts.innerHTML+='<a href="${driveLink}" target="_blank" style="display:block;margin:10px;padding:10px;background:#f1c40f;color:black;text-decoration:none;">העלה לדרייב</a>';}
        }
        function enableGrading(){
            var c = prompt('הכנס קוד מורה:');
            if(!c) return;
            if(simpleHash(c)==="${unlockCodeHash}"){
                document.querySelector('.teacher-controls').style.display='block';
                document.getElementById('gradingTools').style.display='block';
                document.querySelectorAll('.grade-input,.teacher-comment').forEach(e=>e.disabled=false);
                document.querySelectorAll('.model-answer-secret').forEach(e=>e.style.display='block');
                if(document.querySelector('.student-submit-area')) document.querySelector('.student-submit-area').style.display='none';
            } else { alert('קוד שגוי'); }
        }
        // ... rest of export/AI functions ...
        function saveGradedExam(){document.querySelectorAll('input').forEach(i=>i.setAttribute('value',i.value));const html="<!DOCTYPE html>"+document.documentElement.outerHTML;const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([html],{type:'text/html'}));a.download="בדוק-"+document.getElementById('studentNameField').value+".html";a.click();}
        function exportToDoc(){/* ... same as before ... */
            const studentName = document.getElementById('studentNameField').value || 'תלמיד';
            const finalScore = document.getElementById('finalScore').innerText;
            const date = new Date().toLocaleDateString('he-IL');
            let htmlBody = \`<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>Exam Export</title><style>body{font-family:Arial,sans-serif;direction:rtl}.q-box{border:1px solid #ccc;padding:15px;margin:15px 0;background:#f9f9f9}.ans-box{background:#e8f6f3;padding:10px;border-right:4px solid #1abc9c;margin:10px 0}.model-box{background:#fef9e7;padding:10px;border-right:4px solid #f1c40f;margin:10px 0;color:#555}.score-box{font-weight:bold;color:#e74c3c}.comment-box{font-style:italic;color:#7f8c8d}</style></head><body><h1>דוח בדיקת מבחן</h1><h2>תלמיד: \${studentName} | ציון: \${finalScore}</h2><p>תאריך: \${date}</p>\`;
            document.querySelectorAll('.q-block').forEach(block => {
                const mainTitle = block.querySelector('.q-header strong').innerText;
                const mainText = block.querySelector('.q-content').innerText;
                htmlBody += \`<div class="q-box"><div class="q-title"><strong>\${mainTitle}</strong></div><div>\${mainText}</div>\`;
                const subBlocks = block.querySelectorAll('.sub-question-block');
                if(subBlocks.length > 0) {
                    subBlocks.forEach(sub => {
                        const subTitle = sub.querySelector('.sub-q-title').innerText;
                        const subText = sub.querySelector('.sub-q-text').innerText;
                        const subAns = sub.querySelector('.student-ans').value;
                        const subGrade = sub.querySelector('.grade-input').value || '0';
                        const subMax = sub.querySelector('.grade-max').innerText;
                        const subComment = sub.querySelector('.teacher-comment').value;
                        let subModel = "אין מחוון";
                        const m = sub.querySelector('.model-answer-secret span.model-ans-text-content');
                        if(m) subModel = m.innerText;
                        htmlBody += \`<div style="margin-right:20px;border-top:1px dashed #ccc;padding-top:10px;margin-top:10px;"><strong>\${subTitle}</strong><p>\${subText}</p><div class="ans-box"><strong>תשובה:</strong><br>\${subAns||'(אין)'}</div><div class="model-box"><strong>מחוון:</strong><br>\${subModel}</div><div class="score-box">ציון: \${subGrade} \${subMax}</div><div class="comment-box">הערה: \${subComment}</div></div>\`;
                    });
                } else {
                    const ans = block.querySelector('.student-ans').value;
                    const grade = block.querySelector('.grade-input').value || '0';
                    const max = block.querySelector('.grade-max').innerText;
                    const comment = block.querySelector('.teacher-comment').value;
                    let model = "אין מחוון";
                    const m = block.querySelector('.model-answer-secret .model-ans-text-content');
                    if(m) model = m.innerText;
                    htmlBody += \`<div class="ans-box"><strong>תשובה:</strong><br>\${ans||'(אין)'}</div><div class="model-box"><strong>מחוון:</strong><br>\${model}</div><div class="score-box">ציון: \${grade} \${max}</div><div class="comment-box">הערה: \${comment}</div>\`;
                }
                htmlBody += \`</div>\`;
            });
            htmlBody += "</body></html>";
            const blob = new Blob(['\ufeff', htmlBody], {type:'application/msword'});
            const a = document.createElement('a');a.href = URL.createObjectURL(blob);a.download = \`Checked_\${studentName}.doc\`;a.click();
        }
        async function askAI(qId, maxPoints) {
            const apiKey = document.getElementById('apiKeyInput').value;
            if(!apiKey) { alert('No API Key'); return; }
            const ans = document.getElementById('student-ans-'+qId).value;
            const model = document.getElementById('model-ans-text-'+qId) ? document.getElementById('model-ans-text-'+qId).innerText : "אין";
            const qText = document.getElementById('q-main-text-'+qId).innerText;
            if(!ans.trim()) { alert('אין תשובה לבדוק'); return; }
            const btn = event.target; const oldText = btn.innerText; btn.innerText='⏳...'; btn.disabled=true;
            const prompt = \`Role: Teacher. Grade this. Q: \${qText}. Student Ans: \${ans}. Correct Ans: \${model}. Max Pts: \${maxPoints}. Return JSON: { "grade": (number), "comment": (hebrew text) }\`;
            try {
                const res = await fetch(\`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=\${apiKey}\`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({contents:[{parts:[{text:prompt}]}]})});
                const data = await res.json();
                const jsonStr = data.candidates[0].content.parts[0].text.replace(/\\\`\\\`\\\`json/g, '').replace(/\\\`\\\`\\\`/g, '').trim();
                const resObj = JSON.parse(jsonStr);
                document.getElementById('grade-input-'+qId).value = resObj.grade;
                document.getElementById('comment-input-'+qId).value = resObj.comment;
                calcTotal();
            } catch(e){ alert('Error: '+e); } finally { btn.innerText=oldText; btn.disabled=false; }
        }
        async function askAI_Multi(qId, subCount) {
            const apiKey = document.getElementById('apiKeyInput').value;
            if(!apiKey) { alert('No API Key'); return; }
            let pData = "Main Q: " + document.getElementById('q-main-text-'+qId).innerText + "\\n";
            for(let i=0; i<subCount; i++){
                pData += \`Sub \${i}: Q: \${document.getElementById('q-text-'+qId+'-'+i).innerText}, Ans: \${document.getElementById('student-ans-'+qId+'-'+i).value}, Max: \${document.getElementById('grade-input-'+qId+'-'+i).getAttribute('max')}\\n\`;
            }
            const btn = event.target; const oldText = btn.innerText; btn.innerText='⏳...'; btn.disabled=true;
            const prompt = \`Role: Teacher. Grade multi-part question. \${pData}. Return JSON: { "grades": [ { "index": 0, "grade": 5, "comment": "..." } ] }\`;
            try {
                const res = await fetch(\`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=\${apiKey}\`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({contents:[{parts:[{text:prompt}]}]})});
                const data = await res.json();
                const jsonStr = data.candidates[0].content.parts[0].text.replace(/\\\`\\\`\\\`json/g, '').replace(/\\\`\\\`\\\`/g, '').trim();
                const resObj = JSON.parse(jsonStr);
                resObj.grades.forEach(g => {
                    if(document.getElementById('grade-input-'+qId+'-'+g.index)) {
                        document.getElementById('grade-input-'+qId+'-'+g.index).value = g.grade;
                        document.getElementById('comment-input-'+qId+'-'+g.index).value = g.comment;
                    }
                });
                calcTotal();
            } catch(e){ alert('Error: '+e); } finally { btn.innerText=oldText; btn.disabled=false; }
        }
        <\/script></body></html>`;
    }
};

// =========================================================================
// === MODULE 5: APP MAIN CONTROLLER (CONTROLLER) - חיבור האירועים ===
// =========================================================================
const App = {
    init: function() {
        UI.initElements();
        UI.renderPartSelector();
        UI.renderTabs();
        UI.updateStats();
        this.onPartSelectChange();
        Utils.setupResizers();
        
        // Confirm Modal Handler
        const btnYes = document.getElementById('btnConfirmYes');
        if(btnYes) {
            btnYes.onclick = function() {
                if (UI.confirmCallback) UI.confirmCallback();
                UI.closeModal();
            };
        }
    },

    // --- Import Handler ---
    handleExamImport: function(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function(e) {
            const content = e.target.result;
            const parser = new DOMParser();
            const doc = parser.parseFromString(content, 'text/html');
            
            const script = doc.getElementById('exam-configuration');
            if (script && script.textContent) {
                try {
                    const config = JSON.parse(script.textContent);
                    
                    // Update State
                    ExamState.questions = config.questions || [];
                    ExamState.parts = config.parts || [];
                    ExamState.instructions = config.instructions || { general: '', parts: {} };
                    ExamState.examTitle = config.examTitle || 'מבחן בגרות';
                    ExamState.logoData = config.logoData;
                    ExamState.solutionDataUrl = config.solutionDataUrl;
                    ExamState.editingId = null; // Ensure fresh state
                    
                    if (ExamState.parts.length > 0) ExamState.currentTab = ExamState.parts[0].id;

                    // Update UI Inputs
                    if(UI.elements.examDurationInput) UI.elements.examDurationInput.value = config.duration || 90;
                    if(UI.elements.teacherEmailInput) UI.elements.teacherEmailInput.value = config.teacherEmail || '';
                    if(UI.elements.driveFolderInput) UI.elements.driveFolderInput.value = config.driveLink || '';
                    if(UI.elements.examTitleInput) UI.elements.examTitleInput.value = config.examTitle || '';
                    
                    UI.populateInputsFromState();
                    UI.renderPartSelector();
                    UI.renderTabs();
                    UI.updateStats();
                    App.onPartSelectChange(); 
                    
                    UI.showToast('המבחן נטען בהצלחה!');
                } catch (err) {
                    console.error(err);
                    alert('שגיאה בטעינת קובץ המבחן. וודא שזהו קובץ תקין שנוצר במערכת זו.');
                }
            } else {
                alert('לא נמצאו נתוני עריכה בקובץ זה. ייתכן שנוצר בגרסה ישנה.');
            }
        };
        reader.readAsText(file);
        
        // Clear input so same file can be selected again
        event.target.value = '';
    },

    // --- Question Management Handlers ---
    addQuestion: function() {
        const text = UI.elements.qText.value.trim();
        const modelAnswer = UI.elements.qModelAnswer.value.trim();
        const part = UI.elements.qPart.value;
        const videoUrl = UI.elements.qVideo.value.trim();
        const imageUrl = UI.elements.qImage.value.trim();
        let points = parseInt(UI.elements.qPoints.value) || 0;

        if (!text) {
            UI.showToast('אנא הכנס תוכן לשאלה', 'error');
            return;
        }

        if (ExamState.tempSubQuestions.length > 0) {
            points = ExamState.tempSubQuestions.reduce((acc, curr) => acc + (curr.points || 0), 0);
        }

        const questionData = {
            id: ExamState.editingId || Date.now(),
            part, points, text, modelAnswer, videoUrl, imageUrl,
            subQuestions: [...ExamState.tempSubQuestions]
        };

        if (ExamState.editingId) {
            ExamState.updateQuestion(questionData);
            UI.showToast('השאלה עודכנה בהצלחה');
            ExamState.editingId = null;
            UI.setEditMode(false);
        } else {
            ExamState.addQuestion(questionData);
            UI.showToast('השאלה נוספה בהצלחה');
            // Reset Form (only if adding new)
            UI.setEditMode(false); // Handles clearing
        }

        UI.updateStats();
        UI.renderPreview();
    },

    editQuestion: function(id) {
        const q = ExamState.questions.find(q => q.id === id);
        if(!q) return;
        
        ExamState.editingId = id;
        UI.fillQuestionForm(q);
        UI.setEditMode(true);
        // Scroll to top of editor
        document.querySelector('.col-right .scroll-content').scrollTop = 0;
    },

    cancelEdit: function() {
        ExamState.editingId = null;
        UI.setEditMode(false);
    },

    deleteQuestion: function(id) {
        UI.showConfirm('מחיקת שאלה', 'האם אתה בטוח שברצונך למחוק שאלה זו?', () => {
            if (ExamState.editingId === id) {
                App.cancelEdit();
            }
            ExamState.removeQuestion(id);
            UI.updateStats();
            UI.renderPreview();
            UI.showToast('השאלה נמחקה');
        });
    },

    // --- Part Management Handlers ---
    onPartSelectChange: function() {
        const selectedPartId = UI.elements.qPart.value;
        const part = ExamState.parts.find(p => p.id === selectedPartId);
        if (part) {
            UI.elements.partNameInput.value = part.name;
            UI.elements.partNameLabel.textContent = part.name;
            UI.elements.partInstructions.value = ExamState.instructions.parts[selectedPartId] || '';
            this.setTab(selectedPartId);
        }
    },

    setTab: function(partId) {
        ExamState.currentTab = partId;
        UI.renderTabs();
        if(UI.elements.qPart.value !== partId) {
            UI.elements.qPart.value = partId;
            this.onPartSelectChange(); 
        }
        UI.renderPreview();
    },

    addPart: function() {
        const nextIdx = ExamState.parts.length;
        let suffix = "";
        if (nextIdx < ExamState.partNamesList.length) suffix = ExamState.partNamesList[nextIdx];
        else suffix = (nextIdx + 1).toString();
        
        const newId = ExamState.getNextPartId();
        const newName = "חלק " + suffix;
        
        ExamState.addPart({ id: newId, name: newName });
        UI.renderPartSelector();
        UI.renderTabs();
        UI.updateStats();
        
        UI.elements.qPart.value = newId;
        this.onPartSelectChange();
        UI.showToast(`חלק חדש נוסף: ${newName}`);
    },

    removePart: function() {
        if (ExamState.parts.length <= 1) {
            UI.showToast('חייב להישאר לפחות חלק אחד בבחינה.', 'error');
            return;
        }
        const partIdToRemove = UI.elements.qPart.value;
        const partName = ExamState.parts.find(p => p.id === partIdToRemove).name;
        
        UI.showConfirm('מחיקת חלק', `האם למחוק את "${partName}"? השאלות בחלק זה יימחקו.`, () => {
            ExamState.removePart(partIdToRemove);
            if (ExamState.parts.length > 0) ExamState.currentTab = ExamState.parts[0].id;
            
            UI.renderPartSelector();
            UI.renderTabs();
            UI.updateStats();
            this.onPartSelectChange();
            UI.renderPreview();
            UI.showToast(`החלק "${partName}" נמחק`);
        });
    },

    updatePartName: function() {
        ExamState.updatePartName(UI.elements.qPart.value, UI.elements.partNameInput.value);
        UI.elements.partNameLabel.textContent = UI.elements.partNameInput.value;
        UI.renderTabs();
        UI.renderPartSelector(); // to update dropdown text
        UI.updateStats();
    },

    savePartInstructions: function() {
        ExamState.instructions.parts[UI.elements.qPart.value] = UI.elements.partInstructions.value;
    },

    // --- Sub Question Handlers ---
    addSubQuestionField: function() {
        const id = Date.now() + Math.random();
        ExamState.tempSubQuestions.push({ id, text: '', points: 5, modelAnswer: '' });
        UI.renderSubQuestionInputs();
    },

    removeSubQuestionField: function(id) {
        ExamState.tempSubQuestions = ExamState.tempSubQuestions.filter(sq => sq.id !== id);
        UI.renderSubQuestionInputs();
    },

    updateSubQuestionData: function(id, field, value) {
        const sq = ExamState.tempSubQuestions.find(s => s.id === id);
        if (sq) {
            sq[field] = value;
            if (field === 'points') UI.renderSubQuestionInputs(false);
        }
    },

    // --- General Settings Handlers ---
    updateExamTitle: function() {
        ExamState.examTitle = UI.elements.examTitleInput.value.trim() || 'מבחן בגרות';
        UI.elements.previewExamTitle.textContent = ExamState.examTitle;
    },

    updateInstructionsPreview: function() {
        const text = UI.elements.examInstructions.value;
        ExamState.instructions.general = text;
        if (text.trim()) {
            UI.elements.previewInstructionsBox.style.display = 'block';
            UI.elements.previewInstructionsBox.textContent = text;
        } else {
            UI.elements.previewInstructionsBox.style.display = 'none';
        }
    },

    updateFilenamePreview: function() {
        ExamState.studentName = UI.elements.studentNameInput.value.trim();
        const name = ExamState.studentName || 'תלמיד';
        UI.elements.filenamePreview.textContent = `${name} - מבחן.html`;
    },

    handleLogoUpload: function(event) {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(e) {
                ExamState.logoData = e.target.result;
                UI.elements.previewLogo.src = ExamState.logoData;
                UI.elements.previewLogo.style.display = 'block';
            };
            reader.readAsDataURL(file);
        }
    },

    handleSolutionUpload: function(event) {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(e) {
                ExamState.solutionDataUrl = e.target.result;
                UI.showToast('קובץ הפתרון נטען בהצלחה');
            };
            reader.readAsDataURL(file);
        }
    }
};

// === START APP ===
window.onload = function() {
    App.init();
};
