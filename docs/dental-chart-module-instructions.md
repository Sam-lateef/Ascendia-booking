# Dental Chart Module - Complete Build Instructions for Cursor

## Overview

Build an interactive dental charting module for a booking system that allows dentists to:
1. View a full-mouth dental chart
2. Click on teeth to select them
3. Select specific tooth surfaces (M, O, D, B, L) via popup
4. Assign treatments to selected teeth/surfaces
5. Save selections to patient records

## Tech Stack

- React 18+ with TypeScript
- react-odontogram (npm package) for the dental chart
- Tailwind CSS for styling
- Zustand or React Context for state management
- Node.js/Express backend (existing booking system)

---

## Part 1: Project Setup

### 1.1 Install Dependencies

```bash
npm install react-odontogram
npm install zustand  # for state management
npm install @headlessui/react  # for accessible modals
npm install lucide-react  # for icons
```

### 1.2 Create Folder Structure

```
src/
├── components/
│   └── dental-chart/
│       ├── DentalChartModule.tsx      # Main container component
│       ├── ToothChart.tsx             # Wrapper for react-odontogram
│       ├── SurfaceSelector.tsx        # 5-surface popup component
│       ├── TreatmentSelector.tsx      # Treatment picker dropdown
│       ├── SelectedTreatmentsList.tsx # List of selected treatments
│       ├── ToothSurfaceIcon.tsx       # SVG component for surface visual
│       └── types.ts                   # TypeScript interfaces
├── stores/
│   └── dentalChartStore.ts            # Zustand store for chart state
├── hooks/
│   └── useDentalChart.ts              # Custom hook for chart logic
└── data/
    └── treatments.ts                  # Treatment catalog data
```

---

## Part 2: TypeScript Interfaces

### 2.1 Create `src/components/dental-chart/types.ts`

```typescript
// Tooth notation from react-odontogram
export interface ToothNotation {
  fdi: string;      // FDI notation (used in Turkey/Europe): "11", "21", "36", etc.
  universal: string; // US notation
  palmer: string;    // Palmer notation
}

export interface SelectedTooth {
  id: string;
  notations: ToothNotation;
  type: string; // "Central Incisor", "Molar", etc.
}

// 5 surfaces of a tooth
export type ToothSurface = 'M' | 'O' | 'D' | 'B' | 'L';
// M = Mesial (front/toward midline)
// O = Occlusal (top/chewing surface) - for posterior teeth
// I = Incisal (edge) - for anterior teeth (alternative to O)
// D = Distal (back/away from midline)
// B = Buccal (cheek side) / Labial (lip side for front teeth)
// L = Lingual (tongue side)

export interface ToothSurfaceSelection {
  toothId: string;
  toothFdi: string;
  toothType: string;
  surfaces: ToothSurface[];
}

export interface Treatment {
  id: string;
  code: string;           // Turkish dental code or custom code
  name: string;           // e.g., "Dolgu", "Kanal Tedavisi"
  nameEn: string;         // English name
  category: TreatmentCategory;
  price: number;
  duration: number;       // in minutes
  requiresSurface: boolean; // true for fillings, false for extractions
}

export type TreatmentCategory = 
  | 'restorative'      // Fillings, crowns
  | 'endodontic'       // Root canals
  | 'periodontal'      // Gum treatments
  | 'surgical'         // Extractions
  | 'prosthodontic'    // Dentures, bridges
  | 'preventive'       // Cleanings, sealants
  | 'diagnostic';      // X-rays, exams

export interface ChartedTreatment {
  id: string;                    // unique ID for this entry
  tooth: ToothSurfaceSelection;
  treatment: Treatment;
  notes?: string;
  status: 'planned' | 'completed' | 'in-progress';
  createdAt: Date;
}

export interface DentalChartState {
  // Current selections (in-progress)
  selectedTooth: SelectedTooth | null;
  selectedSurfaces: ToothSurface[];
  isSurfaceSelectorOpen: boolean;
  
  // Charted treatments (saved)
  chartedTreatments: ChartedTreatment[];
  
  // Actions
  selectTooth: (tooth: SelectedTooth) => void;
  closeSurfaceSelector: () => void;
  toggleSurface: (surface: ToothSurface) => void;
  clearSurfaces: () => void;
  addTreatment: (treatment: Treatment, notes?: string) => void;
  removeTreatment: (treatmentId: string) => void;
  clearAll: () => void;
}
```

---

