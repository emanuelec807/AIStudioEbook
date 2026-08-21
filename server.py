import sys
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except AttributeError:
        pass

import os
os.environ["COQUI_TOS_AGREED"] = "1"
import json
import re
import gc
import requests
from threading import Lock
import numpy as np
import torch
import soundfile as sf
from pydub import AudioSegment
from ebooklib import epub
from bs4 import BeautifulSoup
from flask import Flask, request, send_file, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# Global models and locks
xtts_model = None
kokoro_pipelines = {}
traduzione_lock = Lock()
audio_lock = Lock()

# --- HELPER FUNCTIONS FOR TEXT SPLITTING & PROCESSING ---
def dividi_testo_xtts(testo, limite=180):
    # Divide il testo per frasi corte, gestendo punteggiatura comune e asiatica
    pattern = r'([^.!?。！？\n]+[.!?。！？]*)'
    pezzi = re.findall(pattern, testo)
    
    frasi_finali = []
    for pezzo in pezzi:
        pezzo = pezzo.strip()
        if not pezzo:
            continue
        
        # Se un blocco supera il limite di caratteri, lo spezziamo sulle virgole/pause minori
        if len(pezzo) > limite:
            sotto_pezzi = re.split(r'([,;，、\s]{2,}|[,;，、])', pezzo)
            accumulo = ""
            for sp in sotto_pezzi:
                if len(accumulo) + len(sp) > limite:
                    if accumulo.strip():
                        frasi_finali.append(accumulo.strip())
                    accumulo = sp
                else:
                    accumulo += sp
            if accumulo.strip():
                frasi_finali.append(accumulo.strip())
        else:
            frasi_finali.append(pezzo)
            
    # Mantiene le pause tra i paragrafi
    righe = testo.split('\n')
    risultato = []
    for riga in righe:
        if not riga.strip():
            continue
        frasi_riga = []
        for f in frasi_finali:
            if f in riga:
                frasi_riga.append(f)
        risultato.extend(frasi_riga)
        risultato.append("___PAUSA_PARAGRAFO___")
        
    if risultato and risultato[-1] == "___PAUSA_PARAGRAFO___":
        risultato.pop()
        
    return risultato

def dividi_testo_kokoro(testo):
    # Divide il testo in base a frasi logiche e pause minori per Kokoro
    pattern = r'([^.!?,;:。！？\n]+[.!?,;:。！？]*)'
    pezzi = re.findall(pattern, testo)
    
    risultato = []
    righe = testo.split('\n')
    for riga in righe:
        if not riga.strip():
            continue
        for pezzo in pezzi:
            if pezzo.strip() and pezzo in riga:
                risultato.append(pezzo.strip())
        risultato.append("___PAUSA_PARAGRAFO___")
        
    if risultato and risultato[-1] == "___PAUSA_PARAGRAFO___":
        risultato.pop()
    return risultato

def correggi_pronuncia(testo):
    # Correzioni fonetiche hardcoded per nomi inglesi comuni
    correzioni = {
        r'\bBeau\b': 'Bo',
        r'\bCullen\b': 'Callen',
        r'\bCharlie\b': 'Ciarli',
        r'\bSwan\b': 'Suan',
        r'\bForks\b': 'Forcs',
        r'\bChief\b': 'Scief',
        r'\bBilly\b': 'Billi',
        r'\bJacob\b': 'Giacob',
        r'\bJessica\b': 'Gessica',
        r'\bAngela\b': 'Angiela',
        r'\bMike\b': 'Maik',
        r'\bNewton\b': 'Niuton',
        r'\bEric\b': 'Erics',
        r'\bBella\b': 'Bella',
        r'\bEdward\b': 'Eduard',
        r'\bAlice\b': 'Alis',
        r'\bJasper\b': 'Giasper',
        r'\bRosalie\b': 'Rosali',
        r'\bEmmett\b': 'Emmet',
        r'\bCarlisle\b': 'Carlail',
        r'\bEsme\b': 'Esme',
        r'\bAro\b': 'Aro',
        r'\bMarcus\b': 'Marcus',
        r'\bCaius\b': 'Caius',
        r'\bJane\b': 'Gein',
        r'\bAlec\b': 'Alec',
        r'\bDemetri\b': 'Demetri',
        r'\bFelix\b': 'Felix',
        r'\bVictoria\b': 'Vittoria',
        r'\bLaurent\b': 'Loran',
        r'\bJames\b': 'Geims',
        r'\bBree\b': 'Bri',
        r'\bRiley\b': 'Raili'
    }
    for pattern, sostituto in correzioni.items():
        testo = re.sub(pattern, sostituto, testo, flags=re.IGNORECASE)
    return testo

