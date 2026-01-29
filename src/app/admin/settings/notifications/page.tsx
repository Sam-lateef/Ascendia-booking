'use client';

import { useState, useEffect } from 'react';
import { useOrganization } from '@/app/contexts/OrganizationContext';

interface NotificationSettings {
  call_ended_email_enabled: boolean;
  call_ended_recipients: string[];
  email_from: string | null;
  include_recording_links: boolean;
  include_transcript: boolean;
  include_cost: boolean;
  include_performance: boolean;
  min_duration_to_notify: number;
}

export default function NotificationsPage() {
  const { currentOrganization, loading: orgLoading } = useOrganization();
  const [settings, setSettings] = useState<NotificationSettings>({
    call_ended_email_enabled: true,
    call_ended_recipients: [],
    email_from: null,
    include_recording_links: true,
    include_transcript: true,
    include_cost: true,
    include_performance: true,
    min_duration_to_notify: 10000
  });
  const [newRecipient, setNewRecipient] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Load current settings
  useEffect(() => {
    if (currentOrganization) {
      loadSettings();
    }
  }, [currentOrganization]);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/admin/organization-settings?org_id=${currentOrganization?.id}`);
      if (!response.ok) throw new Error('Failed to load settings');
      
      const data = await response.json();
      if (data.notification_settings) {
        setSettings(data.notification_settings);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
      showMessage('error', 'Failed to load notification settings');
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    try {
      setSaving(true);
      const response = await fetch('/api/admin/organization-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          org_id: currentOrganization?.id,
          notification_settings: settings
        })
      });

      if (!response.ok) throw new Error('Failed to save settings');
      
      showMessage('success', 'Settings saved successfully!');
    } catch (error) {
      console.error('Error saving settings:', error);
      showMessage('error', 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const addRecipient = () => {
    const trimmed = newRecipient.trim();
    if (!trimmed) return;
    
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmed)) {
      showMessage('error', 'Please enter a valid email address');
      return;
    }
    
    if (settings.call_ended_recipients.includes(trimmed)) {
      showMessage('error', 'Email already added');
      return;
    }
    
    setSettings(prev => ({
      ...prev,
      call_ended_recipients: [...prev.call_ended_recipients, trimmed]
    }));
    setNewRecipient('');
  };

  const removeRecipient = (email: string) => {
    setSettings(prev => ({
      ...prev,
      call_ended_recipients: prev.call_ended_recipients.filter(e => e !== email)
    }));
  };

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  if (orgLoading || loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Email Notifications</h1>
        <p className="text-gray-600">
          Configure email notifications for call events
        </p>
      </div>

      {/* Message */}
      {message && (
        <div className={`mb-6 p-4 rounded-lg ${
          message.type === 'success' 
            ? 'bg-green-50 text-green-800 border border-green-200' 
            : 'bg-red-50 text-red-800 border border-red-200'
        }`}>
          {message.text}
        </div>
      )}

      <div className="space-y-6">
        {/* Enable/Disable */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Enable Email Notifications</h3>
              <p className="text-sm text-gray-600 mt-1">
                Receive emails when calls end
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.call_ended_email_enabled}
                onChange={(e) => setSettings({ ...settings, call_ended_email_enabled: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
        </div>

        {/* Recipients */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">📧 Email Recipients</h3>
          <p className="text-sm text-gray-600 mb-4">
            Add email addresses to receive call notifications
          </p>
          
          {/* Add recipient */}
          <div className="flex gap-2 mb-4">
            <input
              type="email"
              value={newRecipient}
              onChange={(e) => setNewRecipient(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && addRecipient()}
              placeholder="email@example.com"
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <button
              onClick={addRecipient}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              Add
            </button>
          </div>

          {/* Recipients list */}
          {settings.call_ended_recipients.length > 0 ? (
            <div className="space-y-2">
              {settings.call_ended_recipients.map((email) => (
                <div key={email} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="text-gray-700">{email}</span>
                  <button
                    onClick={() => removeRecipient(email)}
                    className="text-red-600 hover:text-red-800 text-sm font-medium"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6 text-gray-500 bg-gray-50 rounded-lg">
              No recipients configured. Using organization default email.
            </div>
          )}
        </div>

        {/* FROM Email */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">📮 Sender Email</h3>
          <p className="text-sm text-gray-600 mb-4">
            Custom FROM email address (optional). Leave blank to use default.
          </p>
          <input
            type="email"
            value={settings.email_from || ''}
            onChange={(e) => setSettings({ ...settings, email_from: e.target.value || null })}
            placeholder="calls@yourdomain.com"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <p className="text-xs text-gray-500 mt-2">
            Default: {process.env.NEXT_PUBLIC_RESEND_FROM_EMAIL || 'onboarding@resend.dev'}
          </p>
        </div>

        {/* Email Content Options */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">📄 Email Content</h3>
          <p className="text-sm text-gray-600 mb-4">
            Choose what to include in email notifications
          </p>
          
          <div className="space-y-3">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={settings.include_transcript}
                onChange={(e) => setSettings({ ...settings, include_transcript: e.target.checked })}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="ml-3 text-gray-700">Include transcript preview</span>
            </label>

            <label className="flex items-center">
              <input
                type="checkbox"
                checked={settings.include_recording_links}
                onChange={(e) => setSettings({ ...settings, include_recording_links: e.target.checked })}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="ml-3 text-gray-700">Include recording links</span>
            </label>

            <label className="flex items-center">
              <input
                type="checkbox"
                checked={settings.include_performance}
                onChange={(e) => setSettings({ ...settings, include_performance: e.target.checked })}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="ml-3 text-gray-700">Include performance metrics</span>
            </label>

            <label className="flex items-center">
              <input
                type="checkbox"
                checked={settings.include_cost}
                onChange={(e) => setSettings({ ...settings, include_cost: e.target.checked })}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="ml-3 text-gray-700">Include cost information</span>
            </label>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">🔍 Filters</h3>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Minimum Call Duration (seconds)
            </label>
            <p className="text-xs text-gray-600 mb-3">
              Don't send emails for calls shorter than this duration
            </p>
            <input
              type="number"
              value={settings.min_duration_to_notify / 1000}
              onChange={(e) => setSettings({ 
                ...settings, 
                min_duration_to_notify: parseInt(e.target.value) * 1000 
              })}
              min="0"
              className="w-32 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <span className="ml-2 text-gray-600">seconds</span>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end gap-4">
          <button
            onClick={loadSettings}
            disabled={saving}
            className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition disabled:opacity-50"
          >
            Reset
          </button>
          <button
            onClick={saveSettings}
            disabled={saving}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 flex items-center gap-2"
          >
            {saving ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Saving...
              </>
            ) : (
              'Save Settings'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