## Part 3: State Management

### 3.1 Create `src/stores/dentalChartStore.ts`

```typescript
import { create } from 'zustand';
import { 
  DentalChartState, 
  SelectedTooth, 
  ToothSurface, 
  Treatment,
  ChartedTreatment 
} from '../components/dental-chart/types';

export const useDentalChartStore = create<DentalChartState>((set, get) => ({
  // Initial state
  selectedTooth: null,
  selectedSurfaces: [],
  isSurfaceSelectorOpen: false,
  chartedTreatments: [],

  // Select a tooth (opens surface selector)
  selectTooth: (tooth: SelectedTooth) => {
    set({
      selectedTooth: tooth,
      selectedSurfaces: [],
      isSurfaceSelectorOpen: true,
    });
  },

  // Close surface selector without saving
  closeSurfaceSelector: () => {
    set({
      isSurfaceSelectorOpen: false,
      selectedTooth: null,
      selectedSurfaces: [],
    });
  },

  // Toggle a surface selection
  toggleSurface: (surface: ToothSurface) => {
    const current = get().selectedSurfaces;
    const exists = current.includes(surface);
    
    set({
      selectedSurfaces: exists
        ? current.filter(s => s !== surface)
        : [...current, surface],
    });
  },

  // Clear all selected surfaces
  clearSurfaces: () => {
    set({ selectedSurfaces: [] });
  },

  // Add a treatment to the chart
  addTreatment: (treatment: Treatment, notes?: string) => {
    const { selectedTooth, selectedSurfaces, chartedTreatments } = get();
    
    if (!selectedTooth) return;

    // For treatments that don't require surface (like extractions), use empty array
    const surfaces = treatment.requiresSurface ? selectedSurfaces : [];

    const newTreatment: ChartedTreatment = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      tooth: {
        toothId: selectedTooth.id,
        toothFdi: selectedTooth.notations.fdi,
        toothType: selectedTooth.type,
        surfaces: surfaces,
      },
      treatment,
      notes,
      status: 'planned',
      createdAt: new Date(),
    };

    set({
      chartedTreatments: [...chartedTreatments, newTreatment],
      isSurfaceSelectorOpen: false,
      selectedTooth: null,
      selectedSurfaces: [],
    });
  },

  // Remove a treatment from the chart
  removeTreatment: (treatmentId: string) => {
    set({
      chartedTreatments: get().chartedTreatments.filter(t => t.id !== treatmentId),
    });
  },

  // Clear everything
  clearAll: () => {
    set({
      selectedTooth: null,
      selectedSurfaces: [],
      isSurfaceSelectorOpen: false,
      chartedTreatments: [],
    });
  },
}));
```

---

## Part 4: Treatment Catalog Data

### 4.1 Create `src/data/treatments.ts`

