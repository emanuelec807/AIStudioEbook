// --- GESTIONE TEMA (Chiaro/Scuro) ---
function toggleTheme() {
    const body = document.body;
    const icon = document.getElementById('theme-icon');
    if (body.getAttribute('data-theme') === 'dark') {
        body.removeAttribute('data-theme');
        icon.innerText = 'dark_mode';
        localStorage.setItem('theme', 'light');
    } else {
        body.setAttribute('data-theme', 'dark');
        icon.innerText = 'light_mode';
        localStorage.setItem('theme', 'dark');
    }
}

// All'avvio, controlla se c'era il tema scuro salvato
if (localStorage.getItem('theme') === 'dark') {
    document.body.setAttribute('data-theme', 'dark');
    document.getElementById('theme-icon').innerText = 'light_mode';
}

// --- LOGICA APPLICAZIONE ---
let chapterCount = 0;
let datiCapitoli = {};
const lingueBase = ['en', 'it', 'es', 'fr', 'ja', 'zh', 'hi', 'pt'];

window.onload = () => aggiungiCapitolo();

function aggiornaInterfacciaGlobale() {
    const isKokoro = document.getElementById('kokoro').checked;
    const isQwen06 = document.getElementById('qwen_tts_06') ? document.getElementById('qwen_tts_06').checked : false;
    const isQwen17 = document.getElementById('qwen_tts_17') ? document.getElementById('qwen_tts_17').checked : false;
    const isQwen = isQwen06 || isQwen17; 
    const selects = document.querySelectorAll('.voice-select-dynamic');
    
    selects.forEach(select => {
        const id = select.dataset.chapterId;
        const voceAttuale = datiCapitoli[id].voce;
        const linguaAttiva = datiCapitoli[id].linguaAttiva; // <- LEGGIAMO LA LINGUA DEL TAB
        select.innerHTML = ''; 
        
        if (isKokoro) {
            // MOSTRIAMO LE VOCI IN BASE AL TAB SELEZIONATO
            if (linguaAttiva === 'it') {
                select.innerHTML = `
                    <option value="if_sara">Sara (🇮🇹 IT Fem)</option>
                    <option value="im_nicola">Nicola (🇮🇹 IT Masc)</option>
                `;
            } else if (linguaAttiva === 'en') {
                select.innerHTML = `
                    <option value="af_bella">Bella (🇺🇸 EN Fem)</option>
                    <option value="af_sarah">Sarah (🇺🇸 EN Fem)</option>
                    <option value="am_adam">Adam (🇺🇸 EN Masc)</option>
                `;
            } else if (linguaAttiva === 'fr') {
                select.innerHTML = `<option value="ff_siwis">Siwis (🇫🇷 FR Fem)</option>`;
            } else if (linguaAttiva === 'es') {
                select.innerHTML = `<option value="ef_dora">Dora (🇪🇸 ES Fem)</option>`;
            } else {
                select.innerHTML = `<option value="if_sara">Sara (Default)</option>`;
            }

            // Se la voce che era selezionata prima non esiste per questa nuova lingua, 
            // impostiamo la prima voce disponibile della lista.
            let voceValida = Array.from(select.options).some(opt => opt.value === voceAttuale);
            if (!voceValida) {
                datiCapitoli[id].voce = select.options[0].value;
            }

        } else if (isQwen) {
            select.innerHTML = `
                <option value="clone_base">Clonazione (Usa file voce_rif.wav)</option>
            `;
            datiCapitoli[id].voce = 'clone_base';
        } else {
            select.innerHTML = `
                <option value="xtts_female">Preset Femminile (voce_rif_female.wav)</option>
                <option value="xtts_male">Preset Maschile (voce_rif_male.wav)</option>
                <option value="xtts_custom">Voice Clone (Voce Caricata)</option>
            `;
        select.value = datiCapitoli[id].voce;
        
        // Aggiorna visibilità del box Voice Clone sotto Genera Audio
        const cloneBox = document.getElementById(`voice-clone-container-${id}`);
        if (cloneBox) {
            if (!isKokoro && !isQwen && datiCapitoli[id].voce === 'xtts_custom') {
                cloneBox.style.display = 'block';
            } else {
                cloneBox.style.display = 'none';
            }
        }
    });
}

function cambiaVoceCapitolo(id, value) {
    if (datiCapitoli[id]) {
        datiCapitoli[id].voce = value;
    }
    const cloneBox = document.getElementById(`voice-clone-container-${id}`);
    if (cloneBox) {
        const isXtts = document.getElementById('xtts') && document.getElementById('xtts').checked;
        if (isXtts && value === 'xtts_custom') {
            cloneBox.style.display = 'block';
        } else {
            cloneBox.style.display = 'none';
        }
    }
}

function salvaTestoCorrente(id) {
    if (datiCapitoli[id]) {
        const linguaAttiva = datiCapitoli[id].linguaAttiva;
        datiCapitoli[id].testi[linguaAttiva] = document.getElementById(`testo-${id}`).value;
    }
}

function cambiaLingua(id, nuovaLingua) {
    salvaTestoCorrente(id);
    datiCapitoli[id].linguaAttiva = nuovaLingua;
    document.getElementById(`testo-${id}`).value = datiCapitoli[id].testi[nuovaLingua] || "";
    
    document.querySelectorAll(`#tabs-${id} .md-tab`).forEach(btn => btn.classList.remove('active'));
    document.getElementById(`tab-${id}-${nuovaLingua}`).classList.add('active');

    aggiornaInterfacciaGlobale();
}

function aggiungiCapitolo(datiEsistenti = null) {
    chapterCount++;
    const id = chapterCount;

    if (datiEsistenti) {
        datiCapitoli[id] = datiEsistenti;
    } else {
        datiCapitoli[id] = {
            titolo: `Capitolo ${id}`,
            linguaAttiva: 'it',
            testi: { 'en': '', 'it': '', 'es': '', 'fr': '', 'ja': '', 'zh': '', 'hi': '', 'pt': '' },
            voce: document.getElementById('kokoro').checked ? 'if_sara' : 'xtts_female'
        };
    }

    const container = document.getElementById("chaptersContainer");
    const chapterDiv = document.createElement("div");
    chapterDiv.className = "md-card";
    chapterDiv.id = `capitolo-container-${id}`;

    let tabsHTML = `<div class="md-tabs" id="tabs-${id}">`;
    lingueBase.forEach(lang => {
        const isActive = (lang === datiCapitoli[id].linguaAttiva) ? 'active' : '';
        tabsHTML += `<button id="tab-${id}-${lang}" class="md-tab ${isActive}" onclick="cambiaLingua(${id}, '${lang}')">${lang.toUpperCase()}</button>`;
    });
    tabsHTML += `</div>`;

    chapterDiv.innerHTML = `
        <div class="card-header">
            <input type="text" class="card-title-input" placeholder="Titolo del capitolo..." value="${datiCapitoli[id].titolo}" id="titolo-${id}" oninput="datiCapitoli[${id}].titolo = this.value">
            <button class="icon-btn" onclick="rimuoviCapitolo(${id})" title="Elimina Blocco">
                <span class="material-symbols-outlined">delete</span>
            </button>
        </div>
        
        ${tabsHTML}
        
        <div class="card-content">
            <textarea class="md-textarea" id="testo-${id}" placeholder="Incolla il testo qui..." oninput="salvaTestoCorrente(${id})">${datiCapitoli[id].testi[datiCapitoli[id].linguaAttiva] || ''}</textarea>
            
            <div class="action-surface">
                <div class="action-row">
                    <div style="display: flex; gap: 12px;">
                        <div class="md-text-field" style="width: 120px; background: transparent; border: none; padding: 0;">
                            <label>Da:</label>
                            <select id="src-lang-${id}" style="border-bottom: 1px solid var(--md-sys-color-outline-variant); padding-bottom: 4px;">
                                <option value="en" selected>Inglese</option>
                                <option value="it">Italiano</option>
                                <option value="es">Spagnolo</option>
                                <option value="fr">Francese</option>
                                <option value="ja">Giapponese</option>
                                <option value="zh">Cinese</option>
                                <option value="hi">Hindi</option>
                                <option value="pt">Portoghese</option>
                            </select>
                        </div>
                        <div class="md-text-field" style="width: 120px; background: transparent; border: none; padding: 0;">
                            <label>A:</label>
                            <select id="target-lang-${id}" style="border-bottom: 1px solid var(--md-sys-color-outline-variant); padding-bottom: 4px;">
                                <option value="it" selected>Italiano</option>
                                <option value="en">Inglese</option>
                                <option value="es">Spagnolo</option>
                                <option value="fr">Francese</option>
                                <option value="ja">Giapponese</option>
                                <option value="zh">Cinese</option>
                                <option value="hi">Hindi</option>
                                <option value="pt">Portoghese</option>
                            </select>
                        </div>
                    </div>
                    <button class="md-btn md-btn-tonal" onclick="richiediTraduzione(${id})">
                        <span class="material-symbols-outlined">translate</span> Traduci
                    </button>
                </div>
                <div id="status-trad-${id}" class="status-text"></div>
            </div>

            <div class="action-surface">
                <div class="action-row">
                    <div class="md-text-field" style="width: auto; background: transparent; border: none; padding: 0;">
                        <label>Voce:</label>
                        <select id="voice-select-${id}" class="voice-select-dynamic" data-chapter-id="${id}" onchange="cambiaVoceCapitolo(${id}, this.value)" style="border-bottom: 1px solid var(--md-sys-color-outline-variant); padding-bottom: 4px;"></select>
                    </div>
                    <button id="btn-genera-${id}" class="md-btn md-btn-primary" onclick="generaAudio(${id})">
                        <span class="material-symbols-outlined">record_voice_over</span> Genera Audio
                    </button>
                </div>
                
                <div id="voice-clone-container-${id}" style="display: none; margin-top: 10px; padding: 10px 14px; background-color: var(--md-sys-color-surface-container-high); border-radius: 8px; border: 1px dashed var(--md-sys-color-outline);">
                    <div style="display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap;">
                        <span style="font-size: 13px; color: var(--md-sys-color-on-surface-variant); display: flex; align-items: center;">
                            <span class="material-symbols-outlined" style="font-size: 18px; margin-right: 6px; color: var(--md-sys-color-primary);">mic</span> File di riferimento (.wav):
                        </span>
                        <input type="file" id="xtts-voice-file-${id}" style="display:none;" accept=".wav" onchange="caricaVocePersonalizzata(event, ${id})">
                        <button class="md-btn md-btn-tonal" style="padding: 6px 14px; font-size: 12px;" onclick="document.getElementById('xtts-voice-file-${id}').click()">
                            <span class="material-symbols-outlined" style="font-size: 16px;">upload</span> Carica Voce (.wav)
                        </button>
                    </div>
                    <div id="status-clone-file-${id}" style="font-size: 12px; margin-top: 4px; color: var(--md-sys-color-primary); font-weight: 500;"></div>
                </div>
                
                <div id="status-audio-${id}" class="status-text"></div>
                <div id="audio-player-${id}" style="display:flex; flex-direction:column; gap:10px;"></div>
            </div>
        </div>
    `;

    container.insertBefore(chapterDiv, container.lastElementChild);
    aggiornaInterfacciaGlobale();
}

function rimuoviCapitolo(id) {
    if (confirm("Vuoi davvero eliminare questo capitolo?")) {
        document.getElementById(`capitolo-container-${id}`).remove();
        delete datiCapitoli[id];
    }
}

// --- API SERVER ---
const API_BASE = window.location.protocol === 'file:' ? 'http://127.0.0.1:5000' : '';

async function richiediTraduzione(id) {
    salvaTestoCorrente(id);
    const linguaSorgente = document.getElementById(`src-lang-${id}`).value;
    const linguaDestinazione = document.getElementById(`target-lang-${id}`).value;
    const testoSorgente = datiCapitoli[id].testi[linguaSorgente];
    const modelloLLM = document.querySelector('input[name="llm_model"]:checked').value;
    const statusDiv = document.getElementById(`status-trad-${id}`);

    if (!testoSorgente || !testoSorgente.trim()) return alert(`Il testo in ${linguaSorgente.toUpperCase()} è vuoto!`);
    
    statusDiv.innerHTML = `<span class="material-symbols-outlined spin" style="color:var(--md-sys-color-primary);">autorenew</span> Traduzione in corso...`;

    try {
        const response = await fetch(`${API_BASE}/translate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: testoSorgente, src_lang: linguaSorgente, tgt_lang: linguaDestinazione, model: modelloLLM })
        });

        const data = await response.json();
        if (data.translated_text) {
            datiCapitoli[id].testi[linguaDestinazione] = data.translated_text;
            statusDiv.innerHTML = `<span class="material-symbols-outlined" style="color:var(--md-sys-color-primary);">check_circle</span> Tradotto in ${linguaDestinazione.toUpperCase()}`;
            
            if (datiCapitoli[id].linguaAttiva === linguaDestinazione) {
                document.getElementById(`testo-${id}`).value = data.translated_text;
            } else {
                cambiaLingua(id, linguaDestinazione);
            }
        } else {
            throw new Error(data.error);
        }
    } catch (error) {
        statusDiv.innerHTML = `<span class="material-symbols-outlined" style="color:var(--md-sys-color-error);">error</span> Errore: ${error.message}`;
    }
}

async function generaAudio(id) {
    salvaTestoCorrente(id);
    const linguaAttiva = datiCapitoli[id].linguaAttiva;
    const testo = datiCapitoli[id].testi[linguaAttiva];
    const voceScelta = datiCapitoli[id].voce;
    
    const statusDiv = document.getElementById(`status-audio-${id}`);
    const playerDiv = document.getElementById(`audio-player-${id}`);

    if (!testo || !testo.trim()) return alert("Il testo per l'audio è vuoto!");

    statusDiv.innerHTML = `<span class="material-symbols-outlined spin" style="color:var(--md-sys-color-primary);">autorenew</span> Generazione in corso...`;
    playerDiv.innerHTML = ""; 

    let endpoint = '/generate_xtts';
    let qwenVersion = '0.6b';

    if (document.getElementById('kokoro').checked) {
        endpoint = '/generate_kokoro';
    } else if (document.getElementById('qwen_tts_06') && document.getElementById('qwen_tts_06').checked) {
        endpoint = '/generate_qwen_tts';
        qwenVersion = '0.6b';
    } else if (document.getElementById('qwen_tts_17') && document.getElementById('qwen_tts_17').checked) {
        endpoint = '/generate_qwen_tts';
        qwenVersion = '1.7b';
    }

    try {
        const response = await fetch(`${API_BASE}${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                text: testo, 
                voice: voceScelta, 
                capitolo_id: id, 
                lang: linguaAttiva,
                qwen_version: qwenVersion
            })
        });

        if (!response.ok) throw new Error("Errore nel server Python");
        
        const blob = await response.blob();
        const audioUrl = URL.createObjectURL(blob);

        statusDiv.innerHTML = `<span class="material-symbols-outlined" style="color:var(--md-sys-color-primary);">task_alt</span> Audio e MP3 salvati sul Server!`;
        playerDiv.innerHTML = `
            <audio controls><source src="${audioUrl}" type="audio/wav"></audio>
            <a href="${audioUrl}" download="Capitolo_${id}_${linguaAttiva}.wav" class="md-btn md-btn-tonal" style="text-decoration:none;">
                <span class="material-symbols-outlined">download</span> Scarica .WAV
            </a>
        `;
    } catch (error) {
        statusDiv.innerHTML = `<span class="material-symbols-outlined" style="color:var(--md-sys-color-error);">error</span> Errore: ${error.message}`;
    }
}

