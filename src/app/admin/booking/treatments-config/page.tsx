'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from '@/lib/i18n/TranslationProvider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Plus, Pencil, Trash2, Search } from 'lucide-react';

interface Treatment {
  id: string;
  code: string;
  name: string;
  category: string;
  price: number;
  duration: number;
  requires_surface: boolean;
  is_active: boolean;
  description?: string;
}

const CATEGORIES = [
  { value: 'restorative', label: 'Restorative' },
  { value: 'endodontic', label: 'Endodontic' },
  { value: 'periodontal', label: 'Periodontal' },
  { value: 'surgical', label: 'Surgical' },
  { value: 'prosthodontic', label: 'Prosthodontic' },
  { value: 'preventive', label: 'Preventive' },
  { value: 'diagnostic', label: 'Diagnostic' },
];

const emptyTreatment: Partial<Treatment> = {
  code: '',
  name: '',
  category: 'restorative',
  price: 0,
  duration: 30,
  requires_surface: false,
  is_active: true,
  description: '',
};

export default function TreatmentsConfigPage() {
  const tCommon = useTranslations('common');
  const [treatments, setTreatments] = useState<Treatment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTreatment, setEditingTreatment] = useState<Partial<Treatment> | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchTreatments();
  }, []);

  const fetchTreatments = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/treatments-catalog');
      const data = await response.json();
      setTreatments(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching treatments:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingTreatment({ ...emptyTreatment });
    setIsDialogOpen(true);
  };

  const handleEdit = (treatment: Treatment) => {
    setEditingTreatment({ ...treatment });
    setIsDialogOpen(true);
  };

  const handleDelete = async (treatment: Treatment) => {
    if (!confirm(`Are you sure you want to delete "${treatment.name}"?`)) return;

    try {
      const response = await fetch(`/api/treatments-catalog?id=${treatment.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        fetchTreatments();
      } else {
        const error = await response.json();
        alert(`Error: ${error.message || 'Failed to delete treatment'}`);
      }
    } catch (error) {
      console.error('Error deleting treatment:', error);
      alert('An error occurred while deleting the treatment');
    }
  };

  const handleSave = async () => {
    if (!editingTreatment) return;

    // Validate
    if (!editingTreatment.code || !editingTreatment.name) {
      alert('Please fill in all required fields (Code, Name)');
      return;
    }

    try {
      setSaving(true);
      const isNew = !editingTreatment.id;
      const response = await fetch('/api/treatments-catalog', {
        method: isNew ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingTreatment),
      });

      if (response.ok) {
        setIsDialogOpen(false);
        setEditingTreatment(null);
        fetchTreatments();
      } else {
        const error = await response.json();
        alert(`Error: ${error.error || 'Failed to save treatment'}`);
      }
    } catch (error) {
      console.error('Error saving treatment:', error);
      alert('An error occurred while saving the treatment');
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setIsDialogOpen(false);
    setEditingTreatment(null);
  };

  // Filter treatments
  const filteredTreatments = treatments.filter(t => {
    const matchesSearch = 
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.code.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = filterCategory === 'all' || t.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  // Group by category
  const groupedTreatments = filteredTreatments.reduce((acc, t) => {
    if (!acc[t.category]) acc[t.category] = [];
    acc[t.category].push(t);
    return acc;
  }, {} as Record<string, Treatment[]>);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">{tCommon('loading_treatments')}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{tCommon('treatments_configuration')}</h1>
          <p className="text-gray-600 mt-2">
            Manage your dental treatments catalog - prices, duration, and settings
          </p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Add Treatment
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder={tCommon('search_treatments')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder={tCommon('all_categories')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{tCommon('all_categories')}</SelectItem>
                {CATEGORIES.map(cat => (
                  <SelectItem key={cat.value} value={cat.value}>
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Treatments List */}
      {Object.keys(groupedTreatments).length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-gray-500">
            {searchQuery || filterCategory !== 'all' 
              ? 'No treatments found matching your criteria' 
              : 'No treatments configured yet. Click "Add Treatment" to get started.'}
          </CardContent>
        </Card>
      ) : (
        Object.entries(groupedTreatments).map(([category, categoryTreatments]) => (
          <Card key={category}>
            <CardHeader>
              <CardTitle className="capitalize">{CATEGORIES.find(c => c.value === category)?.label || category}</CardTitle>
              <CardDescription>{categoryTreatments.length} treatments</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {categoryTreatments.map(treatment => (
                  <div
                    key={treatment.id}
                    className={`flex items-center justify-between p-4 border rounded-lg ${
                      !treatment.is_active ? 'bg-gray-50 opacity-60' : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-mono bg-gray-100 px-2 py-1 rounded">
                          {treatment.code}
                        </span>
                        <p className="font-medium text-gray-900">{treatment.name}</p>
                        {!treatment.is_active && (
                          <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded">
                            Inactive
                          </span>
                        )}
                        {treatment.requires_surface && (
                          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                            Surface
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <p className="font-semibold text-gray-900">
                          ${treatment.price.toLocaleString('en-US')}
                        </p>
                        <p className="text-xs text-gray-500">{treatment.duration} min</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(treatment)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(treatment)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))
      )}

      {/* Edit/Create Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingTreatment?.id ? 'Edit Treatment' : 'Add New Treatment'}
            </DialogTitle>
            <DialogDescription>
              {editingTreatment?.id 
                ? 'Update the treatment details below' 
                : 'Fill in the details for the new treatment'}
            </DialogDescription>
          </DialogHeader>

          {editingTreatment && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="code">{tCommon('code')}</Label>
                  <Input
                    id="code"
                    value={editingTreatment.code || ''}
                    onChange={(e) => setEditingTreatment({ ...editingTreatment, code: e.target.value.toUpperCase() })}
                    placeholder={tCommon('eg_rest007')}
                  />
                </div>
                <div>
                  <Label htmlFor="category">{tCommon('category')}</Label>
                  <Select
                    value={editingTreatment.category || 'restorative'}
                    onValueChange={(value) => setEditingTreatment({ ...editingTreatment, category: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map(cat => (
                        <SelectItem key={cat.value} value={cat.value}>
                          {cat.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="name">{tCommon('treatment_name')}</Label>
                <Input
                  id="name"
                  value={editingTreatment.name || ''}
                  onChange={(e) => setEditingTreatment({ ...editingTreatment, name: e.target.value })}
                  placeholder={tCommon('eg_composite_filling')}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Name will be automatically translated using the translation system
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="price">{tCommon('price')}</Label>
                  <Input
                    id="price"
                    type="number"
                    min="0"
                    step="0.01"
                    value={editingTreatment.price || 0}
                    onChange={(e) => setEditingTreatment({ ...editingTreatment, price: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <Label htmlFor="duration">{tCommon('duration_minutes')}</Label>
                  <Input
                    id="duration"
                    type="number"
                    min="5"
                    step="5"
                    value={editingTreatment.duration || 30}
                    onChange={(e) => setEditingTreatment({ ...editingTreatment, duration: parseInt(e.target.value) || 30 })}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="description">{tCommon('description_optional')}</Label>
                <Input
                  id="description"
                  value={editingTreatment.description || ''}
                  onChange={(e) => setEditingTreatment({ ...editingTreatment, description: e.target.value })}
                  placeholder={tCommon('additional_notes_about_this_tr')}
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <div className="flex items-center gap-2">
                  <Switch
                    id="requires_surface"
                    checked={editingTreatment.requires_surface || false}
                    onCheckedChange={(checked) => setEditingTreatment({ ...editingTreatment, requires_surface: checked })}
                  />
                  <Label htmlFor="requires_surface" className="font-normal">
                    Requires tooth surface selection
                  </Label>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Switch
                    id="is_active"
                    checked={editingTreatment.is_active !== false}
                    onCheckedChange={(checked) => setEditingTreatment({ ...editingTreatment, is_active: checked })}
                  />
                  <Label htmlFor="is_active" className="font-normal">
                    Active (available for selection)
                  </Label>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : editingTreatment?.id ? 'Update Treatment' : 'Create Treatment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