```typescript
import { Treatment } from '../components/dental-chart/types';

// Turkish dental treatments catalog
// Your sister will need to update prices and add more treatments
export const treatments: Treatment[] = [
  // Restorative
  {
    id: 'filling-composite',
    code: 'REST-001',
    name: 'Kompozit Dolgu',
    nameEn: 'Composite Filling',
    category: 'restorative',
    price: 800,
    duration: 30,
    requiresSurface: true,
  },
  {
    id: 'filling-amalgam',
    code: 'REST-002',
    name: 'Amalgam Dolgu',
    nameEn: 'Amalgam Filling',
    category: 'restorative',
    price: 500,
    duration: 30,
    requiresSurface: true,
  },
  {
    id: 'crown-porcelain',
    code: 'REST-003',
    name: 'Porselen Kron',
    nameEn: 'Porcelain Crown',
    category: 'restorative',
    price: 3500,
    duration: 60,
    requiresSurface: false,
  },
  {
    id: 'crown-zirconia',
    code: 'REST-004',
    name: 'Zirkonyum Kron',
    nameEn: 'Zirconia Crown',
    category: 'restorative',
    price: 4500,
    duration: 60,
    requiresSurface: false,
  },
  {
    id: 'inlay',
    code: 'REST-005',
    name: 'İnley',
    nameEn: 'Inlay',
    category: 'restorative',
    price: 2500,
    duration: 45,
    requiresSurface: true,
  },
  {
    id: 'onlay',
    code: 'REST-006',
    name: 'Onley',
    nameEn: 'Onlay',
    category: 'restorative',
    price: 3000,
    duration: 45,
    requiresSurface: true,
  },

  // Endodontic
  {
    id: 'root-canal-anterior',
    code: 'ENDO-001',
    name: 'Kanal Tedavisi (Ön Diş)',
    nameEn: 'Root Canal (Anterior)',
    category: 'endodontic',
    price: 1500,
    duration: 60,
    requiresSurface: false,
  },
  {
    id: 'root-canal-premolar',
    code: 'ENDO-002',
    name: 'Kanal Tedavisi (Küçük Azı)',
    nameEn: 'Root Canal (Premolar)',
    category: 'endodontic',
    price: 2000,
    duration: 75,
    requiresSurface: false,
  },
  {
    id: 'root-canal-molar',
    code: 'ENDO-003',
    name: 'Kanal Tedavisi (Büyük Azı)',
    nameEn: 'Root Canal (Molar)',
    category: 'endodontic',
    price: 2500,
    duration: 90,
    requiresSurface: false,
  },
  {
    id: 'retreatment',
    code: 'ENDO-004',
    name: 'Kanal Tedavisi Yenileme',
    nameEn: 'Root Canal Retreatment',
    category: 'endodontic',
    price: 3000,
    duration: 90,
    requiresSurface: false,
  },

  // Surgical
  {
    id: 'extraction-simple',
    code: 'SURG-001',
    name: 'Basit Çekim',
    nameEn: 'Simple Extraction',
    category: 'surgical',
    price: 500,
    duration: 20,
    requiresSurface: false,
  },
  {
    id: 'extraction-surgical',
    code: 'SURG-002',
    name: 'Cerrahi Çekim',
    nameEn: 'Surgical Extraction',
    category: 'surgical',
    price: 1200,
    duration: 45,
    requiresSurface: false,
  },
  {
    id: 'extraction-wisdom',
    code: 'SURG-003',
    name: 'Yirmilik Diş Çekimi',
    nameEn: 'Wisdom Tooth Extraction',
    category: 'surgical',
    price: 2000,
    duration: 60,
    requiresSurface: false,
  },
  {
    id: 'implant',
    code: 'SURG-004',
    name: 'İmplant',
    nameEn: 'Dental Implant',
    category: 'surgical',
    price: 15000,
    duration: 90,
    requiresSurface: false,
  },

  // Periodontal
  {
    id: 'scaling',
    code: 'PERIO-001',
    name: 'Diş Taşı Temizliği',
    nameEn: 'Scaling/Cleaning',
    category: 'periodontal',
    price: 600,
    duration: 30,
    requiresSurface: false,
  },
  {
    id: 'deep-cleaning',
    code: 'PERIO-002',
    name: 'Derin Temizlik',
    nameEn: 'Deep Cleaning (SRP)',
    category: 'periodontal',
    price: 1500,
    duration: 60,
    requiresSurface: false,
  },
  {
    id: 'gum-surgery',
    code: 'PERIO-003',
    name: 'Diş Eti Cerrahisi',
    nameEn: 'Gum Surgery',
    category: 'periodontal',
    price: 3000,
    duration: 90,
    requiresSurface: false,
  },

  // Preventive
  {
    id: 'fluoride',
    code: 'PREV-001',
    name: 'Flor Uygulaması',
    nameEn: 'Fluoride Treatment',
    category: 'preventive',
    price: 300,
    duration: 15,
    requiresSurface: false,
  },
  {
    id: 'sealant',
    code: 'PREV-002',
    name: 'Fissür Örtücü',
    nameEn: 'Fissure Sealant',
    category: 'preventive',
    price: 400,
    duration: 20,
    requiresSurface: true,
  },

  // Prosthodontic
  {
    id: 'veneer',
    code: 'PROS-001',
    name: 'Lamina Veneer',
    nameEn: 'Porcelain Veneer',
    category: 'prosthodontic',
    price: 5000,
    duration: 60,
    requiresSurface: false,
  },
  {
    id: 'bridge-unit',
    code: 'PROS-002',
    name: 'Köprü (Birim)',
    nameEn: 'Bridge (per unit)',
    category: 'prosthodontic',
    price: 4000,
    duration: 60,
    requiresSurface: false,
  },
  {
    id: 'denture-partial',
    code: 'PROS-003',
    name: 'Parsiyel Protez',
    nameEn: 'Partial Denture',
    category: 'prosthodontic',
    price: 6000,
    duration: 120,
    requiresSurface: false,
  },
  {
    id: 'denture-full',
    code: 'PROS-004',
    name: 'Tam Protez',
    nameEn: 'Full Denture',
    category: 'prosthodontic',
    price: 8000,
    duration: 120,
    requiresSurface: false,
  },

  // Diagnostic
  {
    id: 'xray-periapical',
    code: 'DIAG-001',
    name: 'Periapikal Röntgen',
    nameEn: 'Periapical X-ray',
    category: 'diagnostic',
    price: 100,
    duration: 5,
    requiresSurface: false,
  },
  {
    id: 'xray-panoramic',
    code: 'DIAG-002',
    name: 'Panoramik Röntgen',
    nameEn: 'Panoramic X-ray',
    category: 'diagnostic',
    price: 300,
    duration: 10,
    requiresSurface: false,
  },
  {
    id: 'exam',
    code: 'DIAG-003',
    name: 'Muayene',
    nameEn: 'Oral Examination',
    category: 'diagnostic',
    price: 200,
    duration: 15,
    requiresSurface: false,
  },
];

// Helper to get treatments by category
export const getTreatmentsByCategory = (category: string): Treatment[] => {
  return treatments.filter(t => t.category === category);
};

// Category labels in Turkish
export const categoryLabels: Record<string, string> = {
  restorative: 'Restoratif',
  endodontic: 'Endodonti',
  periodontal: 'Periodontoloji',
  surgical: 'Cerrahi',
  prosthodontic: 'Protez',
  preventive: 'Koruyucu',
  diagnostic: 'Teşhis',
};
```

