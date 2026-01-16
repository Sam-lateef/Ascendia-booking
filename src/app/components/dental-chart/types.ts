/**
 * Dental Chart Types for Agent0
 */

// Tooth notation from dental chart
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

export interface ToothSurfaceSelection {
  toothId: string;
  toothFdi: string;
  toothType: string;
  surfaces: ToothSurface[];
}

export type TreatmentCategory = 
  | 'restorative'
  | 'endodontic'
  | 'periodontal'
  | 'surgical'
  | 'prosthodontic'
  | 'preventive'
  | 'diagnostic';

export interface Treatment {
  id: string;
  code: string;
  name: string;  // Single name field - will be translated by the system
  category: TreatmentCategory;
  price: number;
  duration: number;
  requiresSurface: boolean;
}

export type TreatmentStatus = 'planned' | 'completed' | 'in-progress';

export interface ChartedTreatment {
  id: string;
  tooth: ToothSurfaceSelection;
  treatment: Treatment;
  notes?: string;
  status: TreatmentStatus;
  createdAt: Date;
}

export interface DentalChartState {
  selectedTooth: SelectedTooth | null;
  selectedSurfaces: ToothSurface[];
  isSurfaceSelectorOpen: boolean;
  chartedTreatments: ChartedTreatment[];
  selectTooth: (tooth: SelectedTooth) => void;
  closeSurfaceSelector: () => void;
  toggleSurface: (surface: ToothSurface) => void;
  clearSurfaces: () => void;
  addTreatment: (treatment: Treatment, notes?: string) => void;
  removeTreatment: (treatmentId: string) => void;
  clearAll: () => void;
}

export interface TreatmentPlan {
  id?: string;
  patientId: string;
  createdAt: string;
  updatedAt?: string;
  totalPrice: number;
  totalDuration: number;
  status: 'pending' | 'approved' | 'in-progress' | 'completed';
  treatments: TreatmentPlanItem[];
}

export interface TreatmentPlanItem {
  toothFdi: string;
  surfaces: ToothSurface[];
  treatmentId: string;
  treatmentCode: string;
  treatmentName: string;
  price: number;
  duration: number;
  notes?: string;
  status: TreatmentStatus;
}

export interface CategoryLabels {
  [key: string]: string;
}
