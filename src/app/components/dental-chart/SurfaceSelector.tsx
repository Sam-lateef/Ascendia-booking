'use client';

import React, { useState } from 'react';
import { useTranslations } from '@/lib/i18n/TranslationProvider';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { X, Check } from 'lucide-react';
import { ToothSurfaceIcon } from './ToothSurfaceIcon';
import { TreatmentSelector } from './TreatmentSelector';
import { useDentalChartStore } from './dentalChartStore';
import { Treatment, ToothSurface } from './types';

export const SurfaceSelector: React.FC = () => {
  const tCommon = useTranslations('common');
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
    
    if (selectedTreatment.requiresSurface && selectedSurfaces.length === 0) {
      alert('Please select at least one surface for this treatment');
      return;
    }

    addTreatment(selectedTreatment, notes || undefined);
    setSelectedTreatment(null);
    setNotes('');
  };

  const handleClose = () => {
    setSelectedTreatment(null);
    setNotes('');
    closeSurfaceSelector();
  };

  const formatSurfaces = (): string => {
    if (selectedSurfaces.length === 0) return 'No surface selected';
    return selectedSurfaces.sort().join('');
  };

  return (
    <Dialog open={isSurfaceSelectorOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Tooth {selectedTooth.notations.fdi}</DialogTitle>
          <DialogDescription>{selectedTooth.type}</DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Surface selector */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-3">
              Surface Selection
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
                  Selected: <strong>{formatSurfaces()}</strong>
                </span>
                {selectedSurfaces.length > 0 && (
                  <button
                    onClick={clearSurfaces}
                    className="text-xs text-red-500 hover:text-red-700"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Surface labels legend */}
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-500 mb-2">{tCommon('surface_legend')}</p>
            <div className="grid grid-cols-2 gap-1 text-xs text-gray-600">
              <span><strong>M</strong>{tCommon('mesial_front')}</span>
              <span><strong>D</strong>{tCommon('distal_back')}</span>
              <span><strong>B</strong>{tCommon('buccal_cheek')}</span>
              <span><strong>L</strong>{tCommon('lingual_tongue')}</span>
              <span><strong>O/I</strong>{tCommon('occlusalincisal_top')}</span>
            </div>
          </div>

          {/* Treatment selector */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-3">
              Treatment Selection
            </h3>
            <TreatmentSelector
              selectedTreatment={selectedTreatment}
              onSelect={setSelectedTreatment}
            />
          </div>

          {/* Notes */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">
              Notes (Optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={tCommon('notes_about_the_treatment')}
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
                <p>Tooth: {selectedTooth.notations.fdi}</p>
                {selectedTreatment.requiresSurface && (
                  <p>Surface: {formatSurfaces()}</p>
                )}
                <p>Price: ${selectedTreatment.price.toLocaleString('en-US')}</p>
                <p>Duration: ~{selectedTreatment.duration} minutes</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t mt-4">
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            onClick={handleAddTreatment}
            disabled={!selectedTreatment}
          >
            <Check className="h-4 w-4 mr-2" />
            Add Treatment
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
