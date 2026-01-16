'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from '@/lib/i18n/TranslationProvider';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';

interface Operatory {
  OperatoryNum: number;
  OpName: string;
  IsHygiene: number;
}

export default function OperatoriesPage() {
  const t = useTranslations('operatories');
  const tCommon = useTranslations('common');
  const [operatories, setOperatories] = useState<Operatory[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingOperatory, setEditingOperatory] = useState<any>(null);

  useEffect(() => {
    fetchOperatories();
  }, []);

  const fetchOperatories = async () => {
    try {
      const response = await fetch('/api/booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          functionName: 'GetOperatories',
          parameters: {},
        }),
      });
      const data = await response.json();
      setOperatories(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching operatories:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (operatory: Operatory) => {
    setEditingOperatory({
      id: operatory.OperatoryNum,
      name: operatory.OpName,
      isHygiene: operatory.IsHygiene === 1,
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (operatoryNum: number) => {
    if (!confirm('Are you sure you want to delete this operatory?')) return;

    try {
      const response = await fetch('/api/booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          functionName: 'DeleteOperatory',
          parameters: { OperatoryNum: operatoryNum },
        }),
      });

      if (response.ok) {
        fetchOperatories();
      } else {
        const error = await response.json();
        alert(error.message || 'Failed to delete operatory');
      }
    } catch (error) {
      console.error('Error deleting operatory:', error);
      alert('Error deleting operatory');
    }
  };

  const handleSave = async (formData: FormData) => {
    try {
      const params: any = {
        name: formData.get('name'),
        isHygiene: formData.get('isHygiene') === 'on',
      };
      
      // Add ID if editing
      if (editingOperatory?.id) {
        params.id = editingOperatory.id;
      }

      const response = await fetch('/api/booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          functionName: editingOperatory ? 'UpdateOperatory' : 'CreateOperatory',
          parameters: params,
        }),
      });

      if (response.ok) {
        setIsDialogOpen(false);
        setEditingOperatory(null);
        fetchOperatories();
      } else {
        const error = await response.json();
        alert(error.message || 'Failed to save operatory');
      }
    } catch (error) {
      console.error('Error saving operatory:', error);
      alert('Error saving operatory');
    }
  };

  if (loading) {
    return <div className="text-center py-8">{tCommon('loading_operatories')}</div>;
  }

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header - Responsive */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">{t('title')}</h1>
          <p className="text-sm md:text-base text-gray-600 mt-1 md:mt-2">{t('subtitle')}</p>
        </div>
        <Button 
          onClick={() => {
            setEditingOperatory(null);
            setIsDialogOpen(true);
          }}
          className="w-full sm:w-auto"
        >
          + New Operatory
        </Button>
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block border rounded-lg overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{tCommon('name')}</TableHead>
              <TableHead>{tCommon('type')}</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {operatories.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-gray-500 py-8">
                  No operatories found. Create one to get started.
                </TableCell>
              </TableRow>
            ) : (
              operatories.map((op) => (
                <TableRow key={op.OperatoryNum}>
                  <TableCell>{op.OpName}</TableCell>
                  <TableCell>
                    <Badge>{op.IsHygiene === 1 ? 'Hygiene' : 'General'}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(op)}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDelete(op.OperatoryNum)}
                      >
                        Delete
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-4">
        {operatories.length === 0 ? (
          <div className="text-center text-gray-500 py-8 border rounded-lg">
            No operatories found. Create one to get started.
          </div>
        ) : (
          operatories.map((op) => (
            <div key={op.OperatoryNum} className="border rounded-lg p-4 space-y-3 bg-white">
              <div className="flex justify-between items-start">
                <div>
                  <div className="text-lg font-semibold text-gray-900">
                    {op.OpName}
                  </div>
                  <div className="mt-1">
                    <Badge>{op.IsHygiene === 1 ? 'Hygiene' : 'General'}</Badge>
                  </div>
                </div>
              </div>
              <div className="flex gap-2 pt-2 border-t">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleEdit(op)}
                  className="flex-1"
                >
                  Edit
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleDelete(op.OperatoryNum)}
                  className="flex-1"
                >
                  Delete
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingOperatory ? 'Edit Operatory' : 'New Operatory'}
            </DialogTitle>
            <DialogDescription>
              {editingOperatory
                ? 'Update operatory details'
                : 'Create a new operatory'}
            </DialogDescription>
          </DialogHeader>
          <form action={handleSave}>
            <div className="grid gap-4 py-4">
              <div>
                <Label htmlFor="name">{tCommon('name')}</Label>
                <Input
                  id="name"
                  name="name"
                  defaultValue={editingOperatory?.name || ''}
                  required
                />
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox id="isHygiene" name="isHygiene" defaultChecked={editingOperatory?.isHygiene} />
                <Label htmlFor="isHygiene" className="cursor-pointer">{tCommon('hygiene_operatory')}</Label>
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsDialogOpen(false);
                  setEditingOperatory(null);
                }}
              >
                Cancel
              </Button>
              <Button type="submit">{tCommon('save')}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

