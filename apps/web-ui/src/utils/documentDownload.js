// Utilities for detecting and downloading AI-generated HR documents as PDF.
// Uses jsPDF (text-based) — no html2canvas required for core rendering.

import jsPDF from 'jspdf';
import logoRaw from '../assets/alignedDarkLogo.svg?raw';

// ── Detection helpers ─────────────────────────────────────────────────────────

export const DOCUMENT_SIGNATURE = 'Document generated successfully';

export const isDocumentMessage = (content) =>
  typeof content === 'string' && content.includes(DOCUMENT_SIGNATURE);

export const extractDocumentTitle = (content) => {
  const m = content.match(/\*\*([^*]+)\*\*/);
  return m ? m[1] : 'Generated Document';
};

export const extractDocumentContent = (content) => {
  const m = content.match(/---\n\n([\s\S]+?)\n\n---/);
  return m ? m[1] : content;
};

// ── SVG → PNG data URL (for jsPDF addImage) ───────────────────────────────────
// Uses ?raw import so there is zero CORS exposure.
// The dark logo has white-filled text paths (designed for dark backgrounds).
// We replace fill="white" with a dark colour so the text is visible on white PDF.

const prepareLogoSvg = (raw) =>
  raw.replace(/fill="white"/gi, 'fill="#1a1a1a"');

