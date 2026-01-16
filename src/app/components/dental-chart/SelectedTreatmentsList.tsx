'use client';

import React from 'react';
import { useTranslations } from '@/lib/i18n/TranslationProvider';
import { Trash2, AlertCircle } from 'lucide-react';
import { useDentalChartStore } from './dentalChartStore';
import { categoryLabels } from './treatments';

export const SelectedTreatmentsList: React.FC = () => {
  const tCommon = useTranslations('common');
  const { chartedTreatments, removeTreatment, clearAll } = useDentalChartStore();

  if (chartedTreatments.length === 0) {
    return (
      <div className="bg-gray-50 rounded-lg p-6 text-center">
        <AlertCircle className="h-8 w-8 text-gray-400 mx-auto mb-2" />
        <p className="text-gray-500">{tCommon('no_treatments_added_yet')}</p>
        <p className="text-sm text-gray-400 mt-1">
          Select a tooth from the chart to add a treatment
        </p>
      </div>
    );
  }

  const totalPrice = chartedTreatments.reduce(
    (sum, t) => sum + t.treatment.price,
    0
  );
  const totalDuration = chartedTreatments.reduce(
    (sum, t) => sum + t.treatment.duration,
    0
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900">
          Planned Treatments ({chartedTreatments.length})
        </h3>
        <button
          onClick={clearAll}
          className="text-sm text-red-500 hover:text-red-700"
        >
          Clear All
        </button>
      </div>

      {/* Treatment list */}
      <div className="space-y-2">
        {chartedTreatments.map((charted) => (
          <div
            key={charted.id}
            className="flex items-start justify-between bg-white border rounded-lg p-4"
          >
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-semibold text-sm">
                  {charted.tooth.toothFdi}
                </span>
                <div>
                  <h4 className="font-medium text-gray-900">
                    {charted.treatment.name}
                  </h4>
                  <p className="text-xs text-gray-500">
                    {categoryLabels[charted.treatment.category]}
                    {charted.tooth.surfaces.length > 0 && (
                      <> • Surface: {charted.tooth.surfaces.join('')}</>
                    )}
                  </p>
                </div>
              </div>
              {charted.notes && (
                <p className="mt-2 text-sm text-gray-600 bg-gray-50 rounded p-2">
                  {charted.notes}
                </p>
              )}
            </div>
            <div className="flex items-start gap-4 ml-4">
              <div className="text-right">
                <p className="font-medium text-gray-900">
                  ${charted.treatment.price.toLocaleString('en-US')}
                </p>
                <p className="text-xs text-gray-500">
                  {charted.treatment.duration} min
                </p>
              </div>
              <button
                onClick={() => removeTreatment(charted.id)}
                className="p-1 text-gray-400 hover:text-red-500 transition-colors"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Summary */}
      <div className="bg-blue-50 rounded-lg p-4">
        <div className="flex justify-between items-center">
          <div>
            <p className="text-sm text-blue-700">{tCommon('total_amount')}</p>
            <p className="text-2xl font-bold text-blue-900">
              ${totalPrice.toLocaleString('en-US')}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-blue-700">{tCommon('estimated_duration')}</p>
            <p className="text-lg font-semibold text-blue-900">
              ~{Math.ceil(totalDuration / 60)}h {totalDuration % 60}min
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