// --- SALVATAGGIO ED EPUB ---
function raccogliDatiProgetto() {
    Object.keys(datiCapitoli).forEach(id => salvaTestoCorrente(id));
    const projectData = { 
        title: document.getElementById("titolo-libro").value, 
        author: document.getElementById("autore-libro").value, 
        chapters: [] 
    };
    document.querySelectorAll('.md-card').forEach(chap => {
        const id = chap.id.replace('capitolo-container-', '');
        projectData.chapters.push(datiCapitoli[id]);
    });
    return projectData;
}

function salvaProgettoLocalmente() {
    const projectData = raccogliDatiProgetto();
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(projectData));
    const a = document.createElement('a');
    a.href = dataStr;
    a.download = projectData.title.replace(/\s+/g, '_') + "_Progetto.json";
    a.click();
}

function caricaProgetto(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        const projectData = JSON.parse(e.target.result);
        document.getElementById("titolo-libro").value = projectData.title || "";
        document.getElementById("autore-libro").value = projectData.author || "";
        
        const container = document.getElementById("chaptersContainer");
        const blocks = container.querySelectorAll('.md-card');
        blocks.forEach(b => b.remove());
        
        datiCapitoli = {};
        chapterCount = 0;
        projectData.chapters.forEach(chapData => aggiungiCapitolo(chapData));
    };
    reader.readAsText(file);
    event.target.value = '';
}

