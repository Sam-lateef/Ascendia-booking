'use client';

import React, { useState } from 'react';
import { useTranslations } from '@/lib/i18n/TranslationProvider';
import { ChevronDown, Search } from 'lucide-react';
import { Treatment } from './types';
import { treatments, categoryLabels } from './treatments';

interface TreatmentSelectorProps {
  selectedTreatment: Treatment | null;
  onSelect: (treatment: Treatment) => void;
}

export const TreatmentSelector: React.FC<TreatmentSelectorProps> = ({
  selectedTreatment,
  onSelect,
}) => {
  const tCommon = useTranslations('common');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  const groupedTreatments = treatments.reduce((acc, treatment) => {
    if (!acc[treatment.category]) {
      acc[treatment.category] = [];
    }
    acc[treatment.category].push(treatment);
    return acc;
  }, {} as Record<string, Treatment[]>);

  const filteredTreatments = searchTerm
    ? treatments.filter(
        t =>
          t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          t.code.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : null;

  const handleCategoryClick = (category: string) => {
    setExpandedCategory(expandedCategory === category ? null : category);
  };

  const handleTreatmentClick = (treatment: Treatment) => {
    onSelect(treatment);
    setSearchTerm('');
    setExpandedCategory(null);
  };

  return (
    <div className="space-y-3">
      {/* Search input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder={tCommon('search_treatments')}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
        />
      </div>

      {/* Search results */}
      {filteredTreatments && (
        <div className="max-h-48 overflow-y-auto border rounded-lg divide-y">
          {filteredTreatments.length === 0 ? (
            <p className="p-3 text-sm text-gray-500 text-center">
              No results found
            </p>
          ) : (
            filteredTreatments.map((treatment) => (
              <button
                key={treatment.id}
                onClick={() => handleTreatmentClick(treatment)}
                className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors ${
                  selectedTreatment?.id === treatment.id ? 'bg-blue-50' : ''
                }`}
              >
                <div className="font-medium text-gray-900">{treatment.name}</div>
                <div className="text-xs text-gray-500">
                  {treatment.code} • ${treatment.price.toLocaleString('en-US')}
                </div>
              </button>
            ))
          )}
        </div>
      )}

      {/* Category accordion */}
      {!filteredTreatments && (
        <div className="border rounded-lg divide-y max-h-64 overflow-y-auto">
          {Object.entries(groupedTreatments).map(([category, categoryTreatments]) => (
            <div key={category}>
              <button
                onClick={() => handleCategoryClick(category)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
              >
                <span className="font-medium text-gray-900">
                  {categoryLabels[category] || category}
                </span>
                <ChevronDown
                  className={`h-4 w-4 text-gray-500 transition-transform ${
                    expandedCategory === category ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {expandedCategory === category && (
                <div className="bg-gray-50 divide-y divide-gray-100">
                  {categoryTreatments.map((treatment) => (
                    <button
                      key={treatment.id}
                      onClick={() => handleTreatmentClick(treatment)}
                      className={`w-full text-left px-6 py-2 hover:bg-gray-100 transition-colors ${
                        selectedTreatment?.id === treatment.id
                          ? 'bg-blue-100'
                          : ''
                      }`}
                    >
                      <div className="text-sm text-gray-900">{treatment.name}</div>
                      <div className="text-xs text-gray-500">
                        ${treatment.price.toLocaleString('en-US')} • {treatment.duration} min
                        {treatment.requiresSurface && ' • Surface required'}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
