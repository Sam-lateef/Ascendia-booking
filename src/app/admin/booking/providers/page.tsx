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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface Provider {
  ProvNum: number;
  FName: string;
  LName: string;
  Specialty: string;
}

export default function ProvidersPage() {
  const t = useTranslations('providers');
  const tCommon = useTranslations('common');
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProvider, setEditingProvider] = useState<any>(null);

  useEffect(() => {
    fetchProviders();
  }, []);

  const fetchProviders = async () => {
    try {
      const response = await fetch('/api/booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          functionName: 'GetProviders',
          parameters: {},
        }),
      });
      const data = await response.json();
      setProviders(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching providers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (provider: Provider) => {
    setEditingProvider({
      id: provider.ProvNum,
      first_name: provider.FName,
      last_name: provider.LName,
      specialty_tags: provider.Specialty ? provider.Specialty.split(', ') : [],
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (provNum: number) => {
    if (!confirm('Are you sure you want to delete this provider?')) return;

    try {
      const response = await fetch('/api/booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          functionName: 'DeleteProvider',
          parameters: { ProvNum: provNum },
        }),
      });

      if (response.ok) {
        fetchProviders();
      } else {
        const error = await response.json();
        alert(error.message || 'Failed to delete provider');
      }
    } catch (error) {
      console.error('Error deleting provider:', error);
      alert('Error deleting provider');
    }
  };

  const handleSave = async (formData: FormData) => {
    try {
      // Collect specialty tags from checkboxes
      const specialtyTags: string[] = [];
      const specialtyOptions = ['General', 'Orthodontics', 'Oral Surgery', 'Periodontics', 'Endodontics'];
      specialtyOptions.forEach(tag => {
        if (formData.get(tag) === 'on') {
          specialtyTags.push(tag);
        }
      });
      
      const params: any = {
        first_name: formData.get('first_name'),
        last_name: formData.get('last_name'),
        specialty_tags: specialtyTags.length > 0 ? specialtyTags : ['General'],
      };
      
      // Add ID if editing
      if (editingProvider?.id) {
        params.id = editingProvider.id;
      }

      const response = await fetch('/api/booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          functionName: editingProvider ? 'UpdateProvider' : 'CreateProvider',
          parameters: params,
        }),
      });

      if (response.ok) {
        setIsDialogOpen(false);
        setEditingProvider(null);
        fetchProviders();
      } else {
        const error = await response.json();
        alert(error.message || 'Failed to save provider');
      }
    } catch (error) {
      console.error('Error saving provider:', error);
      alert('Error saving provider');
    }
  };

  if (loading) {
    return <div className="text-center py-8">{t('loading')}</div>;
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
            setEditingProvider(null);
            setIsDialogOpen(true);
          }}
          className="w-full sm:w-auto"
        >
          + {tCommon('new')} {t('title')}
        </Button>
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block border rounded-lg overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{tCommon('name')}</TableHead>
              <TableHead>{tCommon('specialty')}</TableHead>
              <TableHead>{tCommon('actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {providers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-gray-500 py-8">
                  {t('noProviders')}
                </TableCell>
              </TableRow>
            ) : (
              providers.map((provider) => (
                <TableRow key={provider.ProvNum}>
                  <TableCell>
                    {provider.FName} {provider.LName}
                  </TableCell>
                  <TableCell>
                    <Badge>{provider.Specialty || tCommon('general')}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(provider)}
                      >
                        {tCommon('edit')}
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDelete(provider.ProvNum)}
                      >
                        {tCommon('delete')}
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
        {providers.length === 0 ? (
          <div className="text-center text-gray-500 py-8 border rounded-lg">
            {t('noProviders')}
          </div>
        ) : (
          providers.map((provider) => (
            <div key={provider.ProvNum} className="border rounded-lg p-4 space-y-3 bg-white">
              <div className="flex justify-between items-start">
                <div>
                  <div className="text-lg font-semibold text-gray-900">
                    {provider.FName} {provider.LName}
                  </div>
                  <div className="mt-1">
                    <Badge>{provider.Specialty || tCommon('general')}</Badge>
                  </div>
                </div>
              </div>
              <div className="flex gap-2 pt-2 border-t">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleEdit(provider)}
                  className="flex-1"
                >
                  {tCommon('edit')}
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleDelete(provider.ProvNum)}
                  className="flex-1"
                >
                  {tCommon('delete')}
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingProvider ? `${tCommon('edit')} ${t('title')}` : `${tCommon('create') || 'New'} ${t('title')}`}
            </DialogTitle>
            <DialogDescription>
              {editingProvider
                ? t('updateProviderDetails') || 'Update provider details'
                : t('createNewProvider') || 'Create a new provider'}
            </DialogDescription>
          </DialogHeader>
          <Tabs defaultValue="details" className="w-full">
            <TabsList>
              <TabsTrigger value="details">{t('details') || 'Details'}</TabsTrigger>
              <TabsTrigger value="schedules">{t('schedules') || 'Schedules'}</TabsTrigger>
            </TabsList>
            <TabsContent value="details">
              {editingProvider && (
                <input type="hidden" name="id" value={editingProvider.id} />
              )}
              <form action={handleSave}>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="first_name">{t('firstName')}</Label>
                      <Input
                        id="first_name"
                        name="first_name"
                        defaultValue={editingProvider?.first_name || ''}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="last_name">{t('lastName')}</Label>
                      <Input
                        id="last_name"
                        name="last_name"
                        defaultValue={editingProvider?.last_name || ''}
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <Label>{tCommon('specialty')}</Label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {['General', 'Orthodontics', 'Oral Surgery', 'Periodontics', 'Endodontics'].map((tag) => {
                        const currentTags = editingProvider?.specialty_tags || [];
                        const isChecked = currentTags.includes(tag);
                        return (
                          <div key={tag} className="flex items-center space-x-2">
                            <Checkbox 
                              id={tag} 
                              name={tag}
                              defaultChecked={isChecked}
                            />
                            <Label htmlFor={tag} className="cursor-pointer">{tag}</Label>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsDialogOpen(false);
                      setEditingProvider(null);
                    }}
                  >
                    {tCommon('cancel')}
                  </Button>
                  <Button type="submit">{tCommon('save')}</Button>
                </DialogFooter>
              </form>
            </TabsContent>
            <TabsContent value="schedules">
              <div className="py-4">
                <p className="text-sm text-gray-600 mb-4">
                  {t('scheduleManagementInfo') || 'Schedule management will be implemented'}
                </p>
                <Button variant="outline">+ {tCommon('add')} Schedule</Button>
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>
  );
}

