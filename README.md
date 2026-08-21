# 🎙️ Studio Editoriale AI - Colab Edition

Un'applicazione completa per l'elaborazione di audiolibri ed eBook con traduzione AI multilingua (**TranslateGemma 12B**) e motori di sintesi vocale neurale (**XTTSv2** con Voice Cloning e **Kokoro**).

---

## 🌟 Funzionalità
- 📖 **Editor Capitoli & Traduzione**: Traduzione intelligente basata sul contesto con **TranslateGemma 12B**.
- 🎙️ **XTTSv2 Voice Cloning**:
  - `Preset Femminile` (`voce_rif_female.wav`)
  - `Preset Maschile` (`voce_rif_male.wav`)
  - `Voice Clone` (carica qualsiasi file `.wav` direttamente dal pulsante nell'interfaccia web)
- 🗣️ **Kokoro TTS**: Generazione vocale ad altissima velocità e qualità per 8 lingue (Italiano, Inglese, Francese, Spagnolo, Giapponese, Cinese, Hindi, Portoghese).
- 📚 **Import/Export**: Importa file `.epub` esistenti ed esporta progetti JSON e audiolibri completi unificati.

---

## 🚀 Avvio su Google Colab
1. Apri Google Colab e carica il file **`Studio_Editoriale_AI.ipynb`**.
2. Imposta l'acceleratore su **GPU T4** (*Runtime* -> *Cambia tipo di runtime* -> *T4 GPU*).
3. Esegui le celle in sequenza:
   - **Cella 1**: Clona automaticamente questo repository GitHub.
   - **Cella 2**: Installa le dipendenze e verifica i moduli.
   - **Cella 3**: (Opzionale) Installa ed avvia Ollama con TranslateGemma 12B.
   - **Cella 4**: Mostra l'IP del tunnel.
   - **Cella 5**: Avvia il server ed espone l'interfaccia con link pubblico Localtunnel.

---

## 📁 Struttura della Repository
```text
AIStudioEBook/
├── server.py                     # Backend Flask
├── audiolibri.html               # Interfaccia grafica Material 3
├── audiolibri.js                 # Logica applicativa frontend
├── Studio_Editoriale_AI.ipynb    # Notebook Jupyter per Google Colab
├── requirements.txt              # Dipendenze Python
├── voce_rif_female.wav           # (Da aggiungere) Preset voce femminile
├── voce_rif_male.wav             # (Da aggiungere) Preset voce maschile
└── README.md
```