def applica_glossario(testo):
    # Glossario standard per traduzioni letterarie
    glossario = {
        r'\bGramps\b': 'Nonno',
        r'\bMom\b': 'Mamma',
        r'\bDad\b': 'Papà',
        r'\bhoney\b': 'tesoro',
        r'\bdarling\b': 'caro',
        r'\bsweetheart\b': 'tesoro',
        r'\bguy\b': 'ragazzo',
        r'\bguys\b': 'ragazzi'
    }
    for pattern, sostituto in glossario.items():
        testo = re.sub(pattern, sostituto, testo, flags=re.IGNORECASE)
    return testo

# --- MODEL LOADING FUNCTIONS ---
def get_xtts():
    global xtts_model
    if xtts_model is None:
        print("⏳ Caricamento del modello XTTSv2 in corso (sulla scheda video)...")
        os.environ["COQUI_TOS_AGREED"] = "1"
        gpu = torch.cuda.is_available()
        torch.set_num_threads(1)
        try:
            from TTS.api import TTS
        except ImportError as e:
            raise Exception("Libreria 'TTS' (Coqui TTS) non trovata. Esegui la Cella 2 del Notebook Colab per installare 'TTS' e poi riavvia il server.")
        xtts_model = TTS("tts_models/multilingual/multi-dataset/xtts_v2", gpu=gpu)
        print(f"✅ Modello XTTS caricato con successo sulla scheda video: {'CUDA' if gpu else 'CPU'}")
    return xtts_model

def get_kokoro(lang_code):
    global kokoro_pipelines
    if lang_code not in kokoro_pipelines:
        print(f"⏳ Caricamento del motore Kokoro per la lingua '{lang_code}'...")
        try:
            from kokoro import KPipeline
        except ImportError as e:
            raise Exception("Libreria 'kokoro' non trovata. Esegui la Cella 1 del Notebook Colab per installare 'kokoro'.")
        kokoro_pipelines[lang_code] = KPipeline(lang_code=lang_code)
        print(f"✅ Kokoro '{lang_code}' caricato!")
    return kokoro_pipelines[lang_code]


# --- ROUTES ---
@app.route('/')
def index():
    return send_file('audiolibri.html')

@app.route('/audiolibri.js')
def serve_js():
    return send_file('audiolibri.js')

@app.route('/upload_voice', methods=['POST'])
def upload_voice():
    try:
        if 'file' not in request.files:
            return {"error": "Nessun file inviato"}, 400
        file = request.files['file']
        if file.filename == '':
            return {"error": "Nome file vuoto"}, 400
        if file and file.filename.lower().endswith('.wav'):
            # Salva come voce_rif_custom.wav nella cartella principale
            file.save("voce_rif_custom.wav")
            print("🎙️ Nuova voce di riferimento XTTS caricata: voce_rif_custom.wav")
            return {"success": True, "filename": "voce_rif_custom.wav"}
        else:
            return {"error": "Il file deve essere in formato .wav"}, 400
    except Exception as e:
        print(f"❌ Errore caricamento voce: {str(e)}")
        return {"error": str(e)}, 500