---

## Part 5: React Components

### 5.1 Create `src/components/dental-chart/ToothSurfaceIcon.tsx`

This is the SVG component that shows the 5 clickable surfaces.

```typescript
import React from 'react';
import { ToothSurface } from './types';

interface ToothSurfaceIconProps {
  selectedSurfaces: ToothSurface[];
  onSurfaceClick: (surface: ToothSurface) => void;
  toothType: string; // to determine if anterior (show I) or posterior (show O)
  size?: number;
}

// Determine if tooth is anterior (incisors, canines) or posterior (premolars, molars)
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
  const isAnterior = isAnteriorTooth(toothType);
  const centerLabel = isAnterior ? 'I' : 'O'; // Incisal vs Occlusal

  const isSelected = (surface: ToothSurface) => selectedSurfaces.includes(surface);

  // Colors
  const defaultFill = '#f3f4f6';  // gray-100
  const selectedFill = '#3b82f6'; // blue-500
  const hoverFill = '#dbeafe';    // blue-100
  const strokeColor = '#6b7280';  // gray-500
  const textColor = '#374151';    // gray-700
  const selectedTextColor = '#ffffff';

  // Surface positions in the cross/pentagon shape
  // Layout:
  //        [M]
  //    [B] [O] [L]
  //        [D]

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
        aria-label="Mesial surface"
      >
        <polygon
          points="100,10 140,50 100,70 60,50"
          fill={isSelected('M') ? selectedFill : defaultFill}
          stroke={strokeColor}
          strokeWidth="2"
          className="transition-colors hover:fill-blue-100"
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
        aria-label="Buccal surface"
      >
        <polygon
          points="10,100 60,50 60,150"
          fill={isSelected('B') ? selectedFill : defaultFill}
          stroke={strokeColor}
          strokeWidth="2"
          className="transition-colors hover:fill-blue-100"
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
          className="transition-colors hover:fill-blue-100"
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
        aria-label="Lingual surface"
      >
        <polygon
          points="190,100 140,50 140,150"
          fill={isSelected('L') ? selectedFill : defaultFill}
          stroke={strokeColor}
          strokeWidth="2"
          className="transition-colors hover:fill-blue-100"
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
        aria-label="Distal surface"
      >
        <polygon
          points="100,190 140,150 100,130 60,150"
          fill={isSelected('D') ? selectedFill : defaultFill}
          stroke={strokeColor}
          strokeWidth="2"
          className="transition-colors hover:fill-blue-100"
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
```

### 5.2 Create `src/components/dental-chart/SurfaceSelector.tsx`

The popup modal for selecting surfaces and treatment.

