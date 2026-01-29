'use client';

import { useEffect, useState, Suspense } from 'react';
import { useTranslations } from '@/lib/i18n/TranslationProvider';
import { useSearchParams, useRouter } from 'next/navigation';
import { DentalChartModule, TreatmentPlan } from '@/app/components/dental-chart';
import { useDentalChartStore } from '@/app/components/dental-chart/dentalChartStore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Search, ArrowLeft, User, Calendar } from 'lucide-react';

interface Patient {
  PatNum: number;
  FName: string;
  LName: string;
  WirelessPhone?: string;
}

function TreatmentsContent() {
  const tCommon = useTranslations('common');
  const searchParams = useSearchParams();
  const router = useRouter();
  const patientIdFromUrl = searchParams.get('patientId');
  const { clearAll, loadTreatments } = useDentalChartStore();
  
  const [mode, setMode] = useState<'search' | 'chart'>('search');
  const [searchQuery, setSearchQuery] = useState('');
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [savedPlans, setSavedPlans] = useState<TreatmentPlan[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [dentalMode, setDentalMode] = useState(true);

  // Load all patients and organization settings on mount
  useEffect(() => {
    fetchAllPatients();
    fetchOrganizationSettings();
  }, []);

  const fetchOrganizationSettings = async () => {
    try {
      const response = await fetch('/api/admin/organization-settings');
      const data = await response.json();
      
      if (data.success && data.settings) {
        setDentalMode(data.settings.dental_mode ?? true);
      }
    } catch (error) {
      console.error('Error fetching organization settings:', error);
      // Default to true if error
      setDentalMode(true);
    }
  };

  // If patientId is in URL, fetch patient and go to chart mode
  useEffect(() => {
    if (patientIdFromUrl) {
      fetchPatient(parseInt(patientIdFromUrl));
    }
  }, [patientIdFromUrl]);

  const fetchAllPatients = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          functionName: 'GetAllPatients',
          parameters: {},
        }),
      });
      const data = await response.json();
      
      console.log('[Treatments] GetAllPatients response:', data);
      console.log('[Treatments] Is array?', Array.isArray(data));
      console.log('[Treatments] Patient count:', Array.isArray(data) ? data.length : 0);
      
      if (data.error) {
        console.error('[Treatments] API returned error:', data.message);
        setPatients([]);
      } else {
        setPatients(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error('Error fetching all patients:', error);
      setPatients([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchPatient = async (patNum: number) => {
    try {
      setLoading(true);
      const response = await fetch('/api/booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          functionName: 'GetPatient',
          parameters: { PatNum: patNum },
        }),
      });
      const data = await response.json();
      if (data && !data.error) {
        setSelectedPatient(data);
        setMode('chart');
      }
    } catch (error) {
      console.error('Error fetching patient:', error);
    } finally {
      setLoading(false);
    }
  };

  const searchPatients = async () => {
    setHasSearched(true);
    
    // If empty search, load all patients
    if (!searchQuery.trim()) {
      await fetchAllPatients();
      return;
    }
    
    try {
      setLoading(true);
      const [firstName, ...lastNameParts] = searchQuery.split(' ');
      const lastName = lastNameParts.join(' ');
      
      const params: Record<string, string> = {};
      if (firstName) params.FName = firstName;
      if (lastName) params.LName = lastName;
      if (!firstName && !lastName && searchQuery) {
        params.Phone = searchQuery.replace(/\D/g, '');
      }

      const response = await fetch('/api/booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          functionName: 'GetMultiplePatients',
          parameters: params,
        }),
      });
      const data = await response.json();
      setPatients(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error searching patients:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPatient = async (patient: Patient) => {
    // Clear any previous treatments from the store before selecting a new patient
    clearAll();
    setSelectedPatient(patient);
    
    // Load saved treatment plans for this patient from the database
    await loadPatientTreatments(patient.PatNum);
    
    setMode('chart');
  };

  const loadPatientTreatments = async (patientId: number) => {
    try {
      const response = await fetch(`/api/treatment-plans?patientId=${patientId}`);
      if (!response.ok) {
        console.log('[Treatments] No saved plans found for patient:', patientId);
        return;
      }
      
      const data = await response.json();
      
      // If there are saved treatment plans, load the most recent one into the store
      if (Array.isArray(data) && data.length > 0) {
        const latestPlan = data[0]; // API returns sorted by date, most recent first
        
        console.log('[Treatments] Loading saved plan:', latestPlan);
        
        // Convert TreatmentPlanItem[] back to ChartedTreatment[] format for the store
        const chartedTreatments = latestPlan.treatments.map((item: any, index: number) => ({
          id: `saved-${latestPlan.id}-${index}`,
          tooth: {
            toothId: String(item.toothFdi || 0),
            toothFdi: String(item.toothFdi || 0),
            toothType: 'adult',
            surfaces: item.surfaces || [],
          },
          treatment: {
            id: item.treatmentCode, // Use code as ID since treatmentId isn't stored
            code: item.treatmentCode,
            name: item.treatmentName,
            category: 'restorative' as any, // Default category
            price: item.price,
            duration: item.duration,
            requiresSurface: (item.surfaces && item.surfaces.length > 0),
          },
          notes: item.notes || '',
          status: item.status as any,
          createdAt: new Date(latestPlan.createdAt),
        }));
        
        console.log('[Treatments] Loaded charted treatments:', chartedTreatments);
        loadTreatments(chartedTreatments);
      } else {
        console.log('[Treatments] No saved plans for patient:', patientId);
      }
    } catch (error) {
      console.error('Error loading patient treatments:', error);
    }
  };

  const handleBack = () => {
    // Clear treatments when going back to patient list
    clearAll();
    setSelectedPatient(null);
    setMode('search');
    router.push('/admin/booking/treatments');
  };

  const handleSaveTreatmentPlan = async (plan: TreatmentPlan) => {
    try {
      const response = await fetch('/api/treatment-plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(plan),
      });

      if (response.ok) {
        const savedPlan = await response.json();
        setSavedPlans(prev => [...prev, savedPlan]);
        alert('Treatment plan saved successfully! You can continue editing or go back to patient list.');
        // Don't clear or navigate - let user decide what to do next
      } else {
        const error = await response.json();
        alert(`Error: ${error.message || 'Failed to save treatment plan'}`);
      }
    } catch (error) {
      console.error('Error saving treatment plan:', error);
      alert('An error occurred while saving the treatment plan');
    }
  };

  if (mode === 'chart' && selectedPatient) {
    return (
      <div>
        <div className="mb-4">
          <Button variant="outline" onClick={handleBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Patient Search
          </Button>
        </div>
        
        <DentalChartModule
          patientId={String(selectedPatient.PatNum)}
          patientName={`${selectedPatient.FName} ${selectedPatient.LName}`}
          onSave={handleSaveTreatmentPlan}
          hideDentalFeatures={!dentalMode}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">{tCommon('treatment_plans')}</h1>
        <p className="text-gray-600 mt-2">
          {dentalMode 
            ? 'Select a patient to create a treatment plan using the dental chart'
            : 'Select a client to create a treatment or service plan'
          }
        </p>
      </div>

      {/* Search Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Search Patients
          </CardTitle>
          <CardDescription>
            Search by name or phone number
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="flex-1">
              <Input
                placeholder={tCommon('patient_name_or_phone')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && searchPatients()}
              />
            </div>
            <Button onClick={searchPatients} disabled={loading}>
              {loading ? 'Searching...' : 'Search'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Patient List */}
      {patients.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Patients ({patients.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {patients.map((patient) => (
                <div
                  key={patient.PatNum}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 cursor-pointer"
                  onClick={() => handleSelectPatient(patient)}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                      <User className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">
                        {patient.FName} {patient.LName}
                      </p>
                      <p className="text-sm text-gray-500">
                        ID: {patient.PatNum}
                        {patient.WirelessPhone && ` • ${patient.WirelessPhone}`}
                      </p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm">
                    Create Treatment Plan
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty state */}
      {patients.length === 0 && !loading && (
        <Card>
          <CardContent className="py-12 text-center">
            <User className="w-16 h-16 mx-auto text-gray-300 mb-4" />
            {hasSearched && searchQuery ? (
              <>
                <p className="text-gray-700 font-medium mb-2">No patients found matching your search</p>
                <p className="text-sm text-gray-500">Try a different search term or clear your search</p>
              </>
            ) : (
              <>
                <p className="text-gray-700 font-medium mb-2">No {dentalMode ? 'patients' : 'clients'} yet</p>
                <p className="text-sm text-gray-500 mb-4">
                  {dentalMode 
                    ? 'Add patients in the Patients section first, then return here to create treatment plans'
                    : 'Add clients in the Patients section first, then return here to create service plans'
                  }
                </p>
                <Button 
                  variant="outline"
                  onClick={() => window.location.href = '/admin/booking/patients'}
                >
                  Go to {dentalMode ? 'Patients' : 'Clients'} →
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Loading state */}
      {loading && (
        <Card>
          <CardContent className="py-8 text-center text-gray-500">{tCommon('loading')}</CardContent>
        </Card>
      )}

      {/* Saved Plans Section */}
      {savedPlans.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Recently Saved Treatment Plans
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {savedPlans.map((plan, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div>
                    <p className="font-medium">Patient ID: {plan.patientId}</p>
                    <p className="text-sm text-gray-500">
                      {plan.treatments.length} treatments • ${plan.totalPrice.toLocaleString('en-US')}
                    </p>
                  </div>
                  <span className="text-xs text-gray-400">
                    {new Date(plan.createdAt).toLocaleString('en-US')}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function TreatmentsPage() {
  const tCommon = useTranslations('common');
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64">
      <div className="text-gray-500">{tCommon('loading')}</div>
    </div>}>
      <TreatmentsContent />
    </Suspense>
  );
}
