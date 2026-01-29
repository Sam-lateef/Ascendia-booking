'use client';

import React, { useState } from 'react';
import { treatments, categoryLabels } from './treatments';
import { useDentalChartStore } from './dentalChartStore';
import { Treatment } from './types';
import { Plus, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export const TreatmentCatalogBrowser: React.FC = () => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const { addTreatmentDirect } = useDentalChartStore();

  const categories = ['all', ...Object.keys(categoryLabels)];

  const filteredTreatments = treatments.filter((treatment) => {
    const matchesCategory = selectedCategory === 'all' || treatment.category === selectedCategory;
    const matchesSearch = searchQuery === '' || 
      treatment.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      treatment.code.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const handleAddTreatment = (treatment: Treatment) => {
    // Use addTreatmentDirect for non-dental mode (no tooth selection needed)
    addTreatmentDirect(treatment, '');
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-2">
          Service Catalog
        </h2>
        <p className="text-sm text-gray-500 mb-4">
          Browse and add services to the treatment plan
        </p>

        {/* Search */}
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search services..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Category filter */}
        <div className="flex flex-wrap gap-2 mb-4">
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                selectedCategory === category
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {category === 'all' ? 'All Services' : categoryLabels[category as keyof typeof categoryLabels]}
            </button>
          ))}
        </div>
      </div>

      {/* Treatment list */}
      <div className="space-y-2 max-h-[600px] overflow-y-auto">
        {filteredTreatments.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No services found
          </div>
        ) : (
          filteredTreatments.map((treatment) => (
            <div
              key={treatment.id}
              className="flex items-center justify-between p-4 bg-white border rounded-lg hover:border-blue-300 transition-colors"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h4 className="font-medium text-gray-900">{treatment.name}</h4>
                  <span className="text-xs text-gray-500">({treatment.code})</span>
                </div>
                <p className="text-sm text-gray-600 mt-1">
                  {categoryLabels[treatment.category]}
                </p>
                <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                  <span>${treatment.price.toLocaleString('en-US')}</span>
                  <span>•</span>
                  <span>{treatment.duration} min</span>
                </div>
              </div>
              <Button
                size="sm"
                onClick={() => handleAddTreatment(treatment)}
                className="flex items-center gap-1"
              >
                <Plus className="h-4 w-4" />
                Add
              </Button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
