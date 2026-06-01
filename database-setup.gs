// ════════════════════════════════════════════════════════════════════════
// SOS SMARTPHONE — Google Apps Script
// Versione: 2.0 — 01/06/2026
//
// ┌─────────────────────────────────────────────────────────────────┐
// │  ISTRUZIONI INSTALLAZIONE (una tantum, ~5 minuti)               │
// │                                                                 │
// │  1. Apri il tuo Google Sheet                                    │
// │  2. Estensioni → Apps Script                                    │
// │  3. Cancella tutto e incolla questo codice                      │
// │  4. Modifica le 3 righe di CONFIGURAZIONE qui sotto             │
// │  5. Salva (Ctrl+S)                                              │
// │  6. Distribuisci → Nuova distribuzione → App web               │
// │       Esegui come: Me                                           │
// │       Chi ha accesso: Chiunque                                  │
// │  7. Copia l'URL e incollalo nell'app HTML come SHEETS_WRITE_URL │
// │  8. Esegui → setupTriggerBackup → autorizza                     │
// │     (attiva email serale automatica ogni giorno alle 22:00)     │
// └─────────────────────────────────────────────────────────────────┘
// ════════════════════════════════════════════════════════════════════════

// ── CONFIGURAZIONE ────────────────────────────────────────────────────
// Sostituisci con i tuoi valori reali

const SHEET_ID   = '13qCrogKFqRBaMBKqRwB78CfDA5WDAG2n7Ggw4A39UWE';     // ID del tuo Google Sheet
const SHEET_NAME = 'MAGAZZINO';                  // Nome della scheda dati
const EMAIL_BACKUP = 'info.sosmartphone@gmail.com'; // Email per il backup serale

// ─────────────────────────────────────────────────────────────────────

// ════════════════════════════════════════════════════════════════════════
// WEB APP — gestisce chiamate dall'app HTML
// ════════════════════════════════════════════════════════════════════════

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    let result;
    switch(data.tipo) {
      case 'acquisto': result = registraAcquisto(data); break;
      case 'vendita':  result = registraVendita(data);  break;
      case 'read':     result = leggiDati(data);        break;
      case 'ping':     result = { status: 'ok', msg: 'Server attivo', ts: new Date().toISOString() }; break;
      default:         result = { status: 'error', msg: 'Tipo non riconosciuto: ' + data.tipo };
    }
    return jsonResponse(result);
  } catch(err) {
    return jsonResponse({ status: 'error', msg: err.message });
  }
}

function doGet(e) {
  const tipo = e.parameter.tipo || 'read';
  if (tipo === 'ping') return jsonResponse({ status: 'ok' });
  const result = leggiDati({
    filtro: e.parameter.filtro || '',
    valore: e.parameter.valore || ''
  });
  return jsonResponse(result);
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ════════════════════════════════════════════════════════════════════════
// ACQUISTO
// ════════════════════════════════════════════════════════════════════════

function registraAcquisto(data) {
  const sheet = getOrCreateSheet();

  // Controlla IMEI duplicato
  const values = sheet.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][3]) === String(data.imei)) {
      return { status: 'duplicate', msg: 'IMEI già presente: ' + data.imei, riga: i + 1 };
    }
  }

  const nextRow = sheet.getLastRow() + 1;
  const id = 'ACQ-' + new Date().getFullYear() + '-' + String(nextRow - 1).padStart(4, '0');
  const oggi = formatData(new Date());

  sheet.appendRow([
    id,
    data.data || oggi,
    data.modello || '',
    data.imei || '',
    data.storage || '',
    data.colore || '',
    parseFloat(data.prezzo_acquisto) || 0,
    data.venditore || '',
    data.doc_venditore || '',
    'magazzino',
    '', '', '', '', '',  // vendita vuota
    data.note || ''
  ]);

  // Formattazione
  const lr = sheet.getLastRow();
  sheet.getRange(lr, 10).setBackground('#FFF9C4').setFontWeight('bold'); // giallo magazzino
  sheet.getRange(lr, 7).setNumberFormat('€#,##0.00');

  return { status: 'ok', id: id, msg: 'Acquisto registrato correttamente' };
}

