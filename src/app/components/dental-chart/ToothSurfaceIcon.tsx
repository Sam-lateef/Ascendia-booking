'use client';

import React from 'react';
import { useTranslations } from '@/lib/i18n/TranslationProvider';
import { ToothSurface } from './types';

interface ToothSurfaceIconProps {
  selectedSurfaces: ToothSurface[];
  onSurfaceClick: (surface: ToothSurface) => void;
  toothType: string;
  size?: number;
}

const isAnteriorTooth = (toothType: string): boolean => {
  const anteriorTypes = ['Central Incisor', 'Lateral Incisor', 'Canine'];
  return anteriorTypes.some(t => toothType.includes(t));
};

export const ToothSurfaceIcon: React.FC<ToothSurfaceIconProps> = ({
  selectedSurfaces,
  onSurfaceClick,
  toothType,
  size = 200,
}) => {
  const tCommon = useTranslations('common');
  const isAnterior = isAnteriorTooth(toothType);
  const centerLabel = isAnterior ? 'I' : 'O';

  const isSelected = (surface: ToothSurface) => selectedSurfaces.includes(surface);

  const defaultFill = '#f1f5f9';  // slate-100
  const selectedFill = '#3b82f6'; // blue-500
  const strokeColor = '#94a3b8';  // slate-400
  const textColor = '#475569';    // slate-600
  const selectedTextColor = '#ffffff';

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      className="tooth-surface-selector"
    >
      {/* Mesial (Top) */}
      <g
        onClick={() => onSurfaceClick('M')}
        className="cursor-pointer"
        role="button"
        aria-label={tCommon('mesial_surface')}
      >
        <polygon
          points="100,10 140,50 100,70 60,50"
          fill={isSelected('M') ? selectedFill : defaultFill}
          stroke={strokeColor}
          strokeWidth="2"
          className="transition-colors hover:brightness-95"
        />
        <text
          x="100"
          y="45"
          textAnchor="middle"
          fontSize="16"
          fontWeight="bold"
          fill={isSelected('M') ? selectedTextColor : textColor}
        >
          M
        </text>
      </g>

      {/* Buccal/Labial (Left) */}
      <g
        onClick={() => onSurfaceClick('B')}
        className="cursor-pointer"
        role="button"
        aria-label={tCommon('buccal_surface')}
      >
        <polygon
          points="10,100 60,50 60,150"
          fill={isSelected('B') ? selectedFill : defaultFill}
          stroke={strokeColor}
          strokeWidth="2"
          className="transition-colors hover:brightness-95"
        />
        <text
          x="35"
          y="105"
          textAnchor="middle"
          fontSize="16"
          fontWeight="bold"
          fill={isSelected('B') ? selectedTextColor : textColor}
        >
          B
        </text>
      </g>

      {/* Occlusal/Incisal (Center) */}
      <g
        onClick={() => onSurfaceClick('O')}
        className="cursor-pointer"
        role="button"
        aria-label={isAnterior ? 'Incisal surface' : 'Occlusal surface'}
      >
        <polygon
          points="60,50 140,50 140,150 60,150"
          fill={isSelected('O') ? selectedFill : defaultFill}
          stroke={strokeColor}
          strokeWidth="2"
          className="transition-colors hover:brightness-95"
        />
        <text
          x="100"
          y="105"
          textAnchor="middle"
          fontSize="20"
          fontWeight="bold"
          fill={isSelected('O') ? selectedTextColor : textColor}
        >
          {centerLabel}
        </text>
      </g>

      {/* Lingual (Right) */}
      <g
        onClick={() => onSurfaceClick('L')}
        className="cursor-pointer"
        role="button"
        aria-label={tCommon('lingual_surface')}
      >
        <polygon
          points="190,100 140,50 140,150"
          fill={isSelected('L') ? selectedFill : defaultFill}
          stroke={strokeColor}
          strokeWidth="2"
          className="transition-colors hover:brightness-95"
        />
        <text
          x="165"
          y="105"
          textAnchor="middle"
          fontSize="16"
          fontWeight="bold"
          fill={isSelected('L') ? selectedTextColor : textColor}
        >
          L
        </text>
      </g>

      {/* Distal (Bottom) */}
      <g
        onClick={() => onSurfaceClick('D')}
        className="cursor-pointer"
        role="button"
        aria-label={tCommon('distal_surface')}
      >
        <polygon
          points="100,190 140,150 100,130 60,150"
          fill={isSelected('D') ? selectedFill : defaultFill}
          stroke={strokeColor}
          strokeWidth="2"
          className="transition-colors hover:brightness-95"
        />
        <text
          x="100"
          y="165"
          textAnchor="middle"
          fontSize="16"
          fontWeight="bold"
          fill={isSelected('D') ? selectedTextColor : textColor}
        >
          D
        </text>
      </g>
    </svg>
  );
};