```typescript
import React, { useState } from 'react';
import { Dialog } from '@headlessui/react';
import { X, Check } from 'lucide-react';
import { ToothSurfaceIcon } from './ToothSurfaceIcon';
import { TreatmentSelector } from './TreatmentSelector';
import { useDentalChartStore } from '../../stores/dentalChartStore';
import { Treatment, ToothSurface } from './types';

export const SurfaceSelector: React.FC = () => {
  const {
    selectedTooth,
    selectedSurfaces,
    isSurfaceSelectorOpen,
    toggleSurface,
    clearSurfaces,
    closeSurfaceSelector,
    addTreatment,
  } = useDentalChartStore();

  const [selectedTreatment, setSelectedTreatment] = useState<Treatment | null>(null);
  const [notes, setNotes] = useState('');

  if (!selectedTooth) return null;

  const handleSurfaceClick = (surface: ToothSurface) => {
    toggleSurface(surface);
  };

  const handleAddTreatment = () => {
    if (!selectedTreatment) return;
    
    // Validate: if treatment requires surface, ensure at least one is selected
    if (selectedTreatment.requiresSurface && selectedSurfaces.length === 0) {
      alert('Bu tedavi için en az bir yüzey seçmelisiniz'); // "You must select at least one surface for this treatment"
      return;
    }

    addTreatment(selectedTreatment, notes || undefined);
    
    // Reset local state
    setSelectedTreatment(null);
    setNotes('');
  };

  const handleClose = () => {
    setSelectedTreatment(null);
    setNotes('');
    closeSurfaceSelector();
  };

  // Format surfaces for display
  const formatSurfaces = (): string => {
    if (selectedSurfaces.length === 0) return 'Yüzey seçilmedi';
    return selectedSurfaces.sort().join('');
  };

  return (
    <Dialog
      open={isSurfaceSelectorOpen}
      onClose={handleClose}
      className="relative z-50"
    >
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />

      {/* Modal container */}
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="w-full max-w-lg rounded-xl bg-white shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b px-6 py-4">
            <div>
              <Dialog.Title className="text-lg font-semibold text-gray-900">
                Diş {selectedTooth.notations.fdi}
              </Dialog.Title>
              <p className="text-sm text-gray-500">
                {selectedTooth.type}
              </p>
            </div>
            <button
              onClick={handleClose}
              className="rounded-full p-2 hover:bg-gray-100 transition-colors"
            >
              <X className="h-5 w-5 text-gray-500" />
            </button>
          </div>

          {/* Content */}
          <div className="px-6 py-4 space-y-6">
            {/* Surface selector */}
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-3">
                Yüzey Seçimi
              </h3>
              <div className="flex flex-col items-center">
                <ToothSurfaceIcon
                  selectedSurfaces={selectedSurfaces}
                  onSurfaceClick={handleSurfaceClick}
                  toothType={selectedTooth.type}
                  size={180}
                />
                <div className="mt-3 flex items-center gap-2">
                  <span className="text-sm text-gray-600">
                    Seçilen: <strong>{formatSurfaces()}</strong>
                  </span>
                  {selectedSurfaces.length > 0 && (
                    <button
                      onClick={clearSurfaces}
                      className="text-xs text-red-500 hover:text-red-700"
                    >
                      Temizle
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Surface labels legend */}
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500 mb-2">Yüzey Açıklamaları:</p>
              <div className="grid grid-cols-2 gap-1 text-xs text-gray-600">
                <span><strong>M</strong> - Mesial (Ön)</span>
                <span><strong>D</strong> - Distal (Arka)</span>
                <span><strong>B</strong> - Bukkal (Yanak)</span>
                <span><strong>L</strong> - Lingual (Dil)</span>
                <span><strong>O/I</strong> - Okluzal/İnsizal (Üst)</span>
              </div>
            </div>

            {/* Treatment selector */}
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-3">
                Tedavi Seçimi
              </h3>
              <TreatmentSelector
                selectedTreatment={selectedTreatment}
                onSelect={setSelectedTreatment}
              />
            </div>

            {/* Notes */}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">
                Notlar (Opsiyonel)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Tedavi ile ilgili notlar..."
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                rows={2}
              />
            </div>

            {/* Selected treatment summary */}
            {selectedTreatment && (
              <div className="bg-blue-50 rounded-lg p-4">
                <h4 className="font-medium text-blue-900">
                  {selectedTreatment.name}
                </h4>
                <div className="mt-2 text-sm text-blue-700 space-y-1">
                  <p>Diş: {selectedTooth.notations.fdi}</p>
                  {selectedTreatment.requiresSurface && (
                    <p>Yüzey: {formatSurfaces()}</p>
                  )}
                  <p>Fiyat: ₺{selectedTreatment.price.toLocaleString('tr-TR')}</p>
                  <p>Süre: ~{selectedTreatment.duration} dakika</p>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 border-t px-6 py-4">
            <button
              onClick={handleClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              İptal
            </button>
            <button
              onClick={handleAddTreatment}
              disabled={!selectedTreatment}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed rounded-lg transition-colors"
            >
              <Check className="h-4 w-4" />
              Tedavi Ekle
            </button>
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
};
```