async function esportaEpubESalvaSulServer() {
    const projectData = raccogliDatiProgetto();
    
    const chaptersToExport = projectData.chapters.map(cap => {
        return { title: cap.titolo, content: cap.testi[cap.linguaAttiva] };
    }).filter(cap => cap.content.trim() !== "");

    if (chaptersToExport.length === 0) return alert("Nessun testo trovato per l'esportazione!");

    alert("Invio al server in corso... Il file EPUB e il JSON verranno salvati nella cartella 'audiolibriEpub'.");

    try {
        const response = await fetch(`${API_BASE}/save_and_export`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                book_title: projectData.title, 
                book_author: projectData.author,
                chapters: chaptersToExport,
                full_project: projectData 
            })
        });

        if (!response.ok) throw new Error("Errore server durante la creazione.");

        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${projectData.title}.epub`;
        a.click();
        URL.revokeObjectURL(url);
        
        alert("✅ Salvataggio completato ed EPUB scaricato!");
    } catch (error) {
        alert(`❌ Errore: ${error.message}`);
    }
}

async function importaEpub(event) {
    const file = event.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    alert("Estrazione testo e metadati dall'EPUB in corso... attendi.");

    try {
        const response = await fetch(`${API_BASE}/import_epub`, {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            throw new Error(`Il server ha restituito un errore ${response.status}.`);
        }

        const data = await response.json();
        if (data.error) throw new Error(data.error);

        if (data.detected_title) document.getElementById('titolo-libro').value = data.detected_title;
        if (data.detected_author) document.getElementById('autore-libro').value = data.detected_author;

        let lang = prompt(`Lingua rilevata: ${data.detected_lang}. Confermi?`, data.detected_lang) || 'it';
        
        if(confirm("Vuoi cancellare i blocchi attuali?")) {
            const container = document.getElementById("chaptersContainer");
            const blocks = container.querySelectorAll('.md-card');
            blocks.forEach(b => b.remove());
            datiCapitoli = {};
            chapterCount = 0;
        }

        data.chapters.forEach(c => {
            const voceAutomatica = document.getElementById('kokoro').checked ? 'if_sara' : 'xtts_female';
            aggiungiCapitolo({
                titolo: c.titolo,
                linguaAttiva: lang,
                testi: { 'en': '', 'it': '', 'es': '', 'fr': '', 'ja': '', 'zh': '', 'hi': '', 'pt': '', [lang]: c.contenuto },
                voce: voceAutomatica
            });
        });
    } catch (err) {
        alert("Errore durante l'importazione: " + err.message);
    }
    event.target.value = '';
}

// --- LOGICA BATCH (GENERAZIONE IN CODA) ---
function aggiornaVociBatch() {
    const isKokoro = document.getElementById('kokoro').checked;
    const isQwen06 = document.getElementById('qwen_tts_06') ? document.getElementById('qwen_tts_06').checked : false;
    const isQwen17 = document.getElementById('qwen_tts_17') ? document.getElementById('qwen_tts_17').checked : false;
    const isQwen = isQwen06 || isQwen17;
    
    const selectVoice = document.getElementById('batch-voice');
    const linguaAttiva = document.getElementById('batch-lang').value;
    
    selectVoice.innerHTML = '';
    
    if (isKokoro) {
        if (linguaAttiva === 'it') {
            selectVoice.innerHTML = `<option value="if_sara">Sara (🇮🇹 IT Fem)</option><option value="im_nicola">Nicola (🇮🇹 IT Masc)</option>`;
        } else if (linguaAttiva === 'en') {
            selectVoice.innerHTML = `<option value="af_bella">Bella (🇺🇸 EN Fem)</option><option value="af_sarah">Sarah (🇺🇸 EN Fem)</option><option value="am_adam">Adam (🇺🇸 EN Masc)</option>`;
        } else if (linguaAttiva === 'fr') {
            selectVoice.innerHTML = `<option value="ff_siwis">Siwis (🇫🇷 FR Fem)</option>`;
        } else if (linguaAttiva === 'es') {
            selectVoice.innerHTML = `<option value="ef_dora">Dora (🇪🇸 ES Fem)</option>`;
        } else if (linguaAttiva === 'ja') {
            selectVoice.innerHTML = `<option value="jf_alpha">Alpha (🇯🇵 JA Fem)</option><option value="jm_kumo">Kumo (🇯🇵 JA Masc)</option>`;
        } else if (linguaAttiva === 'zh') {
            selectVoice.innerHTML = `<option value="zf_xiaobei">Xiaobei (🇨🇳 ZH Fem)</option><option value="zm_yunjian">Yunjian (🇨🇳 ZH Masc)</option>`;
        } else if (linguaAttiva === 'hi') {
            selectVoice.innerHTML = `<option value="hf_alpha">Alpha (🇮🇳 HI Fem)</option><option value="hm_omega">Omega (🇮🇳 HI Masc)</option>`;
        } else if (linguaAttiva === 'pt') {
            selectVoice.innerHTML = `<option value="pf_dora">Dora (🇧🇷 PT Fem)</option><option value="pm_alex">Alex (🇧🇷 PT Masc)</option>`;
        } else {
            selectVoice.innerHTML = `<option value="if_sara">Sara (Default)</option>`;
        }
    } else if (isQwen) {
        selectVoice.innerHTML = `<option value="clone_base">Clonazione (Usa file voce_rif.wav)</option>`;
    } else {
        // È selezionato XTTSv2
        selectVoice.innerHTML = `
            <option value="xtts_female">Preset Femminile (voce_rif_female.wav)</option>
            <option value="xtts_male">Preset Maschile (voce_rif_male.wav)</option>
            <option value="xtts_custom">Voice Clone (Voce Caricata)</option>
        `;
    }
}

function apriModaleBatch() {
    const modale = document.getElementById('modale-batch');
    const lista = document.getElementById('lista-capitoli-batch');
    lista.innerHTML = ''; 

    const capitoliIds = Object.keys(datiCapitoli);
    if(capitoliIds.length === 0) return alert("Nessun capitolo disponibile.");

    capitoliIds.forEach(id => {
        lista.innerHTML += `
            <label style="display:flex; align-items:center; gap:8px; margin-bottom: 8px;">
                <input type="checkbox" class="batch-checkbox" value="${id}" checked>
                ${datiCapitoli[id].titolo}
            </label>
        `;
    });
    
    aggiornaVociBatch();
    modale.showModal();
}

function chiudiModaleBatch() {
    document.getElementById('modale-batch').close();
}

async function avviaCodaAudio() {
    const linguaScelta = document.getElementById('batch-lang').value;
    const voceSceltaDalBatch = document.getElementById('batch-voice').value;
    const checkboxes = document.querySelectorAll('.batch-checkbox:checked');
    const idsToProcess = Array.from(checkboxes).map(cb => cb.value);
    
    if(idsToProcess.length === 0) return alert("Seleziona almeno un capitolo!");

    chiudiModaleBatch();
    alert(`Inizio generazione in coda (${linguaScelta.toUpperCase()})...`);

    for (let i = 0; i < idsToProcess.length; i++) {
        const id = idsToProcess[i];
        let endpoint = '/generate_xtts';
        let qwenVersion = '0.6b';

        if (document.getElementById('kokoro').checked) {
            endpoint = '/generate_kokoro';
        } else if (document.getElementById('qwen_tts_06') && document.getElementById('qwen_tts_06').checked) {
            endpoint = '/generate_qwen_tts';
            qwenVersion = '0.6b';
        } else if (document.getElementById('qwen_tts_17') && document.getElementById('qwen_tts_17').checked) {
            endpoint = '/generate_qwen_tts';
            qwenVersion = '1.7b';
        }

        const testoDaLeggere = datiCapitoli[id].testi[linguaScelta];
        const statusDiv = document.getElementById(`status-audio-${id}`);

        if(!testoDaLeggere || !testoDaLeggere.trim()) {
            if(statusDiv) statusDiv.innerHTML = `Testo vuoto in ${linguaScelta}, saltato.`;
            continue;
        }

        if(statusDiv) statusDiv.innerHTML = `In coda batch...`;

        try {
            const response = await fetch(`${API_BASE}${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    text: testoDaLeggere, 
                    voice: voceSceltaDalBatch, 
                    capitolo_id: id, 
                    lang: linguaScelta,
                    qwen_version: qwenVersion 
                })
            });

            if (response.ok) {
                const blob = await response.blob();
                const audioUrl = URL.createObjectURL(blob);
                const playerDiv = document.getElementById(`audio-player-${id}`);
                
                if(statusDiv) statusDiv.innerHTML = `<span class="material-symbols-outlined" style="color:var(--md-sys-color-primary);">task_alt</span> Generato (Batch)!`;
                if(playerDiv) {
                    playerDiv.innerHTML = `
                        <audio controls><source src="${audioUrl}" type="audio/wav"></audio>
                        <a href="${audioUrl}" download="Capitolo_${id}_${linguaScelta}.wav" class="md-btn md-btn-tonal" style="text-decoration:none;">
                            <span class="material-symbols-outlined">download</span> Scarica .WAV
                        </a>
                    `;
                }
            } else {
                throw new Error("Errore server");
            }
        } catch(err) {
            if(statusDiv) statusDiv.innerHTML = `<span class="material-symbols-outlined" style="color:var(--md-sys-color-error);">error</span> Errore batch: ${err.message}`;
        }
    }
    
    alert("🎉 Generazione in coda terminata!");
}

