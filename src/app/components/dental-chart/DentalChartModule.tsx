'use client';

import React from 'react';
import { ToothChart } from './ToothChart';
import { SurfaceSelector } from './SurfaceSelector';
import { SelectedTreatmentsList } from './SelectedTreatmentsList';
import { TreatmentCatalogBrowser } from './TreatmentCatalogBrowser';
import { useDentalChartStore } from './dentalChartStore';
import { TreatmentPlan, TreatmentPlanItem } from './types';
import { Button } from '@/components/ui/button';

interface DentalChartModuleProps {
  patientId?: string;
  patientName?: string;
  onSave?: (treatmentPlan: TreatmentPlan) => void;
  className?: string;
  hideDentalFeatures?: boolean; // Hide tooth chart and surface selector for non-dental businesses
}

export const DentalChartModule: React.FC<DentalChartModuleProps> = ({
  patientId,
  patientName,
  onSave,
  className = '',
  hideDentalFeatures = false,
}) => {
  const { chartedTreatments, clearAll } = useDentalChartStore();

  const handleSaveTreatmentPlan = () => {
    if (chartedTreatments.length === 0) {
      alert('Please add at least one treatment to save');
      return;
    }

    const treatments: TreatmentPlanItem[] = chartedTreatments.map((t) => ({
      toothFdi: t.tooth.toothFdi,
      surfaces: t.tooth.surfaces,
      treatmentId: t.treatment.id,
      treatmentCode: t.treatment.code,
      treatmentName: t.treatment.name,
      price: t.treatment.price,
      duration: t.treatment.duration,
      notes: t.notes,
      status: t.status,
    }));

    const treatmentPlan: TreatmentPlan = {
      patientId: patientId || '',
      createdAt: new Date().toISOString(),
      totalPrice: chartedTreatments.reduce((sum, t) => sum + t.treatment.price, 0),
      totalDuration: chartedTreatments.reduce((sum, t) => sum + t.treatment.duration, 0),
      status: 'pending',
      treatments,
    };

    if (onSave) {
      onSave(treatmentPlan);
    } else {
      console.log('Treatment Plan:', treatmentPlan);
      alert('Treatment plan saved!');
    }
  };

  return (
    <div className={`min-h-screen bg-gray-50 ${className}`}>
      {/* Header */}
      <div className="bg-white border-b px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">
              {hideDentalFeatures ? 'Treatment Plan' : 'Dental Chart'}
            </h1>
            {patientName && (
              <p className="text-sm text-gray-500">
                {hideDentalFeatures ? 'Client' : 'Patient'}: {patientName}
              </p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={clearAll}
            >
              Reset
            </Button>
            <Button
              onClick={handleSaveTreatmentPlan}
              disabled={chartedTreatments.length === 0}
              className="bg-green-600 hover:bg-green-700"
            >
              Save Treatment Plan
            </Button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className={`grid grid-cols-1 lg:grid-cols-2 gap-8`}>
          {/* Left: Tooth chart (dental mode) OR Service catalog (non-dental mode) */}
          <div className="bg-white rounded-xl shadow-sm border p-6">
            {hideDentalFeatures ? (
              <TreatmentCatalogBrowser />
            ) : (
              <>
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                  Tooth Selection
                </h2>
                <p className="text-sm text-gray-500 mb-6">
                  Select a tooth to add a treatment
                </p>
                <ToothChart />
              </>
            )}
          </div>

          {/* Right: Treatment list */}
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <SelectedTreatmentsList hideDentalFeatures={hideDentalFeatures} />
          </div>
        </div>
      </div>

      {/* Surface selector modal - Only show in dental mode */}
      {!hideDentalFeatures && <SurfaceSelector />}
    </div>
  );
};

export default DentalChartModule;
