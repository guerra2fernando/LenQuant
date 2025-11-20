import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Loader2, Save, Database, HardDrive, Clock, CheckCircle } from 'lucide-react';
import { buildApiUrl } from '@/lib/api';

interface DataRetentionSettings {
  tier1_days: number;
  tier2_days: number;
  tier3_days: number;
  cleanup_interval_hours: number;
  updated_at?: string;
}

export default function DataRetentionTab() {
  const [settings, setSettings] = useState<DataRetentionSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    tier1_days: 90,
    tier2_days: 365,
    tier3_days: 3650,
    cleanup_interval_hours: 24,
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const url = buildApiUrl('/api/settings/data-retention');
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Failed to fetch settings');
      }
      const data = await response.json();
      setSettings(data);
      setFormData({
        tier1_days: data.tier1_days,
        tier2_days: data.tier2_days,
        tier3_days: data.tier3_days,
        cleanup_interval_hours: data.cleanup_interval_hours,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(false);

      const url = buildApiUrl('/api/settings/data-retention');
      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error('Failed to save settings');
      }

      const updatedSettings = await response.json();
      setSettings(updatedSettings);
      setSuccess(true);

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    const numValue = parseInt(value, 10);
    if (!isNaN(numValue)) {
      setFormData(prev => ({
        ...prev,
        [field]: numValue,
      }));
    }
  };

  const calculateStorageEstimate = () => {
    // Rough estimate: 30 cryptos, ~300 bytes per record
    const tier1Records = 30 * formData.tier1_days * 24 * 60; // minute data
    const tier2Records = 30 * (formData.tier2_days - formData.tier1_days) * 24; // hourly data
    const tier3Records = 30 * (formData.tier3_days - formData.tier2_days); // daily data

    const tier1GB = (tier1Records * 300) / (1024 * 1024 * 1024);
    const tier2GB = (tier2Records * 200) / (1024 * 1024 * 1024);
    const tier3GB = (tier3Records * 150) / (1024 * 1024 * 1024);

    return {
      total: tier1GB + tier2GB + tier3GB,
      tier1: tier1GB,
      tier2: tier2GB,
      tier3: tier3GB,
    };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin" />
        <span className="ml-2">Loading settings...</span>
      </div>
    );
  }

  const storage = calculateStorageEstimate();

  return (
    <div className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>Settings saved successfully!</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Settings Form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Database className="h-5 w-5" />
              <span>Retention Settings</span>
            </CardTitle>
            <CardDescription>
              Configure data retention periods for different data resolutions
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="tier1_days" className="flex items-center space-x-2">
                <HardDrive className="h-4 w-4" />
                <span>Tier 1: Full Resolution (days)</span>
                <Badge variant="secondary">1m, 1h, 1d</Badge>
              </Label>
              <Input
                id="tier1_days"
                type="number"
                min="30"
                max="365"
                value={formData.tier1_days}
                onChange={(e) => handleInputChange('tier1_days', e.target.value)}
              />
              <p className="text-sm text-muted-foreground">
                Keep minute, hourly, and daily data for active trading and model training
              </p>
            </div>

            <Separator />

            <div className="space-y-2">
              <Label htmlFor="tier2_days" className="flex items-center space-x-2">
                <HardDrive className="h-4 w-4" />
                <span>Tier 2: Medium Resolution (days)</span>
                <Badge variant="outline">1h, 1d</Badge>
              </Label>
              <Input
                id="tier2_days"
                type="number"
                min="180"
                max="3650"
                value={formData.tier2_days}
                onChange={(e) => handleInputChange('tier2_days', e.target.value)}
              />
              <p className="text-sm text-muted-foreground">
                Keep hourly and daily data for backtesting and analysis
              </p>
            </div>

            <Separator />

            <div className="space-y-2">
              <Label htmlFor="tier3_days" className="flex items-center space-x-2">
                <HardDrive className="h-4 w-4" />
                <span>Tier 3: Low Resolution (days)</span>
                <Badge variant="outline">1d</Badge>
              </Label>
              <Input
                id="tier3_days"
                type="number"
                min="365"
                max="36500"
                value={formData.tier3_days}
                onChange={(e) => handleInputChange('tier3_days', e.target.value)}
              />
              <p className="text-sm text-muted-foreground">
                Keep only daily data for long-term trend analysis
              </p>
            </div>

            <Separator />

            <div className="space-y-2">
              <Label htmlFor="cleanup_interval" className="flex items-center space-x-2">
                <Clock className="h-4 w-4" />
                <span>Cleanup Interval (hours)</span>
              </Label>
              <Input
                id="cleanup_interval"
                type="number"
                min="1"
                max="168"
                value={formData.cleanup_interval_hours}
                onChange={(e) => handleInputChange('cleanup_interval_hours', e.target.value)}
              />
              <p className="text-sm text-muted-foreground">
                How often the system automatically cleans up old data
              </p>
            </div>

            <Button
              onClick={handleSave}
              disabled={saving}
              className="w-full"
            >
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save Settings
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Storage Estimate */}
        <Card>
          <CardHeader>
            <CardTitle>Storage Estimate</CardTitle>
            <CardDescription>
              Estimated storage usage for 30 cryptocurrencies
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Tier 1 (Full Resolution)</span>
                <span className="text-sm text-muted-foreground">
                  {storage.tier1.toFixed(1)} GB
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Tier 2 (Medium Resolution)</span>
                <span className="text-sm text-muted-foreground">
                  {storage.tier2.toFixed(1)} GB
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Tier 3 (Low Resolution)</span>
                <span className="text-sm text-muted-foreground">
                  {storage.tier3.toFixed(1)} GB
                </span>
              </div>
              <Separator />
              <div className="flex justify-between items-center font-semibold">
                <span>Total Estimated Storage</span>
                <span>{storage.total.toFixed(1)} GB</span>
              </div>
            </div>

            <Alert>
              <Database className="h-4 w-4" />
              <AlertDescription>
                Your server has 120GB total storage. This configuration uses about{' '}
                {((storage.total / 120) * 100).toFixed(1)}% of available space.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