// --- LOGICA AUDIOLIBRO COMPLETO UNIFICATO ---
function aggiornaVociAudiolibro() {
    const isKokoro = document.getElementById('kokoro').checked;
    const selectVoice = document.getElementById('audiobook-voice');
    const linguaAttiva = document.getElementById('audiobook-lang').value;
    
    selectVoice.innerHTML = '';
    
    if (isKokoro) {
        if (linguaAttiva === 'it') { selectVoice.innerHTML = `<option value="if_sara">Sara (🇮🇹 IT Fem)</option><option value="im_nicola">Nicola (🇮🇹 IT Masc)</option>`; }
        else if (linguaAttiva === 'en') { selectVoice.innerHTML = `<option value="af_bella">Bella (🇺🇸 EN Fem)</option><option value="af_sarah">Sarah (🇺🇸 EN Fem)</option><option value="am_adam">Adam (🇺🇸 EN Masc)</option>`; }
        else if (linguaAttiva === 'fr') { selectVoice.innerHTML = `<option value="ff_siwis">Siwis (🇫🇷 FR Fem)</option>`; }
        else if (linguaAttiva === 'es') { selectVoice.innerHTML = `<option value="ef_dora">Dora (🇪🇸 ES Fem)</option>`; }
        else if (linguaAttiva === 'ja') { selectVoice.innerHTML = `<option value="jf_alpha">Alpha (🇯🇵 JA Fem)</option><option value="jm_kumo">Kumo (🇯🇵 JA Masc)</option>`; }
        else if (linguaAttiva === 'zh') { selectVoice.innerHTML = `<option value="zf_xiaobei">Xiaobei (🇨🇳 ZH Fem)</option><option value="zm_yunjian">Yunjian (🇨🇳 ZH Masc)</option>`; }
        else if (linguaAttiva === 'hi') { selectVoice.innerHTML = `<option value="hf_alpha">Alpha (🇮🇳 HI Fem)</option><option value="hm_omega">Omega (🇮🇳 HI Masc)</option>`; }
        else if (linguaAttiva === 'pt') { selectVoice.innerHTML = `<option value="pf_dora">Dora (🇧🇷 PT Fem)</option><option value="pm_alex">Alex (🇧🇷 PT Masc)</option>`; }
        else { selectVoice.innerHTML = `<option value="if_sara">Sara (Default)</option>`; }
    } else {
        selectVoice.innerHTML = `
            <option value="xtts_female">Preset Femminile (voce_rif_female.wav)</option>
            <option value="xtts_male">Preset Maschile (voce_rif_male.wav)</option>
            <option value="xtts_custom">Voice Clone (Voce Caricata)</option>
        `;
    }
}

