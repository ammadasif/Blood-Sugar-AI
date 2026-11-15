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
} from 'lucide-react';
import { useBloodSugar } from '../context/BloodSugarContext';
import { BloodSugarReading, ReadingType, ReadingStatus } from '../types';
import { READING_TYPE_LABELS, analyzeReading } from '../utils/analysis';
import { convertFromInternal, formatBloodSugar, formatDate, formatTime } from '../utils/conversions';
import { AnalysisModal } from '../components/AnalysisModal';
import { EditReadingModal } from '../components/EditReadingModal';
import { ConfirmationModal } from '../components/ConfirmationModal';
import { exportToExcel } from '../services/excelService';

export const HistoryView: React.FC = () => {
  const { readings, settings, removeReading, removeMultipleReadings, editReading, setActiveTab } =
    useBloodSugar();

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

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  // Filter and Sort Logic
  const filteredReadings = useMemo(() => {
    return readings
      .filter((r) => {
        // Search query filter (matches notes, mealInfo, comments)
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchesMeal = (r.mealInfo || '').toLowerCase().includes(q);
          const matchesNotes = (r.notes || '').toLowerCase().includes(q);
          const matchesComments = (r.comments || '').toLowerCase().includes(q);
          const matchesType = (READING_TYPE_LABELS[r.type] || '').toLowerCase().includes(q);
          if (!matchesMeal && !matchesNotes && !matchesComments && !matchesType) {
            return false;
          }
        }

        // Reading Type filter
        if (selectedType !== 'all' && r.type !== selectedType) {
          return false;
        }

        // Status filter
        if (selectedStatus !== 'all') {
          const analysis = analyzeReading(r, settings);
          if (analysis.status !== selectedStatus) {
            return false;
          }
        }

        // Date range filter
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

  // Paginated Slices
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
    exportToExcel(selectedList, settings, `Selected_${selectedList.length}_Records`);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Filter & Search Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search notes, meals, symptoms..."
              className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Quick Filters */}
          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            {/* Reading Type Filter */}
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

            {/* Status Filter */}
            <select
              value={selectedStatus}
              onChange={(e) => {
                setSelectedStatus(e.target.value);
                setCurrentPage(1);
              }}
              className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-700 dark:text-slate-300 focus:outline-none"
            >
              <option value="all">All Classifications</option>
              <option value="normal">Normal</option>
              <option value="elevated">Elevated / Attention</option>
              <option value="high">High</option>
              <option value="low">Low</option>
            </select>

            {/* Sort Dropdown */}
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

      {/* Batch Action Bar if items selected */}
      {selectedIds.size > 0 && (
        <div className="bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 rounded-2xl p-3 px-5 flex items-center justify-between shadow-sm animate-fade-in">
          <span className="text-xs font-bold text-blue-900 dark:text-blue-100">
            {selectedIds.size} {selectedIds.size === 1 ? 'record' : 'records'} selected
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportSelected}
              className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-blue-200 dark:border-blue-700 text-blue-700 dark:text-blue-300 text-xs font-semibold shadow-sm flex items-center gap-1.5 hover:bg-blue-50"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Export Selected</span>
            </button>
            <button
              onClick={() => setShowBatchDeleteModal(true)}
              className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-sm flex items-center gap-1.5 transition"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete Selected</span>
            </button>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="text-xs text-blue-600 hover:underline px-2"
            >
              Deselect
            </button>
          </div>
        </div>
      )}

      {/* Readings Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
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
                paginatedReadings.map((r, index) => {
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
                          {formatDate(r.date)}
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
            filtered entries (Total: {readings.length})
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
