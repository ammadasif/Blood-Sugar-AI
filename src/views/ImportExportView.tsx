import React, { useState, useRef } from 'react';
import {
  FileSpreadsheet,
  Download,
  Upload,
  FileText,
  Database,
  Trash2,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  ShieldCheck,
  RotateCcw,
  Clock,
  Sparkles,
} from 'lucide-react';
import { useBloodSugar } from '../context/BloodSugarContext';
import {
  exportToExcel,
  exportToDailyMatrixExcel,
  exportToDailyMatrixCSV,
  parseExcelFile,
  downloadExcelTemplate,
  downloadCSVTemplate,
  ExcelImportResult,
} from '../services/excelService';
import { exportCSV, exportTXT, exportJSONBackup, parseJSONBackup } from '../services/backupService';
import { ConfirmationModal } from '../components/ConfirmationModal';
import { formatDate } from '../utils/conversions';

export const ImportExportView: React.FC = () => {
  const { readings, settings, importReadings, clearAllData, markBackupCompleted, updateSettings } =
    useBloodSugar();

  // Excel Import state
  const [isParsingExcel, setIsParsingExcel] = useState(false);
  const [excelResult, setExcelResult] = useState<ExcelImportResult | null>(null);
  const [excelError, setExcelError] = useState<string | null>(null);
  const [includeDuplicates, setIncludeDuplicates] = useState(false);
  const excelInputRef = useRef<HTMLInputElement>(null);

  // JSON Restore state
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [jsonSuccess, setJsonSuccess] = useState<string | null>(null);
  const jsonInputRef = useRef<HTMLInputElement>(null);

  // Clear All Modal
  const [showClearModal, setShowClearModal] = useState(false);

  // Success banner
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // 1. Excel File Upload Handler
  const handleExcelFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsParsingExcel(true);
      setExcelError(null);
      setExcelResult(null);

      const result = await parseExcelFile(file, readings, settings);
      setExcelResult(result);
    } catch (err: any) {
      setExcelError(err?.message || 'Failed to parse Excel file.');
    } finally {
      setIsParsingExcel(false);
      if (excelInputRef.current) excelInputRef.current.value = '';
    }
  };

  // 2. Confirm Excel Import
  const handleConfirmExcelImport = async () => {
    if (!excelResult) return;

    const toImportRows = includeDuplicates
      ? [...excelResult.validRows, ...excelResult.duplicateRows]
      : excelResult.validRows;

    const validReadings = toImportRows
      .map((row) => row.parsedReading)
      .filter((r): r is NonNullable<typeof r> => !!r);

    if (validReadings.length === 0) {
      setExcelError('No valid readings available to import.');
      return;
    }

    try {
      const count = await importReadings(validReadings);
      setActionSuccess(`Successfully imported ${count} blood sugar records from Excel!`);
      setExcelResult(null);
    } catch (err: any) {
      setExcelError(err?.message || 'Failed to import records.');
    }
  };

  // 3. JSON Backup Import
  const handleJSONFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setJsonError(null);
      setJsonSuccess(null);

      const payload = await parseJSONBackup(file);
      if (payload.settings) {
        updateSettings(payload.settings);
      }
      const count = await importReadings(payload.readings);
      setJsonSuccess(`Successfully restored ${count} readings and application settings!`);
    } catch (err: any) {
      setJsonError(err?.message || 'Failed to restore JSON backup.');
    } finally {
      if (jsonInputRef.current) jsonInputRef.current.value = '';
    }
  };

  // Export triggers with backup recording
  const handleExportDailyMatrixExcel = () => {
    exportToDailyMatrixExcel(readings, settings);
    markBackupCompleted();
  };

  const handleExportDailyMatrixCSV = () => {
    exportToDailyMatrixCSV(readings, settings);
    markBackupCompleted();
  };

  const handleExportExcelAll = () => {
    exportToExcel(readings, settings, 'All_Readings');
    markBackupCompleted();
  };

  const handleExportExcelFasting = () => {
    const fasting = readings.filter((r) => r.type === 'fasting');
    exportToExcel(fasting, settings, 'Fasting_Readings_Only');
    markBackupCompleted();
  };

  const handleExportExcelPostMeal = () => {
    const postMeal = readings.filter((r) => r.type === '2h_after_meal' || r.type === '1h_after_meal');
    exportToExcel(postMeal, settings, 'Post_Meal_Readings_Only');
    markBackupCompleted();
  };

  const handleExportCSV = () => {
    exportCSV(readings, settings);
    markBackupCompleted();
  };

  const handleExportTXT = () => {
    exportTXT(readings, settings);
    markBackupCompleted();
  };

  const handleExportJSON = () => {
    exportJSONBackup(readings, settings);
    markBackupCompleted();
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Feedback Alert */}
      {actionSuccess && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 rounded-2xl flex items-center justify-between text-xs text-emerald-800 dark:text-emerald-200 animate-fade-in">
          <div className="flex items-center gap-2 font-semibold">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{actionSuccess}</span>
          </div>
          <button onClick={() => setActionSuccess(null)} className="underline hover:no-underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Main Grid: Import (Left) & Export/Backup (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ================= SECTION 1: EXCEL IMPORT ================= */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                Import Excel Records
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Upload existing spreadsheets (.xlsx or .xls) with automatic validation
              </p>
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-md">
              SheetJS Powered
            </span>
          </div>

          {/* Upload Dropzone */}
          <div className="border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-500 rounded-2xl p-6 text-center space-y-3 transition bg-slate-50/50 dark:bg-slate-800/30">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center">
              <Upload className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                Click to browse or drop an Excel spreadsheet (.xlsx, .xls)
              </p>
              <p className="text-[11px] text-slate-400">
                Supported columns: Date, Time, Blood Sugar / Reading, Type, Notes, Meal
              </p>
            </div>

            <input
              ref={excelInputRef}
              type="file"
              accept=".xlsx, .xls"
              onChange={handleExcelFileSelected}
              className="hidden"
              id="excel-file-input"
            />
            <label
              htmlFor="excel-file-input"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-bold cursor-pointer shadow-sm transition"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Select Excel File</span>
            </label>
          </div>

          {/* Download Import Template Card */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  Import Template Files (.xlsx / .csv)
                </h4>
              </div>
              <span className="text-[10px] text-slate-400 font-medium">Ready to fill</span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
              Download our pre-formatted template with sample entries and column guidelines. Fill in your data and upload it above.
            </p>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => downloadExcelTemplate(settings.unit)}
                className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-emerald-300 dark:border-emerald-700/60 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-xs font-semibold shadow-sm transition flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Excel Template (.xlsx)</span>
              </button>
              <button
                type="button"
                onClick={() => downloadCSVTemplate(settings.unit)}
                className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-semibold shadow-sm transition flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download CSV Template (.csv)</span>
              </button>
            </div>
          </div>

          {excelError && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{excelError}</span>
            </div>
          )}

          {/* Excel Preview & Duplicate Review Table */}
          {excelResult && (
            <div className="space-y-4 border-t border-slate-100 dark:border-slate-800 pt-4 animate-fade-in">
              <div className="flex items-center justify-between text-xs">
                <div>
                  <span className="font-bold text-slate-800 dark:text-slate-200 block">
                    Spreadsheet Preview ({excelResult.totalRows} {excelResult.formatDetected === 'matrix_daily' ? 'readings extracted from daily matrix' : 'rows parsed'})
                  </span>
                  {excelResult.formatDetected === 'matrix_daily' && (
                    <span className="inline-block mt-0.5 text-[10px] font-bold text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-950/80 px-2 py-0.5 rounded-md">
                      ✓ Daily Logbook Matrix Format (Fasting, Breakfast, Lunch, Dinner)
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 font-medium">
                  <span className="text-emerald-600 font-bold">{excelResult.validRows.length} Valid</span>
                  <span>•</span>
                  <span className="text-amber-600 font-bold">{excelResult.duplicateRows.length} Duplicates</span>
                  <span>•</span>
                  <span className="text-rose-600 font-bold">{excelResult.invalidRows.length} Invalid</span>
                </div>
              </div>

              {/* Duplicate Handling Checkbox */}
              {excelResult.duplicateRows.length > 0 && (
                <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeDuplicates}
                    onChange={(e) => setIncludeDuplicates(e.target.checked)}
                    className="rounded text-blue-600 focus:ring-blue-500"
                  />
                  <span>
                    Also import <strong>{excelResult.duplicateRows.length} duplicate records</strong> (matching existing date & time)
                  </span>
                </label>
              )}

              {/* Preview Table */}
              <div className="max-h-56 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-xl text-xs">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 dark:bg-slate-800 sticky top-0 text-[11px] text-slate-400 font-semibold">
                    <tr>
                      <th className="p-2">Row</th>
                      <th className="p-2">Date & Time</th>
                      <th className="p-2">Blood Sugar</th>
                      <th className="p-2">Type</th>
                      <th className="p-2">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-[11px]">
                    {excelResult.allPreviewRows.slice(0, 30).map((r) => (
                      <tr key={r.rowNumber} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="p-2 text-slate-400">#{r.rowNumber}</td>
                        <td className="p-2 font-medium text-slate-700 dark:text-slate-300">
                          {r.date} {r.time}
                        </td>
                        <td className="p-2 font-bold text-slate-900 dark:text-white">
                          {r.sugarLevel} {r.unit}
                        </td>
                        <td className="p-2 capitalize">{r.typeRaw}</td>
                        <td className="p-2">
                          <span
                            className={`px-1.5 py-0.5 rounded font-bold uppercase text-[9px] ${
                              r.status === 'valid'
                                ? 'bg-emerald-100 text-emerald-800'
                                : r.status === 'duplicate'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {r.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Import Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setExcelResult(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmExcelImport}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm flex items-center gap-1.5 transition"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>
                    Confirm Import (
                    {includeDuplicates
                      ? excelResult.validRows.length + excelResult.duplicateRows.length
                      : excelResult.validRows.length}{' '}
                    Records)
                  </span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ================= SECTION 2: EXCEL EXPORT ================= */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-5">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Download className="w-5 h-5 text-blue-600" />
              Export to Excel (.xlsx)
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Generate formatted workbooks with column headers, summary KPIs and clinical context
            </p>
          </div>

          <div className="space-y-3">
            {/* Daily Matrix Logbook Export - Featured Format */}
            <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-50 to-emerald-50 dark:from-blue-950/40 dark:to-emerald-950/40 border border-blue-200 dark:border-blue-800/60 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-600 text-white rounded-xl">
                    <FileSpreadsheet className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                      Export Daily Logbook Table (Matrix Format)
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Columns: Date | Fasting | 2h Breakfast | 2h Lunch | 2h Dinner
                    </p>
                  </div>
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider bg-blue-600 text-white px-2 py-0.5 rounded-md">
                  Standard Format
                </span>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={handleExportDailyMatrixExcel}
                  disabled={readings.length === 0}
                  className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm transition flex items-center gap-1.5 disabled:opacity-40"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Excel (.xlsx)</span>
                </button>
                <button
                  onClick={handleExportDailyMatrixCSV}
                  disabled={readings.length === 0}
                  className="px-3.5 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold shadow-sm hover:bg-slate-50 transition flex items-center gap-1.5 disabled:opacity-40"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download CSV (.csv)</span>
                </button>
              </div>
            </div>

            <button
              onClick={handleExportExcelAll}
              disabled={readings.length === 0}
              className="w-full p-4 rounded-2xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/40 hover:bg-blue-100/70 transition flex items-center justify-between text-left disabled:opacity-40"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-600 text-white rounded-xl">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white">Export All Readings</h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Full history with summary sheet ({readings.length} total entries)
                  </p>
                </div>
              </div>
              <Download className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </button>

            <button
              onClick={handleExportExcelFasting}
              disabled={readings.length === 0}
              className="w-full p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 transition flex items-center justify-between text-left disabled:opacity-40"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-600 text-white rounded-xl">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white">Export Fasting Readings Only</h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Filtered solely for morning and pre-meal fasting measurements
                  </p>
                </div>
              </div>
              <Download className="w-4 h-4 text-slate-500" />
            </button>

            <button
              onClick={handleExportExcelPostMeal}
              disabled={readings.length === 0}
              className="w-full p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 transition flex items-center justify-between text-left disabled:opacity-40"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-600 text-white rounded-xl">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white">Export Post-Meal Readings Only</h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    1-hour and 2-hour post-prandial glycemic responses
                  </p>
                </div>
              </div>
              <Download className="w-4 h-4 text-slate-500" />
            </button>
          </div>
        </div>

        {/* ================= SECTION 3: NOTEPAD & CSV BACKUPS ================= */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-5">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-600" />
              Notepad & Text Backups
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Standard plain text and CSV files for universal readability on any device
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={handleExportCSV}
              disabled={readings.length === 0}
              className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800 text-left transition space-y-2 disabled:opacity-40"
            >
              <div className="p-2 bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 rounded-xl w-fit">
                <FileText className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900 dark:text-white">Export CSV File</h4>
                <p className="text-[10px] text-slate-400">Comma-separated records</p>
              </div>
            </button>

            <button
              onClick={handleExportTXT}
              disabled={readings.length === 0}
              className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800 text-left transition space-y-2 disabled:opacity-40"
            >
              <div className="p-2 bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200 rounded-xl w-fit">
                <FileText className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900 dark:text-white">Export Notepad (.txt)</h4>
                <p className="text-[10px] text-slate-400">Formatted human-readable log</p>
              </div>
            </button>
          </div>

          <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl flex items-center justify-between text-xs text-slate-500">
            <span>Last Backup Recorded:</span>
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              {settings.lastBackupDate ? formatDate(settings.lastBackupDate.split('T')[0]) : 'Never'}
            </span>
          </div>
        </div>

        {/* ================= SECTION 4: FULL JSON BACKUP & RESTORE ================= */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-5">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Database className="w-5 h-5 text-teal-600" />
              Full Database JSON Backup & Restore
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Complete snapshot including custom thresholds, settings and all measurement records
            </p>
          </div>

          {jsonError && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{jsonError}</span>
            </div>
          )}

          {jsonSuccess && (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs rounded-xl flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{jsonSuccess}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={handleExportJSON}
              disabled={readings.length === 0}
              className="p-4 rounded-2xl border border-teal-200 dark:border-teal-900/60 bg-teal-50/50 dark:bg-teal-950/30 hover:bg-teal-100/50 text-left transition space-y-2 disabled:opacity-40"
            >
              <div className="p-2 bg-teal-600 text-white rounded-xl w-fit">
                <Download className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900 dark:text-white">Download JSON Backup</h4>
                <p className="text-[10px] text-slate-400">All data + settings</p>
              </div>
            </button>

            <div>
              <input
                ref={jsonInputRef}
                type="file"
                accept=".json"
                onChange={handleJSONFileSelected}
                className="hidden"
                id="json-file-input"
              />
              <label
                htmlFor="json-file-input"
                className="block p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800 text-left transition space-y-2 cursor-pointer h-full"
              >
                <div className="p-2 bg-blue-600 text-white rounded-xl w-fit">
                  <Upload className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white">Restore JSON Backup</h4>
                  <p className="text-[10px] text-slate-400">Load backup file</p>
                </div>
              </label>
            </div>
          </div>

          {/* Danger Zone: Clear all */}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <div className="text-xs text-slate-400">Erase all records stored in this browser</div>
            <button
              onClick={() => setShowClearModal(true)}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition flex items-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear All Data</span>
            </button>
          </div>
        </div>
      </div>

      {/* Clear All Confirmation Modal */}
      <ConfirmationModal
        isOpen={showClearModal}
        title="Permanently Clear All Blood Sugar Readings?"
        message="This will delete every recorded measurement from your browser's IndexedDB storage. Be sure you have exported an Excel or JSON backup if you wish to keep your records."
        confirmText="Erase Everything"
        isDanger
        onConfirm={async () => {
          await clearAllData();
          setShowClearModal(false);
          setActionSuccess('All blood sugar records have been cleared from local storage.');
        }}
        onCancel={() => setShowClearModal(false)}
      />
    </div>
  );
};

