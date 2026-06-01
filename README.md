# SOS Smartphone — App Negozio

App web progressiva per la gestione del negozio SOS Smartphone di Foligno.

## Funzionalità

- **Programma Fedeltà** — iscrizione, check codice referral, conferma acquisti
- **Preventivi** — assistenza iPhone/Android con listino da Google Sheet
- **Valuta iPhone** — offerta acquisto usato con listino dinamico  
- **RMA / Garanzia** — apertura e gestione pratiche
- **Assistenza** — pratica riparazione con password dispositivo e pattern Android
- **Database Smartphone** — acquisti e vendite usati su Google Sheets
- **Report Giornaliero** — movimenti, margini e magazzino del giorno
- **Contratto Acquisto** — genera PDF con OTP firma cliente
- **Splitty Pay** — calcolo rate con commissioni
- **Vendita Assistita** — schede iPhone e comparatore
- **Backup Email** — riepilogo serale automatico via Google Apps Script

## File

| File | Descrizione |
|------|-------------|
| `sos-app-v3-fixed.html` | App principale (HTML/CSS/JS single file) |
| `database-setup.gs` | Google Apps Script per database e backup email |

## Setup Google Apps Script

1. Apri il tuo Google Sheet → Estensioni → Apps Script
2. Incolla il contenuto di `database-setup.gs`
3. Distribuisci come Web App (Chiunque può accedere)
4. Copia l'URL e incollalo in `sos-app-v3-fixed.html` come `SHEETS_WRITE_URL`
5. Esegui `setupTriggerBackup()` per attivare backup email ogni sera alle 22:00

## Configurazione

Nel file `sos-app-v3-fixed.html` cerca e aggiorna:

```js
const SHEETS_WRITE_URL = 'https://script.google.com/macros/s/TUO_URL/exec';
```

Nel file `database-setup.gs` l'ID del foglio è già configurato.

## Versione

v3.13 — 01/06/2026