// ════════════════════════════════════════════════════════════════════════
// VENDITA
// ════════════════════════════════════════════════════════════════════════

function registraVendita(data) {
  const sheet = getOrCreateSheet();
  const values = sheet.getDataRange().getValues();
  let rigaTrovata = -1;

  for (let i = 1; i < values.length; i++) {
    if (String(values[i][3]) === String(data.imei) && values[i][9] !== 'venduto') {
      rigaTrovata = i + 1;
      break;
    }
  }

  if (rigaTrovata === -1)
    return { status: 'error', msg: 'IMEI non trovato o già venduto: ' + data.imei };

  const prezzoAcq  = parseFloat(values[rigaTrovata - 1][6]) || 0;
  const prezzoVend = parseFloat(data.prezzo_vendita) || 0;
  const margine    = prezzoVend - prezzoAcq;
  const oggi       = formatData(new Date());

  sheet.getRange(rigaTrovata, 10).setValue('venduto');
  sheet.getRange(rigaTrovata, 11).setValue(data.data_vendita || oggi);
  sheet.getRange(rigaTrovata, 12).setValue(data.cliente || '');
  sheet.getRange(rigaTrovata, 13).setValue(data.tel_cliente || '');
  sheet.getRange(rigaTrovata, 14).setValue(prezzoVend);
  sheet.getRange(rigaTrovata, 15).setValue(margine);
  sheet.getRange(rigaTrovata, 16).setValue(data.note || values[rigaTrovata-1][15]);

  // Formattazione riga venduta
  sheet.getRange(rigaTrovata, 10).setBackground('#C8E6C9').setFontWeight('bold'); // verde
  sheet.getRange(rigaTrovata, 14, 1, 2).setNumberFormat('€#,##0.00');

  // Notifica Telegram via Pabbly (opzionale — non blocca se fallisce)
  try {
    UrlFetchApp.fetch('https://connect.pabbly.com/webhook-listener/webhook/IjU3NjUwNTZiMDYzZjA0MzE1MjZkIg_3D_3D_pc/IjU3NjcwNTZlMDYzNDA0Mzc1MjZmNTUzZDUxMzAi_pc', {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify({
        tipo: 'vendita_db',
        modello: values[rigaTrovata-1][2],
        imei: data.imei,
        cliente: data.cliente,
        prezzo_acquisto: prezzoAcq,
        prezzo_vendita: prezzoVend,
        margine: margine
      }),
      muteHttpExceptions: true
    });
  } catch(e) {}

  return { status: 'ok', msg: 'Vendita registrata', margine, prezzo_acquisto: prezzoAcq, prezzo_vendita: prezzoVend };
}

// ════════════════════════════════════════════════════════════════════════
// LEGGI DATI
// ════════════════════════════════════════════════════════════════════════

function leggiDati(data) {
  const sheet = getOrCreateSheet();
  if (sheet.getLastRow() <= 1) return { status: 'ok', rows: [], totale: 0 };

  const values = sheet.getDataRange().getValues();
  const rows = [];

  for (let i = 1; i < values.length; i++) {
    const r = values[i];
    if (!r[0]) continue;

    const obj = {
      id: r[0], data: fmtVal(r[1]), modello: r[2], imei: String(r[3]),
      storage: r[4], colore: r[5], prezzo_acquisto: r[6],
      venditore: r[7], doc_venditore: r[8], stato: r[9],
      data_vendita: fmtVal(r[10]), cliente: r[11], tel_cliente: r[12],
      prezzo_vendita: r[13], margine: r[14], note: r[15]
    };

    if (data.filtro === 'stato'        && obj.stato !== data.valore)        continue;
    if (data.filtro === 'imei'         && obj.imei !== data.valore)         continue;
    if (data.filtro === 'data'         && obj.data !== data.valore)         continue;
    if (data.filtro === 'data_vendita' && obj.data_vendita !== data.valore) continue;

    rows.push(obj);
  }

  return { status: 'ok', rows, totale: rows.length };
}