### 5.3 Create `src/components/dental-chart/TreatmentSelector.tsx`

```typescript
import React, { useState } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import { Treatment, TreatmentCategory } from './types';
import { treatments, categoryLabels } from '../../data/treatments';

interface TreatmentSelectorProps {
  selectedTreatment: Treatment | null;
  onSelect: (treatment: Treatment) => void;
}

export const TreatmentSelector: React.FC<TreatmentSelectorProps> = ({
  selectedTreatment,
  onSelect,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  // Group treatments by category
  const groupedTreatments = treatments.reduce((acc, treatment) => {
    if (!acc[treatment.category]) {
      acc[treatment.category] = [];
    }
    acc[treatment.category].push(treatment);
    return acc;
  }, {} as Record<string, Treatment[]>);

  // Filter treatments based on search
  const filteredTreatments = searchTerm
    ? treatments.filter(
        t =>
          t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          t.nameEn.toLowerCase().includes(searchTerm.toLowerCase()) ||
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
          placeholder="Tedavi ara..."
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {/* Search results */}
      {filteredTreatments && (
        <div className="max-h-48 overflow-y-auto border rounded-lg divide-y">
          {filteredTreatments.length === 0 ? (
            <p className="p-3 text-sm text-gray-500 text-center">
              Sonuç bulunamadı
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
                  {treatment.code} • ₺{treatment.price.toLocaleString('tr-TR')}
                </div>
              </button>
            ))
          )}
        </div>
      )}

      {/* Category accordion (when not searching) */}
      {!filteredTreatments && (
        <div className="border rounded-lg divide-y max-h-64 overflow-y-auto">
          {Object.entries(groupedTreatments).map(([category, categoryTreatments]) => (
            <div key={category}>
              {/* Category header */}
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

              {/* Category treatments */}
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
                        ₺{treatment.price.toLocaleString('tr-TR')} • {treatment.duration} dk
                        {treatment.requiresSurface && ' • Yüzey gerekli'}
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
```

### 5.4 Create `src/components/dental-chart/SelectedTreatmentsList.tsx`

```typescript
import React from 'react';
import { Trash2, AlertCircle } from 'lucide-react';
import { useDentalChartStore } from '../../stores/dentalChartStore';
import { categoryLabels } from '../../data/treatments';

export const SelectedTreatmentsList: React.FC = () => {
  const { chartedTreatments, removeTreatment, clearAll } = useDentalChartStore();

  if (chartedTreatments.length === 0) {
    return (
      <div className="bg-gray-50 rounded-lg p-6 text-center">
        <AlertCircle className="h-8 w-8 text-gray-400 mx-auto mb-2" />
        <p className="text-gray-500">Henüz tedavi eklenmedi</p>
        <p className="text-sm text-gray-400 mt-1">
          Tedavi eklemek için diş şemasından bir diş seçin
        </p>
      </div>
    );
  }

  // Calculate totals
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
          Planlanan Tedaviler ({chartedTreatments.length})
        </h3>
        <button
          onClick={clearAll}
          className="text-sm text-red-500 hover:text-red-700"
        >
          Tümünü Temizle
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
                      <> • Yüzey: {charted.tooth.surfaces.join('')}</>
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
                  ₺{charted.treatment.price.toLocaleString('tr-TR')}
                </p>
                <p className="text-xs text-gray-500">
                  {charted.treatment.duration} dk
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
            <p className="text-sm text-blue-700">Toplam Tutar</p>
            <p className="text-2xl font-bold text-blue-900">
              ₺{totalPrice.toLocaleString('tr-TR')}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-blue-700">Tahmini Süre</p>
            <p className="text-lg font-semibold text-blue-900">
              ~{Math.ceil(totalDuration / 60)} saat {totalDuration % 60} dk
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
```

### 5.5 Create `src/components/dental-chart/ToothChart.tsx`

Wrapper for react-odontogram with highlighted teeth.

