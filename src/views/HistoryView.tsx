import React, { useState, useMemo } from 'react';
import {
  Search,
  Filter,
  ArrowUpDown,
  Trash2,
  Edit2,
  Eye,
  Calendar,
  Utensils,
  FileText,
  CheckSquare,
  Square,
  Download,
  AlertCircle,
  FileSpreadsheet,
  Table,
  List,
  Sparkles,
  Plus,
} from 'lucide-react';
import { useBloodSugar } from '../context/BloodSugarContext';
import { BloodSugarReading, ReadingType, ReadingStatus } from '../types';
import { READING_TYPE_LABELS, analyzeReading } from '../utils/analysis';
import {
  convertFromInternal,
  formatBloodSugar,
  formatDate,
  formatDateDMY,
  formatTime,
} from '../utils/conversions';
import { getDailyMatrixRows } from '../utils/matrixHelper';
import { AnalysisModal } from '../components/AnalysisModal';
import { EditReadingModal } from '../components/EditReadingModal';
import { ConfirmationModal } from '../components/ConfirmationModal';
import {
  exportToExcel,
  exportToDailyMatrixExcel,
  exportToDailyMatrixCSV,
} from '../services/excelService';

export const HistoryView: React.FC = () => {
  const { readings, settings, removeReading, removeMultipleReadings, editReading, setActiveTab } =
    useBloodSugar();

  // View Mode: 'matrix' (Daily Logbook Table matching user's template) or 'list' (Individual entries)
  const [viewMode, setViewMode] = useState<'matrix' | 'list'>('matrix');

  // Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'highest' | 'lowest'>('newest');

  // Selection & Modal States
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [viewingReading, setViewingReading] = useState<BloodSugarReading | null>(null);
  const [editingReading, setEditingReading] = useState<BloodSugarReading | null>(null);
  const [deleteSingleId, setDeleteSingleId] = useState<string | null>(null);
  const [showBatchDeleteModal, setShowBatchDeleteModal] = useState(false);

  // Pagination for list view
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  // Filter and Sort Logic for individual readings
  const filteredReadings = useMemo(() => {
    return readings
      .filter((r) => {
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchesMeal = (r.mealInfo || '').toLowerCase().includes(q);
          const matchesNotes = (r.notes || '').toLowerCase().includes(q);
          const matchesComments = (r.comments || '').toLowerCase().includes(q);
          const matchesType = (READING_TYPE_LABELS[r.type] || '').toLowerCase().includes(q);
          const matchesValue =
            String(r.value).includes(q) ||
            String(convertFromInternal(r.value, settings.unit)).includes(q);
          const matchesDate = r.date.includes(q) || formatDateDMY(r.date).toLowerCase().includes(q);
          if (!matchesMeal && !matchesNotes && !matchesComments && !matchesType && !matchesValue && !matchesDate) {
            return false;
          }
        }

        if (selectedType !== 'all' && r.type !== selectedType) {
          return false;
        }

        if (selectedStatus !== 'all') {
          const analysis = analyzeReading(r, settings);
          if (analysis.status !== selectedStatus) {
            return false;
          }
        }

        if (startDate && r.date < startDate) return false;
        if (endDate && r.date > endDate) return false;

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'newest') {
          return `${b.date}T${b.time}`.localeCompare(`${a.date}T${a.time}`);
        }
        if (sortBy === 'oldest') {
          return `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`);
        }
        if (sortBy === 'highest') {
          return b.value - a.value;
        }
        if (sortBy === 'lowest') {
          return a.value - b.value;
        }
        return 0;
      });
  }, [readings, searchQuery, selectedType, selectedStatus, startDate, endDate, sortBy, settings]);

  // Compute Daily Matrix rows (Day-by-Day Logbook)
  const matrixRows = useMemo(() => {
    const order = sortBy === 'oldest' ? 'asc' : 'desc';
    return getDailyMatrixRows(filteredReadings, settings, order);
  }, [filteredReadings, settings, sortBy]);

  // Paginated Slices for list view
  const totalPages = Math.ceil(filteredReadings.length / pageSize) || 1;
  const paginatedReadings = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredReadings.slice(start, start + pageSize);
  }, [filteredReadings, currentPage]);

  // Bulk Selection Handlers
  const handleSelectAllOnPage = () => {
    const next = new Set(selectedIds);
    const allOnPageSelected = paginatedReadings.every((r) => next.has(r.id));
    if (allOnPageSelected) {
      paginatedReadings.forEach((r) => next.delete(r.id));
    } else {
      paginatedReadings.forEach((r) => next.add(r.id));
    }
    setSelectedIds(next);
  };

  const handleToggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleExportSelected = () => {
    const selectedList = readings.filter((r) => selectedIds.has(r.id));
    if (selectedList.length === 0) return;
    exportToDailyMatrixExcel(selectedList, settings, `Selected_${selectedList.length}_Readings`);
  };

  // Helper for rendering a matrix blood sugar pill
  const renderReadingCell = (r?: BloodSugarReading) => {
    if (!r) {
      return <span className="text-slate-300 dark:text-slate-600 font-mono text-center block">—</span>;
    }

    const analysis = analyzeReading(r, settings);
    let badgeClass = 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800';
    if (analysis.status === 'elevated') {
      badgeClass = 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800';
    } else if (analysis.status === 'high' || analysis.status === 'low') {
      badgeClass = 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800';
    }

    return (
      <button
        onClick={() => setViewingReading(r)}
        title={`Click for full analysis: ${analysis.title}`}
        className={`px-2.5 py-1 rounded-xl border text-xs font-bold transition shadow-xs hover:scale-105 ${badgeClass}`}
      >
        {convertFromInternal(r.value, settings.unit)}
      </button>
    );
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* View Switcher & Quick Export Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-4 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Toggle between Matrix & List */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl w-full sm:w-auto">
          <button
            onClick={() => setViewMode('matrix')}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
              viewMode === 'matrix'
                ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <Table className="w-4 h-4" />
            <span>Daily Logbook (Matrix Format)</span>
          </button>

          <button
            onClick={() => setViewMode('list')}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
              viewMode === 'list'
                ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <List className="w-4 h-4" />
            <span>Detailed List View</span>
          </button>
        </div>

        {/* Quick Export in Daily Matrix format */}
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <button
            onClick={() => exportToDailyMatrixExcel(filteredReadings, settings)}
            disabled={filteredReadings.length === 0}
            className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition flex items-center gap-1.5 disabled:opacity-40"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Export Logbook (.xlsx)</span>
          </button>

          <button
            onClick={() => exportToDailyMatrixCSV(filteredReadings, settings)}
            disabled={filteredReadings.length === 0}
            className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 text-xs font-semibold shadow-sm transition flex items-center gap-1.5 disabled:opacity-40"
          >
            <Download className="w-3.5 h-3.5" />
            <span>CSV</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search date, value, meal, symptoms..."
              className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            {viewMode === 'list' && (
              <select
                value={selectedType}
                onChange={(e) => {
                  setSelectedType(e.target.value);
                  setCurrentPage(1);
                }}
                className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-700 dark:text-slate-300 focus:outline-none"
              >
                <option value="all">All Reading Types</option>
                <option value="fasting">Fasting</option>
                <option value="before_meal">Before Meal</option>
                <option value="1h_after_meal">1h After Meal</option>
                <option value="2h_after_meal">2h After Meal</option>
                <option value="random">Random</option>
              </select>
            )}

            <select
              value={selectedStatus}
              onChange={(e) => {
                setSelectedStatus(e.target.value);
                setCurrentPage(1);
              }}
              className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-700 dark:text-slate-300 focus:outline-none"
            >
              <option value="all">All Statuses</option>
              <option value="normal">Normal</option>
              <option value="elevated">Elevated / Attention</option>
              <option value="high">High</option>
              <option value="low">Low</option>
            </select>

            <select
              value={sortBy}
              onChange={(e) => {
                setSortBy(e.target.value as any);
                setCurrentPage(1);
              }}
              className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-700 dark:text-slate-300 focus:outline-none"
            >
              <option value="newest">Sort: Newest First</option>
              <option value="oldest">Sort: Oldest First</option>
              <option value="highest">Sort: Sugar Level (High to Low)</option>
              <option value="lowest">Sort: Sugar Level (Low to High)</option>
            </select>
          </div>
        </div>

        {/* Date Range Row */}
        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
          <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
            <Calendar className="w-4 h-4 text-slate-400" />
            <span>Date Range:</span>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setCurrentPage(1);
              }}
              className="px-2.5 py-1 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
            />
            <span className="text-slate-400">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setCurrentPage(1);
              }}
              className="px-2.5 py-1 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
            />
          </div>

          {(searchQuery || selectedType !== 'all' || selectedStatus !== 'all' || startDate || endDate) && (
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedType('all');
                setSelectedStatus('all');
                setStartDate('');
                setEndDate('');
                setCurrentPage(1);
              }}
              className="text-xs text-blue-600 hover:underline font-semibold ml-auto"
            >
              Clear All Filters
            </button>
          )}
        </div>
      </div>

      {/* ===================================================================== */}
      {/* VIEW 1: DAILY LOGBOOK MATRIX TABLE (Exact format requested)           */}
      {/* ===================================================================== */}
      {viewMode === 'matrix' ? (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Table className="w-4 h-4 text-blue-600" />
                  Daily Blood Sugar Logbook Table
                </h3>
                <p className="text-[11px] text-slate-400">
                  Daily morning fasting and 2-hour post-prandial glycemic log ({settings.unit})
                </p>
              </div>
              <span className="text-xs font-semibold text-slate-500 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-full">
                {matrixRows.length} Days Recorded
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-center text-xs min-w-[700px]">
                <thead>
                  <tr className="bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                    <th className="py-3.5 px-3 w-16 text-center">Sr. No.</th>
                    <th className="py-3.5 px-4 text-left">Date</th>
                    <th className="py-3.5 px-4">Fasting ({settings.unit})</th>
                    <th className="py-3.5 px-4">2 Hours After Breakfast ({settings.unit})</th>
                    <th className="py-3.5 px-4">2 Hours After Lunch ({settings.unit})</th>
                    <th className="py-3.5 px-4">2 Hours After Dinner ({settings.unit})</th>
                    <th className="py-3.5 px-4">Daily Avg</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {matrixRows.length > 0 ? (
                    matrixRows.map((row) => (
                      <tr
                        key={row.date}
                        className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        <td className="py-3 px-3 text-slate-400 font-medium">{row.srNo}</td>
                        <td className="py-3 px-4 text-left whitespace-nowrap">
                          <span className="font-bold text-slate-900 dark:text-white">
                            {row.dateDisplay}
                          </span>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">{renderReadingCell(row.fasting)}</td>
                        <td className="py-3 px-4 whitespace-nowrap">{renderReadingCell(row.breakfast)}</td>
                        <td className="py-3 px-4 whitespace-nowrap">{renderReadingCell(row.lunch)}</td>
                        <td className="py-3 px-4 whitespace-nowrap">{renderReadingCell(row.dinner)}</td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          {row.averageValue ? (
                            <span className="font-bold text-slate-800 dark:text-slate-200">
                              {formatBloodSugar(row.averageValue, settings.unit)}
                            </span>
                          ) : (
                            <span className="text-slate-300 dark:text-slate-600">—</span>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-xs text-slate-400">
                        No blood sugar logbook entries match your filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Reference Range Legend matching user's template */}
            <div className="p-4 bg-slate-50/70 dark:bg-slate-800/40 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
              <div className="flex flex-wrap items-center gap-2 sm:gap-4">
                <span className="font-bold text-slate-700 dark:text-slate-300">Reference Ranges:</span>
                <span className="text-slate-600 dark:text-slate-400">
                  <strong>Fasting (8–10 hours):</strong>{' '}
                  {convertFromInternal(settings.ranges.lowThreshold, settings.unit)}–
                  {convertFromInternal(settings.ranges.fasting.normalMax, settings.unit)} {settings.unit}
                </span>
                <span className="text-slate-600 dark:text-slate-400">
                  <strong>2 Hours After Meal:</strong>{' '}
                  {settings.unit === 'mmol/L' ? '3.9' : '70'}–
                  {convertFromInternal(settings.ranges.afterMeal2h.normalMax, settings.unit)} {settings.unit}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500" /> Normal
                <span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-500 ml-2" /> Elevated
                <span className="inline-block w-2.5 h-2.5 rounded-full bg-rose-500 ml-2" /> High / Low
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* ===================================================================== */
        /* VIEW 2: DETAILED LIST VIEW                                           */
        /* ===================================================================== */
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[750px]">
              <thead>
                <tr className="bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">
                  <th className="py-3 px-4 w-10">
                    <button
                      onClick={handleSelectAllOnPage}
                      className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    >
                      {paginatedReadings.length > 0 &&
                      paginatedReadings.every((r) => selectedIds.has(r.id)) ? (
                        <CheckSquare className="w-4 h-4 text-blue-600" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>
                  </th>
                  <th className="py-3 px-3">Date & Time</th>
                  <th className="py-3 px-3">Blood Sugar</th>
                  <th className="py-3 px-3">Measurement Type</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3">Clinical Context</th>
                  <th className="py-3 px-3">Meal Info / Notes</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {paginatedReadings.length > 0 ? (
                  paginatedReadings.map((r) => {
                    const analysis = analyzeReading(r, settings);
                    const isSelected = selectedIds.has(r.id);

                    return (
                      <tr
                        key={r.id}
                        className={`hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors ${
                          isSelected ? 'bg-blue-50/40 dark:bg-blue-950/30' : ''
                        }`}
                      >
                        <td className="py-3 px-4">
                          <button
                            onClick={() => handleToggleSelect(r.id)}
                            className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                          >
                            {isSelected ? (
                              <CheckSquare className="w-4 h-4 text-blue-600" />
                            ) : (
                              <Square className="w-4 h-4" />
                            )}
                          </button>
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          <span className="font-semibold text-slate-800 dark:text-slate-200">
                            {formatDateDMY(r.date)}
                          </span>
                          <span className="text-slate-400 ml-1.5">{formatTime(r.time)}</span>
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          <span className="text-sm font-extrabold text-slate-900 dark:text-white">
                            {formatBloodSugar(r.value, settings.unit)}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                          {READING_TYPE_LABELS[r.type]}
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                              analysis.status === 'normal'
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300'
                                : analysis.status === 'elevated'
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300'
                                : 'bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300'
                            }`}
                          >
                            {analysis.label}
                          </span>
                        </td>
                        <td className="py-3 px-3 max-w-xs truncate text-slate-600 dark:text-slate-400">
                          {analysis.title}
                        </td>
                        <td className="py-3 px-3 max-w-xs truncate text-slate-500 dark:text-slate-400">
                          {r.mealInfo || r.notes || r.comments || '—'}
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap space-x-1">
                          <button
                            onClick={() => setViewingReading(r)}
                            title="View clinical analysis"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setEditingReading(r)}
                            title="Edit reading"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeleteSingleId(r.id)}
                            title="Delete reading"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-xs text-slate-400">
                      No readings found matching the current search & filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
            <div>
              Showing{' '}
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                {filteredReadings.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}
              </span>{' '}
              to{' '}
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                {Math.min(currentPage * pageSize, filteredReadings.length)}
              </span>{' '}
              of{' '}
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                {filteredReadings.length}
              </span>{' '}
              filtered entries
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 disabled:opacity-40 transition font-medium"
              >
                Previous
              </button>
              <span className="px-2 font-semibold text-slate-700 dark:text-slate-300">
                {currentPage} / {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 disabled:opacity-40 transition font-medium"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Analysis Modal */}
      {viewingReading && (
        <AnalysisModal
          isOpen={!!viewingReading}
          reading={viewingReading}
          settings={settings}
          onClose={() => setViewingReading(null)}
          onEdit={(r) => {
            setViewingReading(null);
            setEditingReading(r);
          }}
          onDelete={(id) => {
            setViewingReading(null);
            setDeleteSingleId(id);
          }}
        />
      )}

      {/* Edit Modal */}
      {editingReading && (
        <EditReadingModal
          isOpen={!!editingReading}
          reading={editingReading}
          settings={settings}
          onClose={() => setEditingReading(null)}
          onSave={async (updated) => {
            await editReading(updated);
          }}
        />
      )}

      {/* Confirmation Modal for Single Delete */}
      <ConfirmationModal
        isOpen={!!deleteSingleId}
        title="Delete Reading?"
        message="Are you sure you want to permanently delete this blood sugar measurement? This action cannot be undone."
        confirmText="Delete"
        isDanger
        onConfirm={async () => {
          if (deleteSingleId) {
            await removeReading(deleteSingleId);
            setDeleteSingleId(null);
          }
        }}
        onCancel={() => setDeleteSingleId(null)}
      />

      {/* Confirmation Modal for Batch Delete */}
      <ConfirmationModal
        isOpen={showBatchDeleteModal}
        title={`Delete ${selectedIds.size} Readings?`}
        message={`Are you sure you want to permanently remove ${selectedIds.size} selected records from your browser database?`}
        confirmText="Delete Selected"
        isDanger
        onConfirm={async () => {
          await removeMultipleReadings(Array.from(selectedIds));
          setSelectedIds(new Set());
          setShowBatchDeleteModal(false);
        }}
        onCancel={() => setShowBatchDeleteModal(false)}
      />
    </div>
  );
};