// ════════════════════════════════════════════════════════════════════════
// BACKUP GIORNALIERO VIA EMAIL
// ════════════════════════════════════════════════════════════════════════

/**
 * Funzione principale del backup serale.
 * Viene chiamata automaticamente ogni giorno alle 22:00.
 * Eseguila manualmente la prima volta per testare.
 */
function backupGiornaliero() {
  const oggi = formatData(new Date());
  const sheet = getOrCreateSheet();
  const values = sheet.getDataRange().getValues();

  if (values.length <= 1) {
    MailApp.sendEmail(EMAIL_BACKUP,
      '📦 SOS Smartphone — Backup ' + oggi + ' (nessun dato)',
      'Nessun movimento registrato oggi.'
    );
    return;
  }

  // Filtra acquisti e vendite di oggi
  const acquisti = [];
  const vendite  = [];
  const magazzino = [];
  let totAcq = 0, totVend = 0, totMarg = 0;

  for (let i = 1; i < values.length; i++) {
    const r = values[i];
    if (!r[0]) continue;
    const dataAcq  = fmtVal(r[1]);
    const dataVend = fmtVal(r[10]);
    const stato    = r[9];

    if (dataAcq === oggi)  { acquisti.push(r);  totAcq  += parseFloat(r[6]) || 0; }
    if (dataVend === oggi && stato === 'venduto') {
      vendite.push(r);
      totVend += parseFloat(r[13]) || 0;
      totMarg += parseFloat(r[14]) || 0;
    }
    if (stato === 'magazzino') magazzino.push(r);
  }

  // ── Costruisci HTML email ────────────────────────────────────────
  let html = `
  <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
    <div style="background:#111;color:white;padding:20px;border-radius:8px 8px 0 0">
      <h2 style="margin:0;font-size:18px">📱 SOS Smartphone</h2>
      <p style="margin:4px 0 0;color:rgba(255,255,255,0.6);font-size:13px">Backup giornaliero · ${oggi}</p>
    </div>

    <div style="background:#f9f9f9;padding:20px">
      <!-- RIEPILOGO -->
      <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
        <tr>
          <td style="background:white;border:1px solid #e5e5e5;padding:14px;border-radius:8px;text-align:center;width:25%">
            <div style="font-size:24px;font-weight:700;color:#dc2626">${acquisti.length}</div>
            <div style="font-size:11px;color:#777;text-transform:uppercase">Acquisti</div>
          </td>
          <td style="width:8px"></td>
          <td style="background:white;border:1px solid #e5e5e5;padding:14px;border-radius:8px;text-align:center;width:25%">
            <div style="font-size:24px;font-weight:700;color:#16a34a">${vendite.length}</div>
            <div style="font-size:11px;color:#777;text-transform:uppercase">Vendite</div>
          </td>
          <td style="width:8px"></td>
          <td style="background:white;border:1px solid #e5e5e5;padding:14px;border-radius:8px;text-align:center;width:25%">
            <div style="font-size:24px;font-weight:700;color:#d97706">${magazzino.length}</div>
            <div style="font-size:11px;color:#777;text-transform:uppercase">In stock</div>
          </td>
          <td style="width:8px"></td>
          <td style="background:#111;border:1px solid #111;padding:14px;border-radius:8px;text-align:center;width:25%">
            <div style="font-size:24px;font-weight:700;color:${totMarg>=0?'#4ade80':'#f87171'}">${totMarg>=0?'+':''}€${totMarg.toFixed(0)}</div>
            <div style="font-size:11px;color:rgba(255,255,255,0.5);text-transform:uppercase">Margine</div>
          </td>
        </tr>
      </table>`;

  // Acquisti del giorno
  if (acquisti.length) {
    html += `<h3 style="color:#dc2626;font-size:13px;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px">📥 Acquisti</h3>
    <table style="width:100%;border-collapse:collapse;margin-bottom:20px;background:white;border-radius:8px;overflow:hidden;border:1px solid #e5e5e5">
      <tr style="background:#dc2626;color:white;font-size:11px">
        <th style="padding:8px;text-align:left">Modello</th>
        <th style="padding:8px;text-align:left">IMEI</th>
        <th style="padding:8px;text-align:left">Venditore</th>
        <th style="padding:8px;text-align:right">Prezzo</th>
      </tr>`;
    acquisti.forEach((r,i) => {
      html += `<tr style="background:${i%2===0?'white':'#fafafa'}">
        <td style="padding:8px;font-size:12px"><b>${r[2]}</b> ${r[4]||''}</td>
        <td style="padding:8px;font-size:11px;font-family:monospace">${r[3]}</td>
        <td style="padding:8px;font-size:11px">${r[7]}</td>
        <td style="padding:8px;font-size:12px;text-align:right;color:#dc2626;font-weight:bold">-€${r[6]||0}</td>
      </tr>`;
    });
    html += `<tr style="background:#fff0f0"><td colspan="3" style="padding:8px;font-size:12px;font-weight:bold">Totale acquistato</td>
      <td style="padding:8px;text-align:right;font-weight:bold;color:#dc2626">-€${totAcq.toFixed(0)}</td></tr>
    </table>`;
  }

  // Vendite del giorno
  if (vendite.length) {
    html += `<h3 style="color:#16a34a;font-size:13px;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px">💰 Vendite</h3>
    <table style="width:100%;border-collapse:collapse;margin-bottom:20px;background:white;border-radius:8px;overflow:hidden;border:1px solid #e5e5e5">
      <tr style="background:#16a34a;color:white;font-size:11px">
        <th style="padding:8px;text-align:left">Modello</th>
        <th style="padding:8px;text-align:left">Cliente</th>
        <th style="padding:8px;text-align:right">Vendita</th>
        <th style="padding:8px;text-align:right">Margine</th>
      </tr>`;
    vendite.forEach((r,i) => {
      const marg = parseFloat(r[14])||0;
      html += `<tr style="background:${i%2===0?'white':'#fafafa'}">
        <td style="padding:8px;font-size:12px"><b>${r[2]}</b> ${r[4]||''}</td>
        <td style="padding:8px;font-size:11px">${r[11]||'—'}</td>
        <td style="padding:8px;font-size:12px;text-align:right;color:#16a34a;font-weight:bold">+€${r[13]||0}</td>
        <td style="padding:8px;font-size:12px;text-align:right;font-weight:bold;color:${marg>=0?'#16a34a':'#dc2626'}">${marg>=0?'+':''}€${marg.toFixed(0)}</td>
      </tr>`;
    });
    html += `<tr style="background:#f0fdf4"><td colspan="2" style="padding:8px;font-size:12px;font-weight:bold">Totale incassato</td>
      <td style="padding:8px;text-align:right;font-weight:bold;color:#16a34a">+€${totVend.toFixed(0)}</td>
      <td style="padding:8px;text-align:right;font-weight:bold;color:${totMarg>=0?'#16a34a':'#dc2626'}">${totMarg>=0?'+':''}€${totMarg.toFixed(0)}</td></tr>
    </table>`;
  }

  // Magazzino corrente
  if (magazzino.length) {
    html += `<h3 style="color:#d97706;font-size:13px;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px">📦 Magazzino attuale (${magazzino.length} dispositivi)</h3>
    <table style="width:100%;border-collapse:collapse;margin-bottom:20px;background:white;border-radius:8px;overflow:hidden;border:1px solid #e5e5e5">
      <tr style="background:#d97706;color:white;font-size:11px">
        <th style="padding:8px;text-align:left">Modello</th>
        <th style="padding:8px;text-align:left">IMEI</th>
        <th style="padding:8px;text-align:left">Acquistato</th>
        <th style="padding:8px;text-align:right">Costo</th>
      </tr>`;
    let totStock = 0;
    magazzino.forEach((r,i) => {
      totStock += parseFloat(r[6])||0;
      html += `<tr style="background:${i%2===0?'white':'#fafafa'}">
        <td style="padding:8px;font-size:12px"><b>${r[2]}</b> ${r[4]||''}</td>
        <td style="padding:8px;font-size:11px;font-family:monospace">${r[3]}</td>
        <td style="padding:8px;font-size:11px">${fmtVal(r[1])}</td>
        <td style="padding:8px;font-size:12px;text-align:right;color:#d97706;font-weight:bold">€${r[6]||0}</td>
      </tr>`;
    });
    html += `<tr style="background:#fffbeb"><td colspan="3" style="padding:8px;font-size:12px;font-weight:bold">Valore totale magazzino</td>
      <td style="padding:8px;text-align:right;font-weight:bold;color:#d97706">€${totStock.toFixed(0)}</td></tr>
    </table>`;
  }

  if (!acquisti.length && !vendite.length) {
    html += `<p style="text-align:center;color:#777;padding:20px">Nessun movimento oggi.</p>`;
  }

  html += `</div>
    <div style="background:#f0f0f0;padding:12px;text-align:center;font-size:11px;color:#777;border-radius:0 0 8px 8px">
      SOS Smartphone · Foligno · Backup automatico generato il ${oggi} alle 22:00
    </div>
  </div>`;

  // ── Allegato CSV con tutti i dati del giorno ─────────────────────
  let csv = 'ID,Data,Modello,IMEI,Storage,Colore,Prezzo_Acquisto,Venditore,Doc,Stato,Data_Vendita,Cliente,Tel,Prezzo_Vendita,Margine,Note\n';
  const tuttiOggi = [...acquisti, ...vendite];
  tuttiOggi.forEach(r => {
    csv += r.map(v => '"' + String(v||'').replace(/"/g,'""') + '"').join(',') + '\n';
  });

  const blob = Utilities.newBlob(csv, 'text/csv', 'backup-sos-' + oggi.replace(/\//g,'-') + '.csv');

  MailApp.sendEmail({
    to: EMAIL_BACKUP,
    subject: `📱 SOS Smartphone — Backup ${oggi} · ${acquisti.length} acq · ${vendite.length} vend · ${totMarg>=0?'+':''}€${totMarg.toFixed(0)} margine`,
    htmlBody: html,
    attachments: [blob]
  });

  Logger.log('Backup inviato a ' + EMAIL_BACKUP + ' — ' + oggi);
}

// ════════════════════════════════════════════════════════════════════════
// TRIGGER AUTOMATICO — esegui setupTriggerBackup UNA SOLA VOLTA
// ════════════════════════════════════════════════════════════════════════

function setupTriggerBackup() {
  // Rimuovi trigger esistenti per evitare duplicati
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === 'backupGiornaliero') {
      ScriptApp.deleteTrigger(t);
    }
  });

  // Crea trigger giornaliero alle 22:00
  ScriptApp.newTrigger('backupGiornaliero')
    .timeBased()
    .everyDays(1)
    .atHour(22)
    .create();

  Logger.log('✅ Trigger backup impostato — ogni giorno alle 22:00');
  SpreadsheetApp.getUi().alert('✅ Backup automatico attivato!\nRiceverai un\'email ogni sera alle 22:00.');
}

// ════════════════════════════════════════════════════════════════════════
// UTILITY
// ════════════════════════════════════════════════════════════════════════

function getOrCreateSheet() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let sheet = ss.getSheetByName(SHEET_NAME);

  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    // Crea intestazione
    const headers = ['ID','Data','Modello','IMEI','Storage','Colore',
      'Prezzo_Acquisto','Venditore','Doc_Venditore','Stato',
      'Data_Vendita','Cliente','Tel_Cliente','Prezzo_Vendita','Margine','Note'];
    sheet.appendRow(headers);
    sheet.getRange(1,1,1,headers.length)
      .setFontWeight('bold')
      .setBackground('#111111')
      .setFontColor('#ffffff');
    sheet.setFrozenRows(1);
    sheet.setColumnWidth(3, 200); // Modello più largo
    sheet.setColumnWidth(4, 160); // IMEI
  }
  return sheet;
}

function formatData(d) {
  return Utilities.formatDate(d, 'Europe/Rome', 'dd/MM/yyyy');
}

function fmtVal(v) {
  if (v instanceof Date) return formatData(v);
  return String(v || '');
}
