import { create } from 'zustand';
import { 
  DentalChartState, 
  SelectedTooth, 
  ToothSurface, 
  Treatment,
  ChartedTreatment 
} from './types';

export const useDentalChartStore = create<DentalChartState>((set, get) => ({
  selectedTooth: null,
  selectedSurfaces: [],
  isSurfaceSelectorOpen: false,
  chartedTreatments: [],

  selectTooth: (tooth: SelectedTooth) => {
    set({
      selectedTooth: tooth,
      selectedSurfaces: [],
      isSurfaceSelectorOpen: true,
    });
  },

  closeSurfaceSelector: () => {
    set({
      isSurfaceSelectorOpen: false,
      selectedTooth: null,
      selectedSurfaces: [],
    });
  },

  toggleSurface: (surface: ToothSurface) => {
    const current = get().selectedSurfaces;
    const exists = current.includes(surface);
    
    set({
      selectedSurfaces: exists
        ? current.filter(s => s !== surface)
        : [...current, surface],
    });
  },

  clearSurfaces: () => {
    set({ selectedSurfaces: [] });
  },

  addTreatment: (treatment: Treatment, notes?: string) => {
    const { selectedTooth, selectedSurfaces, chartedTreatments } = get();
    
    if (!selectedTooth) return;

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

  // Add treatment without tooth selection (for non-dental mode)
  addTreatmentDirect: (treatment: Treatment, notes?: string) => {
    const { chartedTreatments } = get();

    const newTreatment: ChartedTreatment = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      tooth: {
        toothId: 0,
        toothFdi: 0,
        toothType: 'adult',
        surfaces: [],
      },
      treatment,
      notes,
      status: 'planned',
      createdAt: new Date(),
    };

    set({
      chartedTreatments: [...chartedTreatments, newTreatment],
    });
  },

  removeTreatment: (treatmentId: string) => {
    set({
      chartedTreatments: get().chartedTreatments.filter(t => t.id !== treatmentId),
    });
  },

  loadTreatments: (treatments: ChartedTreatment[]) => {
    set({
      chartedTreatments: treatments,
    });
  },

  clearAll: () => {
    set({
      selectedTooth: null,
      selectedSurfaces: [],
      isSurfaceSelectorOpen: false,
      chartedTreatments: [],
    });
  },
}));
