import { useState } from "react";
import { Database, Cloud, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

interface DatabaseSettingsProps {
  onConfigSave: (config: any) => Promise<boolean>;
  currentConfig: any | null;
  isConnected: boolean;
}

export const DatabaseSettings = ({
  onConfigSave,
  currentConfig,
  isConnected,
}: DatabaseSettingsProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [dbType, setDbType] = useState<'mongodb' | 'firebase' | 'indexeddb'>(
    currentConfig?.type || 'indexeddb'
  );

  // MongoDB config
  const [mongoApiUrl, setMongoApiUrl] = useState(currentConfig?.config?.apiUrl || '');
  const [mongoApiKey, setMongoApiKey] = useState(currentConfig?.config?.apiKey || '');

  // Firebase config
  const [firebaseApiKey, setFirebaseApiKey] = useState(currentConfig?.config?.apiKey || '');
  const [firebaseAuthDomain, setFirebaseAuthDomain] = useState(currentConfig?.config?.authDomain || '');
  const [firebaseProjectId, setFirebaseProjectId] = useState(currentConfig?.config?.projectId || '');

  const handleSave = async () => {
    let config: any;

    switch (dbType) {
      case 'mongodb':
        if (!mongoApiUrl || !mongoApiKey) {
          toast.error('Please fill in all MongoDB fields');
          return;
        }
        config = {
          type: 'mongodb',
          config: {
            apiUrl: mongoApiUrl.trim(),
            apiKey: mongoApiKey.trim(),
          },
        };
        break;

      case 'firebase':
        if (!firebaseApiKey || !firebaseAuthDomain || !firebaseProjectId) {
          toast.error('Please fill in all Firebase fields');
          return;
        }
        config = {
          type: 'firebase',
          config: {
            apiKey: firebaseApiKey.trim(),
            authDomain: firebaseAuthDomain.trim(),
            projectId: firebaseProjectId.trim(),
          },
        };
        break;

      case 'indexeddb':
        config = {
          type: 'indexeddb',
          config: {},
        };
        break;

      default:
        toast.error('Invalid database type');
        return;
    }

    const success = await onConfigSave(config);
    if (success) {
      toast.success('Database configuration saved and connected');
      setIsOpen(false);
    } else {
      toast.error('Failed to connect to database. Check your credentials.');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Cloud className="w-4 h-4" />
          Database Sync
          {isConnected && <Badge variant="default" className="ml-2 text-xs">Connected</Badge>}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Database Sync Configuration</DialogTitle>
          <DialogDescription>
            Enable cross-device sync by connecting to a cloud database
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 pt-4">
          <div className="space-y-2">
            <Label htmlFor="db-type">Database Type</Label>
            <Select value={dbType} onValueChange={(value: any) => setDbType(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="indexeddb">
                  <div className="flex items-center gap-2">
                    <Database className="w-4 h-4" />
                    IndexedDB (Local Only)
                  </div>
                </SelectItem>
                <SelectItem value="mongodb">
                  <div className="flex items-center gap-2">
                    <Database className="w-4 h-4" />
                    MongoDB Atlas/Compass
                  </div>
                </SelectItem>
                <SelectItem value="firebase">
                  <div className="flex items-center gap-2">
                    <Database className="w-4 h-4" />
                    Firebase Firestore
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Separator />

          {dbType === 'indexeddb' && (
            <div className="bg-muted/50 rounded-lg p-4">
              <p className="text-sm text-muted-foreground">
                IndexedDB stores data locally in your browser. No configuration needed.
                Data will not sync across devices.
              </p>
            </div>
          )}

          {dbType === 'mongodb' && (
            <div className="space-y-4">
              <div className="bg-muted/50 rounded-lg p-4 text-sm text-muted-foreground">
                <p className="font-medium mb-2">MongoDB Setup:</p>
                <ol className="list-decimal list-inside space-y-1">
                  <li>Create a MongoDB Atlas cluster or use MongoDB Compass</li>
                  <li>Set up a backend API endpoint that accepts vault data</li>
                  <li>Enter your API URL and authentication key below</li>
                </ol>
              </div>

              <div className="space-y-2">
                <Label htmlFor="mongo-api-url">API URL</Label>
                <Input
                  id="mongo-api-url"
                  type="url"
                  placeholder="https://your-api.com/api"
                  value={mongoApiUrl}
                  onChange={(e) => setMongoApiUrl(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="mongo-api-key">API Key</Label>
                <Input
                  id="mongo-api-key"
                  type="password"
                  placeholder="Your API authentication key"
                  value={mongoApiKey}
                  onChange={(e) => setMongoApiKey(e.target.value)}
                />
              </div>
            </div>
          )}

          {dbType === 'firebase' && (
            <div className="space-y-4">
              <div className="bg-muted/50 rounded-lg p-4 text-sm text-muted-foreground">
                <p className="font-medium mb-2">Firebase Setup:</p>
                <ol className="list-decimal list-inside space-y-1">
                  <li>Create a Firebase project at console.firebase.google.com</li>
                  <li>Enable Firestore Database</li>
                  <li>Get your web app config from Project Settings</li>
                  <li>Enter your Firebase credentials below</li>
                </ol>
              </div>

              <div className="space-y-2">
                <Label htmlFor="firebase-api-key">API Key</Label>
                <Input
                  id="firebase-api-key"
                  type="password"
                  placeholder="AIzaSy..."
                  value={firebaseApiKey}
                  onChange={(e) => setFirebaseApiKey(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="firebase-auth-domain">Auth Domain</Label>
                <Input
                  id="firebase-auth-domain"
                  placeholder="your-project.firebaseapp.com"
                  value={firebaseAuthDomain}
                  onChange={(e) => setFirebaseAuthDomain(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="firebase-project-id">Project ID</Label>
                <Input
                  id="firebase-project-id"
                  placeholder="your-project-id"
                  value={firebaseProjectId}
                  onChange={(e) => setFirebaseProjectId(e.target.value)}
                />
              </div>
            </div>
          )}

          <div className="flex justify-between items-center pt-4">
            <div className="text-sm">
              {isConnected ? (
                <Badge variant="default">Connected to {currentConfig?.type}</Badge>
              ) : (
                <Badge variant="outline">Not connected</Badge>
              )}
            </div>
            <Button onClick={handleSave}>
              Save & Connect
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
