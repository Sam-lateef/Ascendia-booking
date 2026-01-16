import { Treatment, CategoryLabels } from './types';

/**
 * Dental treatments catalog
 * Names are in English - will be translated by the app's translation system
 */
export const treatments: Treatment[] = [
  // Restorative
  {
    id: 'filling-composite',
    code: 'REST-001',
    name: 'Composite Filling',
    category: 'restorative',
    price: 800,
    duration: 30,
    requiresSurface: true,
  },
  {
    id: 'filling-amalgam',
    code: 'REST-002',
    name: 'Amalgam Filling',
    category: 'restorative',
    price: 500,
    duration: 30,
    requiresSurface: true,
  },
  {
    id: 'crown-porcelain',
    code: 'REST-003',
    name: 'Porcelain Crown',
    category: 'restorative',
    price: 3500,
    duration: 60,
    requiresSurface: false,
  },
  {
    id: 'crown-zirconia',
    code: 'REST-004',
    name: 'Zirconia Crown',
    category: 'restorative',
    price: 4500,
    duration: 60,
    requiresSurface: false,
  },
  {
    id: 'inlay',
    code: 'REST-005',
    name: 'Inlay',
    category: 'restorative',
    price: 2500,
    duration: 45,
    requiresSurface: true,
  },
  {
    id: 'onlay',
    code: 'REST-006',
    name: 'Onlay',
    category: 'restorative',
    price: 3000,
    duration: 45,
    requiresSurface: true,
  },

  // Endodontic
  {
    id: 'root-canal-anterior',
    code: 'ENDO-001',
    name: 'Root Canal (Anterior)',
    category: 'endodontic',
    price: 1500,
    duration: 60,
    requiresSurface: false,
  },
  {
    id: 'root-canal-premolar',
    code: 'ENDO-002',
    name: 'Root Canal (Premolar)',
    category: 'endodontic',
    price: 2000,
    duration: 75,
    requiresSurface: false,
  },
  {
    id: 'root-canal-molar',
    code: 'ENDO-003',
    name: 'Root Canal (Molar)',
    category: 'endodontic',
    price: 2500,
    duration: 90,
    requiresSurface: false,
  },
  {
    id: 'retreatment',
    code: 'ENDO-004',
    name: 'Root Canal Retreatment',
    category: 'endodontic',
    price: 3000,
    duration: 90,
    requiresSurface: false,
  },

  // Surgical
  {
    id: 'extraction-simple',
    code: 'SURG-001',
    name: 'Simple Extraction',
    category: 'surgical',
    price: 500,
    duration: 20,
    requiresSurface: false,
  },
  {
    id: 'extraction-surgical',
    code: 'SURG-002',
    name: 'Surgical Extraction',
    category: 'surgical',
    price: 1200,
    duration: 45,
    requiresSurface: false,
  },
  {
    id: 'extraction-wisdom',
    code: 'SURG-003',
    name: 'Wisdom Tooth Extraction',
    category: 'surgical',
    price: 2000,
    duration: 60,
    requiresSurface: false,
  },
  {
    id: 'implant',
    code: 'SURG-004',
    name: 'Dental Implant',
    category: 'surgical',
    price: 15000,
    duration: 90,
    requiresSurface: false,
  },

  // Periodontal
  {
    id: 'scaling',
    code: 'PERIO-001',
    name: 'Scaling/Cleaning',
    category: 'periodontal',
    price: 600,
    duration: 30,
    requiresSurface: false,
  },
  {
    id: 'deep-cleaning',
    code: 'PERIO-002',
    name: 'Deep Cleaning (SRP)',
    category: 'periodontal',
    price: 1500,
    duration: 60,
    requiresSurface: false,
  },
  {
    id: 'gum-surgery',
    code: 'PERIO-003',
    name: 'Gum Surgery',
    category: 'periodontal',
    price: 3000,
    duration: 90,
    requiresSurface: false,
  },

  // Preventive
  {
    id: 'fluoride',
    code: 'PREV-001',
    name: 'Fluoride Treatment',
    category: 'preventive',
    price: 300,
    duration: 15,
    requiresSurface: false,
  },
  {
    id: 'sealant',
    code: 'PREV-002',
    name: 'Fissure Sealant',
    category: 'preventive',
    price: 400,
    duration: 20,
    requiresSurface: true,
  },

  // Prosthodontic
  {
    id: 'veneer',
    code: 'PROS-001',
    name: 'Porcelain Veneer',
    category: 'prosthodontic',
    price: 5000,
    duration: 60,
    requiresSurface: false,
  },
  {
    id: 'bridge-unit',
    code: 'PROS-002',
    name: 'Bridge (per unit)',
    category: 'prosthodontic',
    price: 4000,
    duration: 60,
    requiresSurface: false,
  },
  {
    id: 'denture-partial',
    code: 'PROS-003',
    name: 'Partial Denture',
    category: 'prosthodontic',
    price: 6000,
    duration: 120,
    requiresSurface: false,
  },
  {
    id: 'denture-full',
    code: 'PROS-004',
    name: 'Full Denture',
    category: 'prosthodontic',
    price: 8000,
    duration: 120,
    requiresSurface: false,
  },

  // Diagnostic
  {
    id: 'xray-periapical',
    code: 'DIAG-001',
    name: 'Periapical X-ray',
    category: 'diagnostic',
    price: 100,
    duration: 5,
    requiresSurface: false,
  },
  {
    id: 'xray-panoramic',
    code: 'DIAG-002',
    name: 'Panoramic X-ray',
    category: 'diagnostic',
    price: 300,
    duration: 10,
    requiresSurface: false,
  },
  {
    id: 'exam',
    code: 'DIAG-003',
    name: 'Oral Examination',
    category: 'diagnostic',
    price: 200,
    duration: 15,
    requiresSurface: false,
  },
];

export const getTreatmentsByCategory = (category: string): Treatment[] => {
  return treatments.filter(t => t.category === category);
};

// Category labels - will be translated by the app's translation system
export const categoryLabels: CategoryLabels = {
  restorative: 'Restorative',
  endodontic: 'Endodontic',
  periodontal: 'Periodontal',
  surgical: 'Surgical',
  prosthodontic: 'Prosthodontic',
  preventive: 'Preventive',
  diagnostic: 'Diagnostic',
};

export const getTreatmentById = (id: string): Treatment | undefined => {
  return treatments.find(t => t.id === id);
};

export const getTreatmentByCode = (code: string): Treatment | undefined => {
  return treatments.find(t => t.code === code);
};