const svgToPng = (svgText, renderW = 420, renderH = 101) =>
  new Promise((resolve) => {
    const fixed    = prepareLogoSvg(svgText);
    const dataUrl  = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(fixed)))}`;
    const img      = new Image();
    img.onload = () => {
      const canvas  = document.createElement('canvas');
      canvas.width  = renderW;
      canvas.height = renderH;
      const ctx     = canvas.getContext('2d');
      // White background so any remaining transparent areas are opaque in the PDF
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, renderW, renderH);
      ctx.drawImage(img, 0, 0, renderW, renderH);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });

// ── Markdown line classifier ──────────────────────────────────────────────────

const stripInline = (t) =>
  t.replace(/\*\*(.*?)\*\*/g, '$1').replace(/_(.*?)_/g, '$1').trim();

const classifyLine = (raw) => {
  const line = raw.trimEnd();
  if (!line) return { type: 'empty' };
  if (/^(-{3,}|\*{3,}|_{3,})$/.test(line)) return { type: 'rule' };
  const hm = line.match(/^(#{1,3})\s+(.*)/);
  if (hm) return { type: `h${hm[1].length}`, text: stripInline(hm[2]) };
  if (line.startsWith('- ')) return { type: 'li', text: stripInline(line.slice(2)) };
  return { type: 'p', text: stripInline(line) };
};

// ── PDF layout constants ──────────────────────────────────────────────────────

const MARGIN_X      = 22;   // left/right margin (mm)
const MARGIN_TOP    = 18;
const MARGIN_BOTTOM = 20;   // space reserved for footer
const FOOTER_H      = 14;   // total footer zone height (mm)

// Logo dimensions in PDF (mm) — original SVG is 141×34, aspect ≈ 4.147
const LOGO_W = 50;
const LOGO_H = Math.round((LOGO_W / 141) * 34 * 10) / 10; // ≈ 12.1 mm

// ── Footer renderer (called for every page after content is done) ─────────────


const addFooterToAllPages = (doc, logoPng) => {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const total = doc.internal.getNumberOfPages();
  const lineY = pageH - FOOTER_H + 2;

  for (let i = 1; i <= total; i++) {
    doc.setPage(i);

    // Thin separator line
    doc.setDrawColor(180);
    doc.setLineWidth(0.25);
    doc.line(MARGIN_X, lineY, pageW - MARGIN_X, lineY);

    // Small logo on the left of footer
    if (logoPng) {
      const fLogoW = 30;
      const fLogoH = (fLogoW / 141) * 34;
      doc.addImage(logoPng, 'PNG', MARGIN_X, lineY + 3, fLogoW, fLogoH);
    }

    // "Aligned Automation" text next to logo
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100);
    doc.text('Aligned Automation', MARGIN_X + (logoPng ? 33 : 0), lineY + 7);

    // Confidential notice — centered
    doc.setFontSize(7.5);
    doc.setTextColor(150);
    doc.text('This document is confidential and intended solely for the named recipient.',
      pageW / 2, lineY + 7, { align: 'center' });

    // Page number — right
    doc.setFontSize(8);
    doc.setTextColor(100);
    doc.text(`Page ${i} of ${total}`, pageW - MARGIN_X, lineY + 7, { align: 'right' });

    doc.setTextColor(0);
  }
};

// ── Main PDF download ─────────────────────────────────────────────────────────

export const downloadDocument = async (content) => {
  const title    = extractDocumentTitle(content);
  const bodyMd   = extractDocumentContent(content);
  const safeName = title.replace(/[^a-z0-9\s]/gi, '').replace(/\s+/g, '_') || 'document';

  // Convert raw SVG text → PNG data URL (no network request, no CORS)
  const logoPng = await svgToPng(logoRaw);

  const doc    = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
  const pageW  = doc.internal.pageSize.getWidth();
  const pageH  = doc.internal.pageSize.getHeight();
  const textW  = pageW - MARGIN_X * 2;

  // ── Header: logo centered on page 1 ────────────────────────────────────────
  let y = MARGIN_TOP;
  if (logoPng) {
    doc.addImage(logoPng, 'PNG', (pageW - LOGO_W) / 2, y, LOGO_W, LOGO_H);
    y += LOGO_H + 6;
  }

  // Thin line below header logo
  doc.setDrawColor(200);
  doc.setLineWidth(0.25);
  doc.line(MARGIN_X, y, pageW - MARGIN_X, y);
  y += 6;

  // ── Overflow guard (accounts for footer zone) ───────────────────────────────
  const guard = (needed) => {
    if (y + needed > pageH - MARGIN_BOTTOM - FOOTER_H) {
      doc.addPage();
      y = MARGIN_TOP;
    }
  };

  // ── Content rendering ────────────────────────────────────────────────────────
  for (const raw of bodyMd.split('\n')) {
    const { type, text } = classifyLine(raw);

    switch (type) {
      case 'empty':
        y += 3;
        break;

      case 'rule':
        guard(5);
        doc.setDrawColor(160);
        doc.setLineWidth(0.3);
        doc.line(MARGIN_X, y, pageW - MARGIN_X, y);
        y += 5;
        break;

      case 'h1': {
        guard(12);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        const ls = doc.splitTextToSize(text, textW);
        doc.text(ls, pageW / 2, y, { align: 'center' });
        y += ls.length * 6.5 + 3;
        break;
      }

      case 'h2': {
        guard(10);
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        const ls = doc.splitTextToSize(text, textW);
        doc.text(ls, pageW / 2, y, { align: 'center' });
        y += ls.length * 6 + 2;
        break;
      }

      case 'h3': {
        guard(8);
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        const ls = doc.splitTextToSize(text, textW);
        doc.text(ls, MARGIN_X, y);
        y += ls.length * 5.5 + 2;
        break;
      }

      case 'li': {
        guard(7);
        doc.setFontSize(11);
        doc.setFont('helvetica', 'normal');
        const ls = doc.splitTextToSize(`•  ${text}`, textW - 4);
        doc.text(ls, MARGIN_X + 3, y);
        y += ls.length * 5.5 + 1;
        break;
      }

      default: { // 'p'
        guard(7);
        doc.setFontSize(11);
        doc.setFont('helvetica', 'normal');
        const ls = doc.splitTextToSize(text, textW);
        doc.text(ls, MARGIN_X, y);
        y += ls.length * 5.5 + 1;
        break;
      }
    }
  }

  // ── Footer on every page ─────────────────────────────────────────────────────
  addFooterToAllPages(doc, logoPng);

  doc.save(`${safeName}.pdf`);
};

// ── Print preview (HTML window → browser Print → Save as PDF) ────────────────

export const printDocument = (content) => {
  const title    = extractDocumentTitle(content);
  const bodyMd   = extractDocumentContent(content);
  const fixedSvg = prepareLogoSvg(logoRaw);
  const absLogo  = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(fixedSvg)))}`;

  const mdToHtml = (md) => {
    const out = [];
    let inList = false;
    for (const raw of md.split('\n')) {
      const line = raw.trimEnd();
      if (/^(-{3,}|\*{3,}|_{3,})$/.test(line)) {
        if (inList) { out.push('</ul>'); inList = false; }
        out.push('<hr>');
        continue;
      }
      const hm = line.match(/^(#{1,3})\s+(.*)/);
      if (hm) {
        if (inList) { out.push('</ul>'); inList = false; }
        out.push(`<h${hm[1].length}>${hm[2].replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')}</h${hm[1].length}>`);
        continue;
      }
      if (line.startsWith('- ')) {
        if (!inList) { out.push('<ul>'); inList = true; }
        out.push(`<li>${line.slice(2).replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')}</li>`);
        continue;
      }
      if (inList) { out.push('</ul>'); inList = false; }
      if (!line) { out.push('<br>'); continue; }
      out.push(`<p>${line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')}</p>`);
    }
    if (inList) out.push('</ul>');
    return out.join('\n');
  };

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: "Times New Roman", Times, serif; font-size: 12pt; color: #000; background: #fff; }
    .page { max-width: 760px; margin: 0 auto; padding: 40px 60px 80px; }
    .doc-header { text-align: center; margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid #ddd; }
    .doc-header img { height: 36px; }
    h1 { font-size: 15pt; text-align: center; margin: 12px 0 4px; }
    h2 { font-size: 13pt; text-align: center; margin: 10px 0 4px; }
    h3 { font-size: 11pt; margin: 8px 0 3px; }
    p  { margin: 5px 0; text-align: justify; }
    ul { margin: 5px 0 5px 22px; }
    li { margin: 2px 0; }
    hr { border: none; border-top: 1px solid #555; margin: 12px 0; }
    .doc-footer {
      position: fixed; bottom: 0; left: 0; right: 0;
      border-top: 1px solid #ddd;
      padding: 6px 60px;
      display: flex; align-items: center; justify-content: space-between;
      font-size: 8pt; color: #777;
      background: #fff;
    }
    .doc-footer img { height: 18px; }
    .footer-center { position: absolute; left: 50%; transform: translateX(-50%); font-size: 7.5pt; color: #aaa; }
    @media print {
      @page { margin: 18mm 22mm 28mm; }
      .page { padding: 0 0 60px; }
      .doc-footer { position: fixed; bottom: 0; }
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="doc-header">
      <img src="${absLogo}" alt="Aligned Automation" />
    </div>
    ${mdToHtml(bodyMd)}
  </div>
  <div class="doc-footer">
    <img src="${absLogo}" alt="Aligned Automation" />
    <span class="footer-center" >This document is confidential and intended solely for the named recipient.</span>
    <span>Aligned Automation</span>
  </div>
</body>
</html>`;

  const win = window.open('', '_blank', 'width=900,height=700');
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 500);
};