@app.route('/translate', methods=['POST'])
def translate_text():
    with traduzione_lock:
        try:
            data = request.json
            text = data.get('text', '')
            src_lang = data.get('src_lang', 'en')
            # supporta sia 'tgt_lang' che 'target_lang'
            tgt_lang = data.get('tgt_lang', data.get('target_lang', 'it'))
            model_scelto = data.get('model', 'translategemma:12b')

            if not text.strip(): return {"error": "Testo vuoto"}, 400
            
            print(f"\n✨ --- TRADUZIONE CON {model_scelto.upper()} ({src_lang.upper()} -> {tgt_lang.upper()}) ---")
            
            # Normalizzazione lingua
            lingua_ricevuta = tgt_lang.strip().lower()
            mappa_iso = {"italiano": "it", "spagnolo": "es", "francese": "fr", "tedesco": "de", "inglese": "en", "portoghese": "pt"}
            lingua_iso = mappa_iso.get(lingua_ricevuta, lingua_ricevuta)

            nomi_estesi = {
                "it": "Italiano", "es": "Spagnolo", "fr": "Francese", 
                "de": "Tedesco", "en": "Inglese", "pt": "Portoghese",
                "ja": "Giapponese", "zh": "Cinese Mandarino", "hi": "Hindi"
            }
            nome_lingua_esteso = nomi_estesi.get(lingua_iso, lingua_iso.capitalize())

            # Split in chunks
            MAX_CHARS = 5000 
            paragrafi = text.split('\n')
            chunks = []
            current_chunk = ""

            for p in paragrafi:
                if len(current_chunk) + len(p) > MAX_CHARS:
                    chunks.append(current_chunk.strip())
                    current_chunk = p + "\n"
                else:
                    current_chunk += p + "\n"
            if current_chunk.strip():
                chunks.append(current_chunk.strip())

            traduzione_finale = []

            # Traduzione tramite Ollama (TranslateGemma)
            for i, chunk in enumerate(chunks):
                print(f"\n--- [ Blocco {i+1} di {len(chunks)} ] ---")
                
                prompt_gemma = (
                    f"<start_of_turn>user\n"
                    f"Translate this text into {nome_lingua_esteso}. "
                    "Follow these linguistic rules:\n"
                    "1. CONTEXTUAL REGISTER: Choose between 'tu' (informal) and 'voi' (formal) based on the relationship between characters. "
                    "Friends, family, and lovers MUST use 'tu'. Use 'voi' only for formal respect or multiple people.\n"
                    "2. CONSISTENCY: Keep the same register for the same characters throughout the text.\n"
                    "3. NO DIALOGUE LOOPS: Translate only the provided text. Do not repeat sentences and do not invent new dialogue.\n"
                    "4. LITERARY STYLE: Maintain the tone and atmosphere of the original prose.\n\n"
                    f"TEXT:\n{chunk}<end_of_turn>\n"
                    f"<start_of_turn>model\n"
                )
                
                contesto_memoria = 4096 if "12b" in model_scelto else 8192

                response = requests.post("http://localhost:11434/api/generate", json={
                    "model": model_scelto,
                    "prompt": prompt_gemma,
                    "stream": True,
                    "options": {
                        "num_ctx": contesto_memoria, 
                        "temperature": 0.3,
                        "repeat_penalty": 1.4,
                        "repeat_last_n": 128,
                        "top_p": 0.9,
                        "stop": ["<start_of_turn>", "<end_of_turn>", "user:", "model:"]
                    }
                }, stream=True)

                blocco_pulito = ""
                if response.status_code == 200:
                    for line in response.iter_lines():
                        if line:
                            body = json.loads(line)
                            parola = body.get("response", "")
                            if "<start_of_turn>" in parola: break
                            blocco_pulito += parola
                            print(parola, end="", flush=True) 
                    
                    traduzione_finale.append(blocco_pulito.strip())
                    print("\n")
                else:
                    raise Exception(f"Errore Ollama: {response.status_code}")

            output_text = "\n\n".join(traduzione_finale)
            output_text = applica_glossario(output_text)
            
            return jsonify({"translated_text": output_text})

        except requests.exceptions.ConnectionError:
            err_msg = "Impossibile connettersi ad Ollama (porta 11434). Assicurati di aver eseguito la Cella 2 del Notebook su Colab per installare ed avviare Ollama e TranslateGemma 12B."
            print(f"❌ Errore traduzione: {err_msg}")
            return {"error": err_msg}, 500
        except Exception as e:
            print(f"❌ Errore traduzione: {str(e)}")
            return {"error": str(e)}, 500