```typescript
import React, { useMemo } from 'react';
import { Odontogram } from 'react-odontogram';
import { useDentalChartStore } from '../../stores/dentalChartStore';
import { SelectedTooth } from './types';

export const ToothChart: React.FC = () => {
  const { selectTooth, chartedTreatments } = useDentalChartStore();

  // Get list of teeth that have treatments (for highlighting)
  const teethWithTreatments = useMemo(() => {
    const teeth = new Set<string>();
    chartedTreatments.forEach((t) => {
      teeth.add(`teeth-${t.tooth.toothFdi}`);
    });
    return Array.from(teeth);
  }, [chartedTreatments]);

  const handleToothChange = (selectedTeeth: SelectedTooth[]) => {
    // react-odontogram returns array, we want single selection
    if (selectedTeeth.length > 0) {
      const tooth = selectedTeeth[selectedTeeth.length - 1];
      selectTooth(tooth);
    }
  };

  return (
    <div className="relative">
      {/* Custom styles to highlight teeth with treatments */}
      <style>{`
        .tooth-surface-selector polygon {
          transition: fill 0.15s ease;
        }
        .tooth-surface-selector polygon:hover {
          filter: brightness(0.95);
        }
        
        /* Highlight teeth that have planned treatments */
        ${teethWithTreatments
          .map(
            (toothId) => `
          [data-tooth-id="${toothId}"] path,
          #${toothId} path {
            fill: #bfdbfe !important;
            stroke: #3b82f6 !important;
          }
        `
          )
          .join('\n')}
      `}</style>

      <Odontogram onChange={handleToothChange} />

      {/* Legend */}
      <div className="mt-4 flex items-center justify-center gap-6 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-gray-200 border border-gray-400" />
          <span className="text-gray-600">Seçilmemiş</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-blue-200 border border-blue-500" />
          <span className="text-gray-600">Tedavi Planlanmış</span>
        </div>
      </div>
    </div>
  );
};
```

### 5.6 Create `src/components/dental-chart/DentalChartModule.tsx`

Main container that brings everything together.

```typescript
import React from 'react';
import { ToothChart } from './ToothChart';
import { SurfaceSelector } from './SurfaceSelector';
import { SelectedTreatmentsList } from './SelectedTreatmentsList';
import { useDentalChartStore } from '../../stores/dentalChartStore';

interface DentalChartModuleProps {
  patientId?: string;
  patientName?: string;
  onSave?: (treatments: any[]) => void;
}

export const DentalChartModule: React.FC<DentalChartModuleProps> = ({
  patientId,
  patientName,
  onSave,
}) => {
  const { chartedTreatments, clearAll } = useDentalChartStore();

  const handleSaveTreatmentPlan = () => {
    if (chartedTreatments.length === 0) {
      alert('Kaydetmek için en az bir tedavi ekleyin');
      return;
    }

    // Format data for backend
    const treatmentPlan = {
      patientId,
      createdAt: new Date().toISOString(),
      treatments: chartedTreatments.map((t) => ({
        toothFdi: t.tooth.toothFdi,
        surfaces: t.tooth.surfaces,
        treatmentId: t.treatment.id,
        treatmentCode: t.treatment.code,
        treatmentName: t.treatment.name,
        price: t.treatment.price,
        duration: t.treatment.duration,
        notes: t.notes,
        status: t.status,
      })),
      totalPrice: chartedTreatments.reduce((sum, t) => sum + t.treatment.price, 0),
      totalDuration: chartedTreatments.reduce(
        (sum, t) => sum + t.treatment.duration,
        0
      ),
    };

    if (onSave) {
      onSave(treatmentPlan.treatments);
    }

    console.log('Treatment Plan:', treatmentPlan);
    // TODO: Send to backend API
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">
              Diş Şeması
            </h1>
            {patientName && (
              <p className="text-sm text-gray-500">Hasta: {patientName}</p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={clearAll}
              className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Sıfırla
            </button>
            <button
              onClick={handleSaveTreatmentPlan}
              disabled={chartedTreatments.length === 0}
              className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed rounded-lg transition-colors"
            >
              Tedavi Planını Kaydet
            </button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left: Tooth chart */}
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Diş Seçimi
            </h2>
            <p className="text-sm text-gray-500 mb-6">
              Tedavi eklemek için bir diş seçin
            </p>
            <ToothChart />
          </div>

          {/* Right: Treatment list */}
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <SelectedTreatmentsList />
          </div>
        </div>
      </div>

      {/* Surface selector modal */}
      <SurfaceSelector />
    </div>
  );
};

export default DentalChartModule;
```