function apriModaleAudiolibro() {
    const capitoliIds = Object.keys(datiCapitoli);
    if(capitoliIds.length === 0) return alert("Devi aggiungere almeno un capitolo prima di creare il libro intero.");
    
    aggiornaVociAudiolibro();
    document.getElementById('modale-audiolibro').showModal();
}

async function avviaAudiolibroCompleto() {
    const linguaScelta = document.getElementById('audiobook-lang').value;
    const voceScelta = document.getElementById('audiobook-voice').value;
    const modalBody = document.getElementById('modale-audiolibro');

    let testoInteroLibro = "";
    let conteggioCapitoli = 0;
    
    const cards = document.querySelectorAll('.md-card');
    cards.forEach(card => {
        const id = card.id.replace('capitolo-container-', '');
        const titolo = datiCapitoli[id].titolo;
        const testo = datiCapitoli[id].testi[linguaScelta];

        if (testo && testo.trim() !== "") {
            testoInteroLibro += titolo + ".\n\n" + testo + "\n\n";
            conteggioCapitoli++;
        }
    });

    if (conteggioCapitoli === 0) return alert("Nessun testo trovato nella lingua selezionata!");

    modalBody.innerHTML = `
        <div style="text-align: center; padding: 20px;">
            <h2 style="color: var(--md-sys-color-primary);">⏳ Generazione in corso...</h2>
            <p>Sto unendo ${conteggioCapitoli} capitoli (${linguaScelta.toUpperCase()}).</p>
            <div style="margin: 30px 0;">
                <span class="material-symbols-outlined spin" style="font-size: 64px; color: var(--md-sys-color-primary);">autorenew</span>
            </div>
            <p style="color: var(--md-sys-color-outline); font-size: 14px;">
                Questa operazione richiederà molto tempo. Lascia questa finestra aperta!
            </p>
        </div>
    `;

    let endpoint = '/generate_xtts';
    if (document.getElementById('kokoro').checked) {
        endpoint = '/generate_kokoro';
    }

    try {
        const response = await fetch(`${API_BASE}${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                text: testoInteroLibro, 
                voice: voceScelta, 
                capitolo_id: "INTERO_LIBRO", 
                lang: linguaScelta
            })
        });

        if (response.ok) {
            const blob = await response.blob();
            const audioUrl = URL.createObjectURL(blob);
            
            modalBody.innerHTML = `
                <div style="text-align: center; padding: 20px;">
                    <h2 style="color: var(--md-sys-color-primary);">🎉 Audiolibro Completato!</h2>
                    <p style="margin-bottom: 20px;">Il tuo master unico è pronto per il download.</p>
                    <audio controls src="${audioUrl}" style="width: 100%; margin-bottom: 24px;"></audio>
                    <div style="display: flex; gap: 12px; justify-content: center;">
                        <button class="md-btn md-btn-outlined" onclick="location.reload()">Chiudi</button>
                        <a href="${audioUrl}" download="Audiolibro_Completo_${linguaScelta}.wav" class="md-btn md-btn-primary" style="text-decoration:none;">
                            <span class="material-symbols-outlined">download</span> Scarica .WAV Unico
                        </a>
                    </div>
                </div>
            `;
        } else {
            modalBody.innerHTML = `
                <div style="text-align: center; padding: 20px;">
                    <span class="material-symbols-outlined" style="font-size: 48px; color: var(--md-sys-color-error);">error</span>
                    <h2>Errore di generazione</h2>
                    <button class="md-btn md-btn-outlined" style="margin-top: 16px;" onclick="location.reload()">Chiudi</button>
                </div>
            `;
        }
    } catch (error) {
        console.error("Errore:", error);
        modalBody.innerHTML = `
            <div style="text-align: center; padding: 20px;">
                <span class="material-symbols-outlined" style="font-size: 48px; color: var(--md-sys-color-error);">wifi_off</span>
                <h2>Errore di Connessione</h2>
                <button class="md-btn md-btn-outlined" style="margin-top: 16px;" onclick="location.reload()">Chiudi</button>
            </div>
        `;
    }
}

async function caricaVocePersonalizzata(event, id = null) {
    const file = event.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    const statusEl = id ? document.getElementById(`status-clone-file-${id}`) : null;
    if (statusEl) statusEl.innerHTML = `⏳ Caricamento di <em>${file.name}</em>...`;

    try {
        const response = await fetch(`${API_BASE}/upload_voice`, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            throw new Error(`Errore del server durante il caricamento: ${response.status}`);
        }

        const data = await response.json();
        if (data.error) throw new Error(data.error);

        // Aggiorna lo stato in tutti i box clone attivi
        document.querySelectorAll('[id^="status-clone-file-"]').forEach(el => {
            el.innerHTML = `✅ Voce di riferimento caricata: <strong>${file.name}</strong>`;
        });
        
    } catch (err) {
        if (statusEl) {
            statusEl.innerHTML = `<span style="color: var(--md-sys-color-error);">❌ Errore: ${err.message}</span>`;
        } else {
            alert("Errore durante il caricamento della voce: " + err.message);
        }
        console.error(err);
    }

    event.target.value = '';
}