@app.route('/generate_xtts', methods=['POST'])
def generate_xtts():
    with audio_lock:
        try:
            data = request.json
            text = data.get('text', '')
            voice = data.get('voice', 'xtts_female')
            cap_id = data.get('capitolo_id', 'Singolo')
            lang = data.get('lang', 'it')
            
            if not text.strip(): return {"error": "Testo vuoto"}, 400
            
            print(f"\n🎙️ Generazione XTTS avviata (Voce: {voice}, Lingua: {lang.upper()})...")
            tts = get_xtts()
            
            # Scelta della voce
            if voice == "xtts_male":
                base_speaker = "voce_rif_male"
            elif voice == "xtts_female":
                base_speaker = "voce_rif_female"
            elif voice == "xtts_custom":
                base_speaker = "voce_rif_custom"
            else:
                base_speaker = "voce_rif"
            
            speaker_file_lang = f"{base_speaker}_{lang}.wav"
            if os.path.exists(speaker_file_lang):
                speaker_file = speaker_file_lang
            else:
                speaker_file = f"{base_speaker}.wav"
                
            # Fallback se il file di riferimento non esiste affatto
            if not os.path.exists(speaker_file):
                print(f"⚠️ File di riferimento {speaker_file} non trovato, uso fallback voce_rif_female.wav")
                speaker_file = "voce_rif_female.wav"
                
            print(f"👉 Uso file di riferimento: {speaker_file}")
            
            cartella_out = "audiolibri_output"
            os.makedirs(cartella_out, exist_ok=True)
            output_path = f"{cartella_out}/Capitolo_{cap_id}_{lang}_xtts.wav"
            mp3_path = f"{cartella_out}/Capitolo_{cap_id}_{lang}_xtts.mp3"
            
            text_elaborato = text.replace("—", "... ").replace("  ", " ")
            frasi_sicure = dividi_testo_xtts(text_elaborato)
            audio_completo = []
            
            frasi_valide = [f.strip() for f in frasi_sicure if len(f.strip()) > 1]
            print(f"🎙️ Generazione di {len(frasi_valide)} blocchi (inclusi i paragrafi)...")

            lang_xtts = "zh-cn" if lang == "zh" else lang
            
            for i, frase in enumerate(frasi_valide):
                if frase == "___PAUSA_PARAGRAFO___":
                    silenzio = np.zeros(int(24000 * 0.6), dtype=np.float32)
                    audio_completo.extend(silenzio)
                    print("=> [Inserita Pausa di Paragrafo]")
                    continue
                    
                is_esclamativa = '!' in frase
                is_interrogativa = '?' in frase
                is_dialogo = '"' in frase or '“' in frase or '”' in frase
                is_interrotta = False
                
                if i < len(frasi_valide) - 1:
                    if ("casa" in frase.lower() or "uno" in frase.lower()) and i >= 1: 
                        is_interrotta = True

                frase_magica = frase.replace("...", "___PUNTINI___").replace(".", ";").replace("___PUNTINI___", "...")
                print(f"Elaborazione: {frase_magica[:50]}...")
                
                audio_array = tts.tts(text=frase_magica, speaker_wav=speaker_file, language=lang_xtts)
                audio_completo.extend(audio_array)
                
                if is_interrotta:
                    durata_pausa = 0.01  
                elif is_dialogo:
                    durata_pausa = 0.3  
                elif is_esclamativa or is_interrogativa:
                    durata_pausa = 0.2  
                else:
                    durata_pausa = 0.15  
                    
                silenzio = np.zeros(int(24000 * durata_pausa), dtype=np.float32)
                audio_completo.extend(silenzio)
            
            # Normalizzazione ed export
            audio_arr = np.array(audio_completo, dtype=np.float32)
            max_val = np.max(np.abs(audio_arr))
            if max_val > 0:
                audio_arr = audio_arr / max_val
                
            sf.write(output_path, audio_arr, 24000, subtype='PCM_16')
            
            try:
                print("🎵 Conversione in MP3 in corso...")
                audio_segment = AudioSegment.from_wav(output_path)
                audio_segment.export(mp3_path, format="mp3", bitrate="192k")
                print(f"✅ MP3 salvato: {mp3_path}")
            except Exception as e:
                print(f"⚠️ Errore conversione MP3: {e}")
                
            print("✅ Audio generato!")
            return send_file(output_path, mimetype="audio/wav")

        except Exception as e:
            print(f"❌ Errore XTTS: {str(e)}")
            return {"error": str(e)}, 500

@app.route('/generate_kokoro', methods=['POST'])
def generate_kokoro():
    with audio_lock:
        try:
            data = request.json
            text = data.get('text', '')
            voice = data.get('voice', 'if_sara')
            cap_id = data.get('capitolo_id', 'Singolo')
            lang = data.get('lang', 'it')

            if not text.strip(): return {"error": "Testo vuoto"}, 400
            
            print(f"\n🎙️ Generazione Kokoro avviata (Voce: {voice}, Lingua: {lang.upper()})...")
            pipeline = get_kokoro(voice[0])
            
            cartella_out = "audiolibri_output"
            os.makedirs(cartella_out, exist_ok=True)
            output_path = f"{cartella_out}/Capitolo_{cap_id}_{lang}_kokoro.wav"
            mp3_path = f"{cartella_out}/Capitolo_{cap_id}_{lang}_kokoro.mp3"
            
            frasi = dividi_testo_kokoro(text)
            audio_completo = []
            
            for frase in frasi:
                if frase == "___PAUSA_PARAGRAFO___":
                    silenzio = np.zeros(int(24000 * 0.8), dtype=np.float32)
                    audio_completo.extend(silenzio)
                    continue
                
                frase_pulita = correggi_pronuncia(frase)
                generator = pipeline(frase_pulita, voice=voice, speed=1.0, split_pattern='')
                
                for _, _, audio in generator:
                    audio_completo.extend(audio)
                
                durata_pausa = 0.15 if frase.endswith(',') else 0.2
                silenzio = np.zeros(int(24000 * durata_pausa), dtype=np.float32)
                audio_completo.extend(silenzio)

            audio_arr = np.array(audio_completo, dtype=np.float32)
            max_val = np.max(np.abs(audio_arr))
            if max_val > 0:
                audio_arr = audio_arr / max_val
                
            sf.write(output_path, audio_arr, 24000, subtype='PCM_16')
            
            try:
                audio_segment = AudioSegment.from_wav(output_path)
                audio_segment.export(mp3_path, format="mp3", bitrate="192k")
            except Exception as e:
                print(f"⚠️ Errore conversione MP3: {e}")
                
            print("✅ Kokoro Audio generato!")
            return send_file(output_path, mimetype="audio/wav")
            
        except Exception as e:
            print(f"❌ Errore Kokoro: {str(e)}")
            return {"error": str(e)}, 500

