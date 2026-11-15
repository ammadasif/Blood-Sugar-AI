import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { BloodSugarReading, AppSettings, PeriodSummary } from '../types';
import { READING_TYPE_LABELS, analyzeReading } from '../utils/analysis';
import { convertFromInternal, formatBloodSugar, formatDate, formatTime } from '../utils/conversions';

export function generatePDFReport(
  readings: BloodSugarReading[],
  settings: AppSettings,
  summary: PeriodSummary,
  reportTitle = 'Comprehensive Blood Sugar Clinical Report'
): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Primary brand colors
  const primaryColor: [number, number, number] = [37, 99, 235]; // #2563eb
  const darkSlate: [number, number, number] = [30, 41, 59]; // #1e293b
  const lightBg: [number, number, number] = [248, 250, 252]; // #f8fafc

  // Header Banner
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, pageWidth, 24, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  doc.text('GLUCOTRACK PRO', 14, 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(224, 231, 255);
  doc.text('Personal Blood Sugar Monitoring & Analysis Log', 14, 18);

  doc.setFontSize(8);
  doc.text(`Generated: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`, pageWidth - 14, 15, {
    align: 'right',
  });

  // Report Title and Subtitle
  let currentY = 32;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(...darkSlate);
  doc.text(reportTitle, 14, currentY);

  currentY += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text(`Evaluation Period: ${summary.periodLabel} | Preferred Unit: ${settings.unit}`, 14, currentY);

  // Summary Metrics Box
  currentY += 6;
  doc.setFillColor(...lightBg);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14, currentY, pageWidth - 28, 30, 2, 2, 'FD');

  const colWidth = (pageWidth - 28) / 4;
  const statY = currentY + 8;

  // Box Item 1: Total & Averages
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('TOTAL READINGS', 18, statY);
  doc.setFontSize(13);
  doc.setTextColor(...darkSlate);
  doc.text(String(summary.totalCount), 18, statY + 6);

  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text(
    `Avg Fasting: ${summary.averageFasting ? formatBloodSugar(summary.averageFasting, settings.unit) : 'N/A'}`,
    18,
    statY + 12
  );

  // Box Item 2: High & Low
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('HIGHEST / LOWEST', 18 + colWidth, statY);
  doc.setFontSize(11);
  doc.setTextColor(225, 29, 72); // Rose
  doc.text(
    `Max: ${summary.highest ? formatBloodSugar(summary.highest.value, settings.unit) : 'N/A'}`,
    18 + colWidth,
    statY + 6
  );
  doc.setFontSize(10);
  doc.setTextColor(13, 148, 136); // Teal
  doc.text(
    `Min: ${summary.lowest ? formatBloodSugar(summary.lowest.value, settings.unit) : 'N/A'}`,
    18 + colWidth,
    statY + 12
  );

  // Box Item 3: Distribution
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('DISTRIBUTION (TIR)', 18 + colWidth * 2, statY);
  doc.setFontSize(9);
  doc.setTextColor(22, 163, 74); // Green
  doc.text(`Normal: ${summary.normalPercentage}% (${summary.normalCount})`, 18 + colWidth * 2, statY + 5);
  doc.setTextColor(217, 119, 6); // Amber
  doc.text(`Elevated: ${summary.elevatedPercentage}% (${summary.elevatedCount})`, 18 + colWidth * 2, statY + 10);
  doc.setTextColor(225, 29, 72); // Red
  doc.text(`High: ${summary.highPercentage}% (${summary.highCount})`, 18 + colWidth * 2, statY + 15);

  // Box Item 4: Glycemic Health Markers
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('CLINICAL ESTIMATES', 18 + colWidth * 3, statY);
  doc.setFontSize(11);
  doc.setTextColor(...darkSlate);
  doc.text(`Est. A1c: ${summary.estimatedA1c ? `${summary.estimatedA1c}%` : 'N/A'}`, 18 + colWidth * 3, statY + 6);
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text(
    `Variability: ${summary.variabilityCV ? `CV ${summary.variabilityCV}%` : 'N/A'}`,
    18 + colWidth * 3,
    statY + 12
  );

  currentY += 36;

  // Table of readings
  const tableData = readings.map((r, idx) => {
    const analysis = analyzeReading(r, settings);
    const sugarFormatted = formatBloodSugar(r.value, settings.unit);
    const typeLabel = READING_TYPE_LABELS[r.type] || r.type;
    return [
      String(idx + 1),
      r.date,
      formatTime(r.time),
      sugarFormatted,
      typeLabel,
      analysis.label,
      analysis.title,
      r.mealInfo || r.notes || '-',
    ];
  });

  autoTable(doc, {
    startY: currentY,
    head: [['#', 'Date', 'Time', 'Blood Sugar', 'Reading Type', 'Status', 'Clinical Interpretation', 'Notes / Meal']],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: [37, 99, 235],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'left',
    },
    bodyStyles: {
      fontSize: 7.5,
      textColor: [30, 41, 59],
      cellPadding: 2,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: 20 },
      2: { cellWidth: 16 },
      3: { cellWidth: 22, fontStyle: 'bold' },
      4: { cellWidth: 28 },
      5: { cellWidth: 18, halign: 'center', fontStyle: 'bold' },
      6: { cellWidth: 42 },
      7: { cellWidth: 'auto' },
    },
    didParseCell: (data) => {
      // Color-code status cell
      if (data.section === 'body' && data.column.index === 5) {
        const val = String(data.cell.raw).toUpperCase();
        if (val === 'NORMAL') {
          data.cell.styles.textColor = [22, 163, 74];
        } else if (val === 'ELEVATED') {
          data.cell.styles.textColor = [217, 119, 6];
        } else if (val === 'HIGH' || val === 'LOW') {
          data.cell.styles.textColor = [225, 29, 72];
        }
      }
    },
  });

  // Footer & Medical Disclaimer on every page
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);

    const disclaimerText =
      'MEDICAL DISCLAIMER: This document is for personal tracking and informational monitoring only. It does not provide medical diagnosis or replace clinical consultation with a licensed physician.';
    doc.text(disclaimerText, 14, pageHeight - 8);

    doc.setFont('helvetica', 'normal');
    doc.text(`Page ${i} of ${pageCount}`, pageWidth - 14, pageHeight - 8, { align: 'right' });
  }

  const filename = `GlucoTrack_Report_${summary.periodLabel.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(filename);
}

