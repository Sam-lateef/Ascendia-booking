'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { 
  Building2, 
  Save, 
  Palette,
  Globe,
  CheckCircle2,
  AlertCircle,
  Users,
  Mail,
  UserPlus,
  Trash2,
  Shield
} from 'lucide-react';
import { useOrganization } from '@/app/contexts/OrganizationContext';

interface OrganizationSettings {
  name: string;
  slug: string;
  plan: string;
  status: string;
  dental_mode: boolean;
  logo_url: string;
  primary_color: string;
  timezone: string;
  business_hours: string;
  contact_email: string;
  contact_phone: string;
  address: string;
}

export default function OrganizationSettingsPage() {
  const { currentOrganization } = useOrganization();
  const [settings, setSettings] = useState<OrganizationSettings>({
    name: '',
    slug: '',
    plan: 'free',
    status: 'active',
    dental_mode: true,
    logo_url: '',
    primary_color: '#3B82F6',
    timezone: 'America/New_York',
    business_hours: '9:00 AM - 5:00 PM',
    contact_email: '',
    contact_phone: '',
    address: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  
  // Team members state
  const [members, setMembers] = useState<any[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('member');
  const [inviting, setInviting] = useState(false);

  useEffect(() => {
    fetchOrganizationSettings();
    fetchTeamMembers();
  }, [currentOrganization]);

  const fetchOrganizationSettings = async () => {
    if (!currentOrganization) return;
    
    setLoading(true);
    try {
      const response = await fetch('/api/admin/organization-settings');
      const data = await response.json();
      
      if (data.success && data.settings) {
        setSettings(prev => ({
          ...prev,
          ...data.settings,
          name: currentOrganization.name || data.settings.name || '',
          slug: currentOrganization.slug || data.settings.slug || '',
          plan: currentOrganization.plan || data.settings.plan || 'free',
        }));
      } else {
        // Initialize with organization context data
        setSettings(prev => ({
          ...prev,
          name: currentOrganization.name || '',
          slug: currentOrganization.slug || '',
          plan: currentOrganization.plan || 'free',
        }));
      }
    } catch (error) {
      console.error('Error fetching organization settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);

    try {
      const response = await fetch('/api/admin/organization-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });

      const data = await response.json();

      if (data.success) {
        setMessage({ type: 'success', text: 'Organization settings saved successfully' });
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to save settings' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to save organization settings' });
    } finally {
      setSaving(false);
    }
  };

  const fetchTeamMembers = async () => {
    if (!currentOrganization) return;
    
    setLoadingMembers(true);
    try {
      const response = await fetch('/api/admin/organization-members');
      const data = await response.json();
      
      if (data.success) {
        setMembers(data.members || []);
      }
    } catch (error) {
      console.error('Error fetching team members:', error);
    } finally {
      setLoadingMembers(false);
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail) return;

    setInviting(true);
    setMessage(null);

    try {
      const response = await fetch('/api/admin/organization-members/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email: inviteEmail, 
          role: inviteRole 
        }),
      });

      const data = await response.json();

      if (data.success) {
        setMessage({ type: 'success', text: `Invitation sent to ${inviteEmail}` });
        setInviteEmail('');
        setInviteRole('member');
        fetchTeamMembers();
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to send invitation' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to send invitation' });
    } finally {
      setInviting(false);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!confirm('Are you sure you want to remove this team member?')) return;

    try {
      const response = await fetch(`/api/admin/organization-members/${memberId}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (data.success) {
        setMessage({ type: 'success', text: 'Team member removed successfully' });
        fetchTeamMembers();
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to remove member' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to remove team member' });
    }
  };

  const handleUpdateRole = async (memberId: string, newRole: string) => {
    try {
      const response = await fetch(`/api/admin/organization-members/${memberId}/role`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      });

      const data = await response.json();

      if (data.success) {
        setMessage({ type: 'success', text: 'Role updated successfully' });
        fetchTeamMembers();
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to update role' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to update role' });
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6">Organization Settings</h1>
        <div className="animate-pulse space-y-4">
          <div className="h-32 bg-gray-200 rounded"></div>
          <div className="h-48 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Organization Settings</h1>
        <p className="text-gray-600 mt-1">Configure your organization's profile and preferences</p>
      </div>

      {message && (
        <div className={`p-4 rounded-lg border flex items-center gap-3 ${
          message.type === 'success' 
            ? 'bg-green-50 border-green-200 text-green-800'
            : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          {message.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5" />
          ) : (
            <AlertCircle className="w-5 h-5" />
          )}
          {message.text}
        </div>
      )}

      {/* Basic Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5" />
            Basic Information
          </CardTitle>
          <CardDescription>
            Your organization's identity and contact details
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Organization Name</Label>
              <Input
                id="name"
                value={settings.name}
                onChange={(e) => setSettings({ ...settings, name: e.target.value })}
                placeholder="Your Clinic Name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="slug">URL Slug</Label>
              <Input
                id="slug"
                value={settings.slug}
                onChange={(e) => setSettings({ ...settings, slug: e.target.value })}
                placeholder="your-clinic"
                disabled
              />
              <p className="text-xs text-gray-500">Used in URLs - contact support to change</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="contact_email">Contact Email</Label>
              <Input
                id="contact_email"
                type="email"
                value={settings.contact_email}
                onChange={(e) => setSettings({ ...settings, contact_email: e.target.value })}
                placeholder="contact@yourclinic.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact_phone">Contact Phone</Label>
              <Input
                id="contact_phone"
                value={settings.contact_phone}
                onChange={(e) => setSettings({ ...settings, contact_phone: e.target.value })}
                placeholder="+1 (555) 123-4567"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Business Address</Label>
            <Textarea
              id="address"
              value={settings.address}
              onChange={(e) => setSettings({ ...settings, address: e.target.value })}
              placeholder="123 Main St, Suite 100, City, State 12345"
              rows={2}
            />
          </div>
        </CardContent>
      </Card>

      {/* Industry Settings - Hidden per user request */}
      {/* <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="w-5 h-5" />
            Industry Settings
          </CardTitle>
          <CardDescription>
            Configure industry-specific features
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="space-y-1">
              <Label htmlFor="dental-mode" className="text-base font-medium">
                Dental Mode
              </Label>
              <p className="text-sm text-gray-600">
                Enable dental-specific features like tooth charts, dental procedures, 
                and tooth selection in treatment plans.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                id="dental-mode"
                onClick={() => setSettings({ ...settings, dental_mode: !settings.dental_mode })}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  settings.dental_mode ? 'bg-blue-600' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    settings.dental_mode ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
              <span className="text-sm font-medium text-gray-700 w-16">
                {settings.dental_mode ? 'Enabled' : 'Disabled'}
              </span>
            </div>
          </div>

          {!settings.dental_mode && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                <strong>Non-Dental Mode:</strong> Tooth charts and dental-specific features will be hidden.
                Perfect for salons, spas, medical offices, or other service businesses.
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="timezone">Timezone</Label>
              <select
                id="timezone"
                value={settings.timezone}
                onChange={(e) => setSettings({ ...settings, timezone: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="America/New_York">Eastern Time (ET)</option>
                <option value="America/Chicago">Central Time (CT)</option>
                <option value="America/Denver">Mountain Time (MT)</option>
                <option value="America/Los_Angeles">Pacific Time (PT)</option>
                <option value="America/Phoenix">Arizona (AZ)</option>
                <option value="Europe/London">London (GMT)</option>
                <option value="Europe/Paris">Paris (CET)</option>
                <option value="Asia/Dubai">Dubai (GST)</option>
                <option value="Asia/Tokyo">Tokyo (JST)</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="business_hours">Business Hours</Label>
              <Input
                id="business_hours"
                value={settings.business_hours}
                onChange={(e) => setSettings({ ...settings, business_hours: e.target.value })}
                placeholder="9:00 AM - 5:00 PM"
              />
            </div>
          </div>
        </CardContent>
      </Card> */}

      {/* Branding */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="w-5 h-5" />
            Branding
          </CardTitle>
          <CardDescription>
            Customize your organization's appearance
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="logo_url">Logo URL</Label>
              <Input
                id="logo_url"
                value={settings.logo_url}
                onChange={(e) => setSettings({ ...settings, logo_url: e.target.value })}
                placeholder="https://example.com/logo.png"
              />
              <p className="text-xs text-gray-500">Recommended size: 200x50px</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="primary_color">Primary Color</Label>
              <div className="flex gap-2">
                <Input
                  id="primary_color"
                  type="color"
                  value={settings.primary_color}
                  onChange={(e) => setSettings({ ...settings, primary_color: e.target.value })}
                  className="w-16 h-10 p-1 cursor-pointer"
                />
                <Input
                  value={settings.primary_color}
                  onChange={(e) => setSettings({ ...settings, primary_color: e.target.value })}
                  placeholder="#3B82F6"
                  className="flex-1"
                />
              </div>
            </div>
          </div>

          {settings.logo_url && (
            <div className="p-4 border rounded-lg bg-gray-50">
              <p className="text-sm text-gray-600 mb-2">Logo Preview:</p>
              <img 
                src={settings.logo_url} 
                alt="Organization Logo" 
                className="max-h-12 object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Plan Info (Read-only) */}
      <Card>
        <CardHeader>
          <CardTitle>Subscription Plan</CardTitle>
          <CardDescription>
            Your current plan and usage
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-4 border rounded-lg bg-gradient-to-r from-blue-50 to-indigo-50">
            <div>
              <p className="font-semibold text-lg capitalize">{settings.plan} Plan</p>
              <p className="text-sm text-gray-600">
                Status: <span className="capitalize text-green-600">{settings.status}</span>
              </p>
            </div>
            <Button variant="outline" disabled>
              Upgrade Plan
            </Button>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Contact support to upgrade or modify your subscription.
          </p>
        </CardContent>
      </Card>

      {/* Team Members */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Team Members
          </CardTitle>
          <CardDescription>
            Manage who has access to your organization
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Invite New Member */}
          <form onSubmit={handleInvite} className="p-4 border rounded-lg bg-gray-50">
            <div className="flex items-center gap-2 mb-3">
              <UserPlus className="w-4 h-4 text-blue-600" />
              <Label className="text-sm font-medium">Invite New Member</Label>
            </div>
            <div className="flex gap-2">
              <Input
                type="email"
                placeholder="email@example.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                className="flex-1"
                required
              />
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="member">Member</option>
                <option value="staff">Staff</option>
                <option value="manager">Manager</option>
                <option value="admin">Admin</option>
              </select>
              <Button type="submit" disabled={inviting}>
                <Mail className="w-4 h-4 mr-2" />
                {inviting ? 'Sending...' : 'Invite'}
              </Button>
            </div>
          </form>

          {/* Members List */}
          <div className="space-y-2">
            {loadingMembers ? (
              <div className="text-center py-8 text-gray-500">Loading team members...</div>
            ) : members.length === 0 ? (
              <div className="text-center py-8 text-gray-500">No team members yet. Invite someone to get started!</div>
            ) : (
              members.map((member) => (
                <div key={member.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                      <span className="text-blue-600 font-medium text-sm">
                        {member.user?.first_name?.charAt(0) || member.user?.email?.charAt(0)?.toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">
                        {member.user?.first_name && member.user?.last_name
                          ? `${member.user.first_name} ${member.user.last_name}`
                          : member.user?.email}
                      </p>
                      <p className="text-sm text-gray-500">{member.user?.email}</p>
                      {member.status === 'invited' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-yellow-100 text-yellow-800 rounded">
                          <Mail className="w-3 h-3" />
                          Invitation Pending
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={member.role}
                      onChange={(e) => handleUpdateRole(member.id, e.target.value)}
                      disabled={member.role === 'owner'}
                      className="px-3 py-1.5 text-sm border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <option value="member">Member</option>
                      <option value="staff">Staff</option>
                      <option value="manager">Manager</option>
                      <option value="admin">Admin</option>
                      <option value="owner">Owner</option>
                    </select>
                    {member.role !== 'owner' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRemoveMember(member.id)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Role Descriptions */}
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="w-4 h-4 text-blue-600" />
              <p className="text-sm font-medium text-blue-900">Role Descriptions</p>
            </div>
            <ul className="text-xs text-blue-800 space-y-1 ml-6">
              <li><strong>Owner:</strong> Full access - cannot be changed or removed</li>
              <li><strong>Admin:</strong> Full access to all settings and data</li>
              <li><strong>Manager:</strong> Manage appointments, patients, and staff</li>
              <li><strong>Staff:</strong> View and edit appointments and patients</li>
              <li><strong>Member:</strong> View-only access to appointments</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button variant="outline" onClick={fetchOrganizationSettings}>
          Reset Changes
        </Button>
        <Button onClick={handleSave} disabled={saving}>
          <Save className="w-4 h-4 mr-2" />
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </div>
  );
}
