'use client';

import React, { useMemo } from 'react';
import { useTranslations } from '@/lib/i18n/TranslationProvider';
import { useDentalChartStore } from './dentalChartStore';
import { SelectedTooth } from './types';

interface ToothChartProps {
  onToothClick?: (tooth: SelectedTooth) => void;
}

export const ToothChart: React.FC<ToothChartProps> = ({ onToothClick }) => {
  const tCommon = useTranslations('common');
  const { selectTooth, chartedTreatments } = useDentalChartStore();

  const teethWithTreatments = useMemo(() => {
    const teeth = new Set<string>();
    chartedTreatments.forEach((t) => {
      teeth.add(t.tooth.toothFdi);
    });
    return Array.from(teeth);
  }, [chartedTreatments]);

  const handleToothClick = (toothData: { fdi: string; type: string }) => {
    const tooth: SelectedTooth = {
      id: `teeth-${toothData.fdi}`,
      notations: {
        fdi: toothData.fdi,
        universal: toothData.fdi,
        palmer: toothData.fdi,
      },
      type: toothData.type,
    };
    
    if (onToothClick) {
      onToothClick(tooth);
    } else {
      selectTooth(tooth);
    }
  };

  // FDI tooth numbers for adult dentition
  const upperTeeth = ['18', '17', '16', '15', '14', '13', '12', '11', '21', '22', '23', '24', '25', '26', '27', '28'];
  const lowerTeeth = ['48', '47', '46', '45', '44', '43', '42', '41', '31', '32', '33', '34', '35', '36', '37', '38'];

  const getToothType = (fdi: string): string => {
    const num = parseInt(fdi.slice(-1));
    if (num === 1) return 'Central Incisor';
    if (num === 2) return 'Lateral Incisor';
    if (num === 3) return 'Canine';
    if (num === 4) return 'First Premolar';
    if (num === 5) return 'Second Premolar';
    if (num === 6) return 'First Molar';
    if (num === 7) return 'Second Molar';
    if (num === 8) return 'Third Molar (Wisdom)';
    return 'Tooth';
  };

  const hasTreatment = (fdi: string): boolean => teethWithTreatments.includes(fdi);

  return (
    <div className="relative">
      <style>{`
        .tooth-button {
          transition: all 0.15s ease;
        }
        .tooth-button:hover {
          transform: scale(1.1);
        }
        .tooth-button.has-treatment {
          background: linear-gradient(135deg, #3b82f6, #1d4ed8);
          box-shadow: 0 0 0 2px #60a5fa;
        }
      `}</style>

      <div className="p-4 bg-gray-50 rounded-xl border">
        {/* Upper arch label */}
        <div className="text-center text-xs text-gray-500 mb-2">{tCommon('upper_arch_maxilla')}</div>
        
        {/* Upper teeth */}
        <div className="flex justify-center gap-1 mb-4">
          {upperTeeth.map((fdi) => (
            <button
              key={fdi}
              onClick={() => handleToothClick({ fdi, type: getToothType(fdi) })}
              className={`tooth-button w-8 h-10 rounded-lg border-2 flex items-center justify-center text-xs font-semibold ${
                hasTreatment(fdi)
                  ? 'has-treatment text-white border-blue-500'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100 hover:border-gray-400'
              }`}
              title={`Tooth ${fdi} - ${getToothType(fdi)}`}
            >
              {fdi}
            </button>
          ))}
        </div>

        {/* Midline indicator */}
        <div className="flex justify-center mb-4">
          <div className="w-0.5 h-4 bg-gray-300"></div>
        </div>

        {/* Lower teeth */}
        <div className="flex justify-center gap-1 mb-2">
          {lowerTeeth.map((fdi) => (
            <button
              key={fdi}
              onClick={() => handleToothClick({ fdi, type: getToothType(fdi) })}
              className={`tooth-button w-8 h-10 rounded-lg border-2 flex items-center justify-center text-xs font-semibold ${
                hasTreatment(fdi)
                  ? 'has-treatment text-white border-blue-500'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100 hover:border-gray-400'
              }`}
              title={`Tooth ${fdi} - ${getToothType(fdi)}`}
            >
              {fdi}
            </button>
          ))}
        </div>

        {/* Lower arch label */}
        <div className="text-center text-xs text-gray-500 mt-2">{tCommon('lower_arch_mandible')}</div>
      </div>

      {/* Legend */}
      <div className="mt-4 flex items-center justify-center gap-6 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-white border-2 border-gray-300" />
          <span className="text-gray-600">{tCommon('no_treatment')}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-blue-500 border-2 border-blue-600" />
          <span className="text-gray-600">{tCommon('treatment_planned')}</span>
        </div>
      </div>
    </div>
  );
};
