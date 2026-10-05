(() => {
  "use strict";

  const SAMPLE = `payment_id,amount,currency,mandate_id,sequence_type,collection_date,debtor_name,debtor_iban,debtor_bic,remittance
DD-10001,49.90,EUR,MANDATE-1001,FRST,2026-10-15,Acme Customer,DE89370400440532013000,COBADEFFXXX,Invoice 10001
DD-10002,125.00,EUR,MANDATE-1002,RCUR,2026-10-15,Example Customer,FR1420041010050500013M02606,BNPAFRPPXXX,Invoice 10002
DD-10003,19.95,EUR,MANDATE-1003,RCUR,2026-10-15,Demo Customer,ES9121000418450200051332,CAIXESBBXXX,Invoice 10003`;

  const els = {
    csv: document.getElementById("csvInput"),
    file: document.getElementById("csvFile"),
    sample: document.getElementById("sampleBtn"),
    validate: document.getElementById("validateBtn"),
    generate: document.getElementById("generateBtn"),
    copy: document.getElementById("copyBtn"),
    download: document.getElementById("downloadBtn"),
    downloadQ1x: document.getElementById("downloadQ1xBtn"),
    status: document.getElementById("status"),
    summary: document.getElementById("summary"),
    findings: document.getElementById("findings"),
    xml: document.getElementById("xmlOutput"),
    csvError: document.getElementById("csvError")
  };

  let lastRows = [];
  let lastXml = "";

  els.csv.value = SAMPLE;

  function parseCSV(text) {
    const rows = [];
    let row = [], cell = "", quoted = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i], n = text[i + 1];
      if (c === '"' && quoted && n === '"') { cell += '"'; i++; continue; }
      if (c === '"') { quoted = !quoted; continue; }
      if (c === "," && !quoted) { row.push(cell); cell = ""; continue; }
      if ((c === "\n" || c === "\r") && !quoted) {
        if (c === "\r" && n === "\n") i++;
        row.push(cell); cell = "";
        if (row.some(v => v.trim() !== "")) rows.push(row);
        row = [];
        continue;
      }
      cell += c;
    }
    if (cell || row.length) {
      row.push(cell);
      if (row.some(v => v.trim() !== "")) rows.push(row);
    }
    if (!rows.length) return [];
    const headers = rows[0].map(h => h.trim().toLowerCase());
    return rows.slice(1).map(values => Object.fromEntries(headers.map((h, i) => [h, (values[i] || "").trim()])));
  }

  function escapeXml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
  }

  function validIBAN(input) {
    const iban = String(input || "").replace(/\s+/g, "").toUpperCase();
    if (!/^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$/.test(iban)) return false;
    const rearranged = iban.slice(4) + iban.slice(0, 4);
    let numeric = "";
    for (const ch of rearranged) numeric += /[A-Z]/.test(ch) ? String(ch.charCodeAt(0) - 55) : ch;
    let remainder = 0;
    for (let i = 0; i < numeric.length; i += 7) remainder = Number(String(remainder) + numeric.slice(i, i + 7)) % 97;
    return remainder === 1;
  }

  function validBIC(input) {
    return !input || /^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/i.test(input.trim());
  }

  function validDate(input) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input)) return false;
    const d = new Date(input + "T00:00:00Z");
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === input;
  }

  function numberAmount(input) {
    const n = Number(String(input).replace(",", "."));
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  function validate(rows) {
    const required = ["payment_id","amount","currency","mandate_id","sequence_type","collection_date","debtor_name","debtor_iban"];
    const findings = [];
    if (!rows.length) findings.push("No payment records found.");
    if (rows.length) {
      for (const field of required) {
        if (!(field in rows[0])) findings.push(`Missing required CSV column: ${field}`);
      }
    }

    const sequences = new Set(["FRST","RCUR","OOFF","FNAL"]);
    rows.forEach((r, idx) => {
      const line = idx + 2;
      if (!r.payment_id) findings.push(`Row ${line}: payment_id is required.`);
      const amount = numberAmount(r.amount);
      if (amount === null) findings.push(`Row ${line}: amount must be a positive decimal.`);
      if (r.currency.toUpperCase() !== "EUR") findings.push(`Row ${line}: currency must be EUR for this SEPA demo.`);
      if (!r.mandate_id) findings.push(`Row ${line}: mandate_id is required.`);
      if (!sequences.has(r.sequence_type.toUpperCase())) findings.push(`Row ${line}: sequence_type must be FRST, RCUR, OOFF or FNAL.`);
      if (!validDate(r.collection_date)) findings.push(`Row ${line}: collection_date must be a real YYYY-MM-DD date.`);
      if (!r.debtor_name) findings.push(`Row ${line}: debtor_name is required.`);
      if (!validIBAN(r.debtor_iban)) findings.push(`Row ${line}: debtor_iban failed ISO 13616 mod-97 validation.`);
      if (!validBIC(r.debtor_bic)) findings.push(`Row ${line}: debtor_bic has an invalid BIC structure.`);
    });

    const total = rows.reduce((sum, r) => sum + (numberAmount(r.amount) || 0), 0);
    return { findings, total, count: rows.length };
  }

  function renderValidation(result) {
    els.summary.innerHTML = `
      <div class="metric"><b>${result.count}</b><span>transactions</span></div>
      <div class="metric"><b>${result.total.toFixed(2)}</b><span>control sum EUR</span></div>
      <div class="metric"><b>${result.findings.length}</b><span>findings</span></div>`;

    els.findings.innerHTML = result.findings.length
      ? result.findings.map(x => `<div class="finding">${escapeXml(x)}</div>`).join("")
      : `<div class="finding ok">✓ All browser checks passed. Control totals were recomputed from the records.</div>`;

    els.status.textContent = result.findings.length ? "Invalid" : "Valid";
    els.status.className = "status " + (result.findings.length ? "bad" : "good");
    els.generate.disabled = !!result.findings.length;
  }

  function generateXML(rows) {
    const now = new Date();
    const msgId = "P8-" + now.toISOString().replace(/\D/g, "").slice(0, 14);
    const created = now.toISOString().slice(0, 19);
    const total = rows.reduce((sum, r) => sum + Number(String(r.amount).replace(",", ".")), 0);
    const collectionDate = rows[0].collection_date;
    const creditorName = "Example Creditor";
    const creditorIBAN = "DE89370400440532013000";
    const creditorBIC = "COBADEFFXXX";

    const txs = rows.map(r => `      <DrctDbtTxInf>
        <PmtId>
          <EndToEndId>${escapeXml(r.payment_id)}</EndToEndId>
        </PmtId>
        <InstdAmt Ccy="${escapeXml(r.currency.toUpperCase())}">${Number(String(r.amount).replace(",", ".")).toFixed(2)}</InstdAmt>
        <DrctDbtTx>
          <MndtRltdInf>
            <MndtId>${escapeXml(r.mandate_id)}</MndtId>
            <DtOfSgntr>${escapeXml(collectionDate)}</DtOfSgntr>
            <AmdmntInd>false</AmdmntInd>
          </MndtRltdInf>
        </DrctDbtTx>
        <DbtrAgt>
          <FinInstnId>
            ${r.debtor_bic ? `<BIC>${escapeXml(r.debtor_bic.toUpperCase())}</BIC>` : ""}
          </FinInstnId>
        </DbtrAgt>
        <Dbtr>
          <Nm>${escapeXml(r.debtor_name)}</Nm>
        </Dbtr>
        <DbtrAcct>
          <Id><IBAN>${escapeXml(r.debtor_iban.replace(/\s+/g, "").toUpperCase())}</IBAN></Id>
        </DbtrAcct>
        <RmtInf><Ustrd>${escapeXml(r.remittance || r.payment_id)}</Ustrd></RmtInf>
      </DrctDbtTxInf>`).join("\n");

    return `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.008.001.08">
  <CstmrDrctDbtInitn>
    <GrpHdr>
      <MsgId>${msgId}</MsgId>
      <CreDtTm>${created}</CreDtTm>
      <NbOfTxs>${rows.length}</NbOfTxs>
      <CtrlSum>${total.toFixed(2)}</CtrlSum>
      <InitgPty><Nm>${creditorName}</Nm></InitgPty>
    </GrpHdr>
    <PmtInf>
      <PmtInfId>${msgId}-PMT</PmtInfId>
      <PmtMtd>DD</PmtMtd>
      <BtchBookg>true</BtchBookg>
      <NbOfTxs>${rows.length}</NbOfTxs>
      <CtrlSum>${total.toFixed(2)}</CtrlSum>
      <PmtTpInf>
        <SvcLvl><Cd>SEPA</Cd></SvcLvl>
      </PmtTpInf>
      <ReqdColltnDt>${escapeXml(collectionDate)}</ReqdColltnDt>
      <Cdtr>
        <Nm>${creditorName}</Nm>
      </Cdtr>
      <CdtrAcct><Id><IBAN>${creditorIBAN}</IBAN></Id></CdtrAcct>
      <CdtrAgt><FinInstnId><BIC>${creditorBIC}</BIC></FinInstnId></CdtrAgt>
      <ChrgBr>SLEV</ChrgBr>
${txs}
    </PmtInf>
  </CstmrDrctDbtInitn>
</Document>`;
  }

  function doValidate() {
    try {
      els.csvError.hidden = true;
      const rows = parseCSV(els.csv.value);
      const result = validate(rows);
      lastRows = rows;
      lastXml = "";
      els.xml.textContent = "Validate your records, then generate the XML.";
      els.copy.disabled = true;
      els.download.disabled = true;
      els.downloadQ1x.disabled = true;
      renderValidation(result);
      return result;
    } catch (e) {
      els.csvError.textContent = e.message || String(e);
      els.csvError.hidden = false;
      return null;
    }
  }

  els.sample.addEventListener("click", () => { els.csv.value = SAMPLE; doValidate(); });
  els.validate.addEventListener("click", doValidate);
  els.generate.addEventListener("click", () => {
    const result = doValidate();
    if (!result || result.findings.length) return;
    lastXml = generateXML(lastRows);
    els.xml.textContent = lastXml;
    els.copy.disabled = false;
    els.download.disabled = false;
    els.downloadQ1x.disabled = false;
  });

  els.copy.addEventListener("click", async () => {
    if (!lastXml) return;
    await navigator.clipboard.writeText(lastXml);
    els.copy.textContent = "Copied ✓";
    setTimeout(() => els.copy.textContent = "Copy", 1200);
  });

  els.download.addEventListener("click", () => {
    if (!lastXml) return;
    const blob = new Blob([lastXml], { type: "application/xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "pain.008.001.08.xml";
    a.click(); URL.revokeObjectURL(url);
  });

  // The bank sample is the same pain.008.001.08 XML payload, using .Q1X as the filename extension.
  els.downloadQ1x.addEventListener("click", () => {
    if (!lastXml) return;
    const blob = new Blob([lastXml], { type: "application/xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "pain.008.001.08.Q1X";
    a.click(); URL.revokeObjectURL(url);
  });

  els.file.addEventListener("change", async () => {
    const file = els.file.files[0];
    if (!file) return;
    els.csv.value = await file.text();
    doValidate();
  });

  doValidate();
})();