@app.route('/save_and_export', methods=['POST'])
def save_and_export():
    try:
        data = request.json
        title = data.get('book_title', 'Il Mio Libro')
        author = data.get('book_author', 'Autore Anonimo')
        chapters = data.get('chapters', [])
        full_project = data.get('full_project', {})

        folder = "audiolibriEpub"
        os.makedirs(folder, exist_ok=True)
        filename_clean = title.replace(" ", "_")

        # Salva il file di progetto
        project_path = f"{folder}/{filename_clean}_Progetto.json"
        with open(project_path, 'w', encoding='utf-8') as f:
            json.dump(full_project, f, indent=4, ensure_ascii=False)

        # Genera EPUB
        book = epub.EpubBook()
        book.set_title(title)
        book.set_language('it')
        book.add_author(author)

        epub_chapters = []
        for idx, cap in enumerate(chapters):
            cap_title = cap.get('title', f"Capitolo {idx+1}")
            content = cap.get('content', '')
            
            html_content = f"<html><body><h1>{cap_title}</h1>"
            for para in content.split('\n'):
                if para.strip():
                    html_content += f"<p>{para.strip()}</p>"
            html_content += "</body></html>"

            c = epub.EpubHtml(title=cap_title, file_name=f"chap_{idx+1}.xhtml", lang='it')
            c.content = html_content
            book.add_item(c)
            epub_chapters.append(c)

        book.toc = tuple(epub_chapters)
        book.spine = ['nav'] + epub_chapters
        book.add_item(epub.EpubNav())
        book.add_item(epub.EpubNcx())

        epub_path = f"{folder}/{filename_clean}.epub"
        epub.write_epub(epub_path, book)
        
        return send_file(epub_path, as_attachment=True, download_name=f"{title}.epub")
    except Exception as e:
        print(f"❌ Errore esportazione: {str(e)}")
        return {"error": str(e)}, 500

@app.route('/import_epub', methods=['POST'])
def import_epub():
    temp_path = "audiolibriEpub/temp_import.epub"
    try:
        if 'file' not in request.files:
            return {"error": "Nessun file inviato"}, 400
        
        file = request.files['file']
        os.makedirs("audiolibriEpub", exist_ok=True)
        file.save(temp_path)

        book = epub.read_epub(temp_path)
        
        detected_title = book.get_metadata('DC', 'title')[0][0] if book.get_metadata('DC', 'title') else "Libro Importato"
        detected_author = book.get_metadata('DC', 'creator')[0][0] if book.get_metadata('DC', 'creator') else "Autore Sconosciuto"
        
        detected_lang = "it"
        langs = book.get_metadata('DC', 'language')
        if langs:
            detected_lang = langs[0][0][:2].lower()

        chapters = []
        for item in book.get_items():
            if item.get_type() == 9: # Documento HTML
                soup = BeautifulSoup(item.get_content(), 'html.parser')
                text = soup.get_text()
                
                if len(text.strip()) > 200:
                    title_tag = soup.find(['h1', 'h2', 'h3'])
                    cap_title = title_tag.get_text().strip() if title_tag else f"Sezione {len(chapters)+1}"
                    
                    p_texts = [p.get_text().strip() for p in soup.find_all('p') if p.get_text().strip()]
                    cap_content = "\n\n".join(p_texts) if p_texts else text.strip()
                    
                    chapters.append({
                        "titolo": cap_title,
                        "contenuto": cap_content
                    })

        os.remove(temp_path)
        return jsonify({
            "detected_lang": detected_lang,
            "detected_title": detected_title,
            "detected_author": detected_author,
            "chapters": chapters
        })
    except Exception as e:
        if os.path.exists(temp_path): os.remove(temp_path)
        return {"error": str(e)}, 500


if __name__ == '__main__':
    print("🚀 Server Colab Edition avviato sulla porta 5000!")
    app.run(host='0.0.0.0', port=5000, debug=False)