---

## Part 6: Integration with Booking System

### 6.1 Usage Example in Booking Flow

```typescript
// In your booking page or patient record page
import { DentalChartModule } from './components/dental-chart/DentalChartModule';

function PatientTreatmentPage() {
  const patient = { id: '123', name: 'Ahmet Yılmaz' };

  const handleSaveTreatments = async (treatments) => {
    try {
      // Save to your backend
      const response = await fetch('/api/treatment-plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId: patient.id,
          treatments,
        }),
      });
      
      if (response.ok) {
        alert('Tedavi planı kaydedildi');
        // Redirect to booking/appointment creation
      }
    } catch (error) {
      console.error('Error saving treatment plan:', error);
    }
  };

  return (
    <DentalChartModule
      patientId={patient.id}
      patientName={patient.name}
      onSave={handleSaveTreatments}
    />
  );
}
```

### 6.2 Backend API Schema (for reference)

```typescript
// POST /api/treatment-plans
interface CreateTreatmentPlanRequest {
  patientId: string;
  treatments: {
    toothFdi: string;
    surfaces: string[];
    treatmentId: string;
    treatmentCode: string;
    treatmentName: string;
    price: number;
    duration: number;
    notes?: string;
    status: 'planned' | 'completed' | 'in-progress';
  }[];
}

// Database schema suggestion (PostgreSQL/Prisma)
/*
model TreatmentPlan {
  id         String   @id @default(cuid())
  patientId  String
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
  totalPrice Int
  status     String   @default("pending")
  items      TreatmentPlanItem[]
}

model TreatmentPlanItem {
  id              String   @id @default(cuid())
  treatmentPlanId String
  toothFdi        String
  surfaces        String[] // ["M", "O", "D"]
  treatmentCode   String
  treatmentName   String
  price           Int
  duration        Int
  notes           String?
  status          String   @default("planned")
  treatmentPlan   TreatmentPlan @relation(fields: [treatmentPlanId], references: [id])
}
*/
```

---

## Part 7: Styling Notes

### 7.1 Required Tailwind Classes

Ensure your `tailwind.config.js` includes:

```javascript
module.exports = {
  content: [
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
```

### 7.2 Custom CSS for react-odontogram (optional)

Add to your global CSS if you need to customize the chart appearance:

```css
/* Override react-odontogram styles */
.odontogram-container {
  max-width: 100%;
}

/* Tooth hover effect */
.odontogram-container [data-tooth] {
  cursor: pointer;
  transition: transform 0.15s ease;
}

.odontogram-container [data-tooth]:hover {
  transform: scale(1.05);
}

/* Selected tooth highlight */
.odontogram-container [data-tooth].selected path {
  fill: #3b82f6 !important;
}
```

---

## Part 8: Testing Checklist

Before deploying, verify:

- [ ] Teeth can be selected by clicking on the chart
- [ ] Surface selector popup opens when tooth is clicked
- [ ] All 5 surfaces (M, O, D, B, L) are clickable
- [ ] Multiple surfaces can be selected
- [ ] Treatment search works (Turkish and English)
- [ ] Treatment categories expand/collapse properly
- [ ] Treatments can be added to the list
- [ ] Treatments can be removed from the list
- [ ] Total price and duration calculate correctly
- [ ] Save button sends correct data format
- [ ] Modal closes properly on cancel/save
- [ ] Teeth with treatments are highlighted on chart
- [ ] Mobile responsive layout works

---

## Part 9: Future Enhancements (Optional)

1. **Pediatric chart toggle** - Switch between adult (32 teeth) and child (20 teeth) chart
2. **Treatment history view** - Show completed treatments on the chart
3. **Print treatment plan** - Generate PDF of planned treatments
4. **Drag-and-drop reordering** - Reorder treatments by priority
5. **Insurance integration** - Show coverage for each treatment
6. **Before/after photos** - Attach images to teeth
7. **Voice notes** - Record audio notes for treatments

---

## Summary

This module provides:
- Full-mouth interactive dental chart using FDI notation
- 5-surface selector popup (M, O, D, B, L)
- Treatment catalog with Turkish labels
- Treatment plan builder with pricing
- Easy integration with existing booking system

Total estimated build time: 4-6 hours for a developer familiar with React/TypeScript.
