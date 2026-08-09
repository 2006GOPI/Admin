import { useState, useEffect, useCallback } from 'react';
import {
  Database, Trash, Trash2, Eye, RefreshCw, AlertTriangle, ChevronRight, ArrowLeft, Search, Layers, FileText
} from 'lucide-react';
import { db, collection, getDocs, doc, deleteDoc, writeBatch } from '../firebase';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { Modal } from './ui/Modal';
import { useToastHelpers } from './ui/Toast';

const ALL_COLLECTION_NAMES = [
  'courses',
  'internships',
  'users',
  'notifications',
  'certificates',
  'internship_domains',
  'coding_challenges',
  'dashboard_stats',
  'discount_tiers',
  'enrollments',
  'feedback_forms',
  'internship_applications',
  'internship_enrollments',
  'leaderboard',
  'payments',
  'points_transactions',
  'quiz_attempts',
  'quizzes',
  'referrals',
  'reviews',
  'lessons',
  'modules',
];

interface CollectionInfo {
  name: string;
  count: number;
  loading: boolean;
}

interface DocumentItem {
  id: string;
  data: Record<string, any>;
}

interface DbManagerModalProps {
  onClose: () => void;
  onRefreshParent?: () => void;
}

export const DbManagerModal = ({ onClose, onRefreshParent }: DbManagerModalProps) => {
  const { success, error: toastError } = useToastHelpers();
  const [collections, setCollections] = useState<CollectionInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  // Drill-down document view state
  const [selectedCol, setSelectedCol] = useState<string | null>(null);
  const [docsList, setDocsList] = useState<DocumentItem[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [confirmDeleteCol, setConfirmDeleteCol] = useState<string | null>(null);
  const [confirmPurgeAll, setConfirmPurgeAll] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Load document counts for all collections
  const loadCollectionCounts = useCallback(async () => {
    setLoading(true);
    try {
      const results: CollectionInfo[] = await Promise.all(
        ALL_COLLECTION_NAMES.map(async (name) => {
          try {
            const snap = await getDocs(collection(db, name));
            return { name, count: snap.size, loading: false };
          } catch (err) {
            return { name, count: 0, loading: false };
          }
        })
      );
      setCollections(results);
    } catch (err) {
      console.error('Error loading collections:', err);
      toastError('Error', 'Failed to inspect Firestore collections');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCollectionCounts();
  }, [loadCollectionCounts]);

  // Load documents inside a specific collection
  const loadDocumentsInCollection = async (colName: string) => {
    setSelectedCol(colName);
    setLoadingDocs(true);
    try {
      const snap = await getDocs(collection(db, colName));
      const items: DocumentItem[] = snap.docs.map((d) => ({
        id: d.id,
        data: d.data(),
      }));
      setDocsList(items);
    } catch (err) {
      console.error(`Error loading docs for ${colName}:`, err);
      toastError('Error', `Failed to load documents for ${colName}`);
    } finally {
      setLoadingDocs(false);
    }
  };

  // Delete single document
  const handleDeleteDocument = async (colName: string, docId: string) => {
    try {
      await deleteDoc(doc(db, colName, docId));
      setDocsList((prev) => prev.filter((d) => d.id !== docId));
      setCollections((prev) =>
        prev.map((c) => (c.name === colName ? { ...c, count: Math.max(0, c.count - 1) } : c))
      );
      success('Document Deleted', `Deleted "${docId}" from collection "${colName}".`);
      if (onRefreshParent) onRefreshParent();
    } catch (err: any) {
      toastError('Delete Error', err.message || 'Failed to delete document');
    }
  };

  // Delete entire collection
  const handleDeleteCollection = async (colName: string) => {
    setDeleting(true);
    try {
      const snap = await getDocs(collection(db, colName));
      if (!snap.empty) {
        const docs = snap.docs;
        for (let i = 0; i < docs.length; i += 450) {
          const batch = writeBatch(db);
          const chunk = docs.slice(i, i + 450);
          chunk.forEach((d) => batch.delete(d.ref));
          await batch.commit();
        }
      }
      setCollections((prev) =>
        prev.map((c) => (c.name === colName ? { ...c, count: 0 } : c))
      );
      if (selectedCol === colName) setDocsList([]);
      setConfirmDeleteCol(null);
      success('Collection Cleared', `Deleted all documents in collection "${colName}".`);
      if (onRefreshParent) onRefreshParent();
    } catch (err: any) {
      toastError('Error', err.message || `Failed to clear collection ${colName}`);
    } finally {
      setDeleting(false);
    }
  };

  // Purge ALL collections
  const handlePurgeAll = async () => {
    setDeleting(true);
    try {
      for (const colName of ALL_COLLECTION_NAMES) {
        const snap = await getDocs(collection(db, colName));
        if (!snap.empty) {
          const docs = snap.docs;
          for (let i = 0; i < docs.length; i += 450) {
            const batch = writeBatch(db);
            const chunk = docs.slice(i, i + 450);
            chunk.forEach((d) => batch.delete(d.ref));
            await batch.commit();
          }
        }
      }
      setCollections((prev) => prev.map((c) => ({ ...c, count: 0 })));
      setDocsList([]);
      setSelectedCol(null);
      setConfirmPurgeAll(false);
      success('Database Purged', 'All Firestore collections have been completely cleared.');
      if (onRefreshParent) onRefreshParent();
    } catch (err: any) {
      toastError('Purge Error', err.message || 'Failed to purge all database collections');
    } finally {
      setDeleting(false);
    }
  };

  const filteredCollections = collections.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  const totalDocCount = collections.reduce((acc, c) => acc + c.count, 0);

  return (
    <Modal onClose={onClose} title="Firestore Database Manager" size="xl">
      <div className="space-y-6">
        {/* Header Action Strip */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 bg-surface-container border border-outline-variant/30">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-primary/10 flex items-center justify-center shrink-0">
              <Database className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-on-surface">Firestore Collections ({collections.length})</p>
              <p className="text-xs text-on-surface-variant">
                Total Documents across DB: <strong className="text-primary">{totalDocCount}</strong>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              icon={<RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />}
              onClick={loadCollectionCounts}
            >
              Refresh
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={<Trash2 className="h-4 w-4" />}
              className="bg-error text-white hover:bg-red-700 border-none"
              onClick={() => setConfirmPurgeAll(true)}
            >
              Purge ALL Collections
            </Button>
          </div>
        </div>

        {/* VIEW 1: Document detail view inside a selected collection */}
        {selectedCol ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <button
                onClick={() => setSelectedCol(null)}
                className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Collections List
              </button>
              <div className="flex items-center gap-2">
                <Badge variant="primary" size="lg">
                  Collection: {selectedCol}
                </Badge>
                <Button
                  variant="outline"
                  size="sm"
                  icon={<Trash className="h-3.5 w-3.5 text-error" />}
                  className="text-error border-error/30 hover:bg-error/10"
                  onClick={() => setConfirmDeleteCol(selectedCol)}
                >
                  Clear Collection
                </Button>
              </div>
            </div>

            {loadingDocs ? (
              <div className="py-12 text-center text-on-surface-variant">Loading documents...</div>
            ) : docsList.length === 0 ? (
              <div className="py-12 text-center text-on-surface-variant border border-dashed border-outline-variant/40 p-6">
                <FileText className="h-10 w-10 text-on-surface-variant/40 mx-auto mb-2" />
                <p className="font-semibold text-on-surface">No documents in "{selectedCol}"</p>
                <p className="text-xs text-on-surface-variant mt-1">This collection is completely empty.</p>
              </div>
            ) : (
              <div className="border border-outline-variant/30 overflow-hidden">
                <div className="bg-surface-container px-4 py-2 text-xs font-bold text-on-surface-variant uppercase tracking-wider flex justify-between">
                  <span>Document ID & Content Preview ({docsList.length})</span>
                  <span>Action</span>
                </div>
                <div className="divide-y divide-outline-variant/20 max-h-[400px] overflow-y-auto">
                  {docsList.map((docItem) => (
                    <div key={docItem.id} className="p-3 hover:bg-surface-container/50 flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" size="sm" className="font-mono text-xs">
                            {docItem.id}
                          </Badge>
                        </div>
                        <pre className="mt-1 text-xs text-on-surface-variant font-mono bg-surface-container p-2 rounded overflow-x-auto max-h-24">
                          {JSON.stringify(docItem.data, null, 2)}
                        </pre>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={<Trash className="h-4 w-4" />}
                        className="text-error hover:bg-error/10 shrink-0"
                        onClick={() => handleDeleteDocument(selectedCol, docItem.id)}
                      >
                        Delete Doc
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* VIEW 2: List of all collections */
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-on-surface-variant/50" />
              <input
                type="text"
                placeholder="Search collection name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="input pl-9"
              />
            </div>

            <div className="border border-outline-variant/30 overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="bg-surface-container border-b border-outline-variant/30 text-on-surface-variant">
                    <th className="p-3 font-semibold">Collection Name</th>
                    <th className="p-3 font-semibold">Doc Count</th>
                    <th className="p-3 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/20">
                  {filteredCollections.map((colItem) => (
                    <tr key={colItem.name} className="hover:bg-surface-container/50">
                      <td className="p-3">
                        <div className="flex items-center gap-2 font-mono font-medium text-on-surface">
                          <Layers className="h-4 w-4 text-primary" />
                          {colItem.name}
                        </div>
                      </td>
                      <td className="p-3">
                        <Badge variant={colItem.count > 0 ? 'warning' : 'outline'}>
                          {colItem.count} docs
                        </Badge>
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            icon={<Eye className="h-3.5 w-3.5" />}
                            onClick={() => loadDocumentsInCollection(colItem.name)}
                          >
                            View Docs
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            icon={<Trash className="h-3.5 w-3.5" />}
                            className="text-error hover:bg-error/10"
                            disabled={colItem.count === 0}
                            onClick={() => setConfirmDeleteCol(colItem.name)}
                          >
                            Clear Collection
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredCollections.length === 0 && (
                    <tr>
                      <td colSpan={3} className="p-8 text-center text-on-surface-variant">
                        No collections found matching "{search}"
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Confirmation Modal for Clearing 1 Collection */}
        {confirmDeleteCol && (
          <Modal onClose={() => setConfirmDeleteCol(null)} title={`Delete Collection "${confirmDeleteCol}"?`} size="sm">
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 bg-error/5 border border-error/30">
                <AlertTriangle className="h-6 w-6 text-error shrink-0" />
                <div>
                  <p className="font-semibold text-on-surface">Confirm Collection Wipe</p>
                  <p className="text-xs text-on-surface-variant mt-1">
                    Delete ALL documents inside collection <strong>"{confirmDeleteCol}"</strong>? This action cannot be undone.
                  </p>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setConfirmDeleteCol(null)}>Cancel</Button>
                <Button
                  variant="primary"
                  className="bg-error text-white hover:bg-red-700"
                  disabled={deleting}
                  onClick={() => handleDeleteCollection(confirmDeleteCol)}
                >
                  {deleting ? 'Deleting...' : 'Delete Collection'}
                </Button>
              </div>
            </div>
          </Modal>
        )}

        {/* Confirmation Modal for Purging ALL Collections */}
        {confirmPurgeAll && (
          <Modal onClose={() => setConfirmPurgeAll(false)} title="PURGE Entire Firestore Database?" size="sm">
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 bg-error/10 border border-error/40">
                <AlertTriangle className="h-8 w-8 text-error shrink-0" />
                <div>
                  <p className="font-bold text-error">CRITICAL WARNING</p>
                  <p className="text-xs text-on-surface-variant mt-1">
                    This will permanently delete <strong>ALL documents across ALL {collections.length} Firestore collections</strong>. Every single course, user, internship, notification, and certificate will be wiped.
                  </p>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setConfirmPurgeAll(false)}>Cancel</Button>
                <Button
                  variant="primary"
                  className="bg-error text-white hover:bg-red-700 font-bold"
                  disabled={deleting}
                  onClick={handlePurgeAll}
                >
                  {deleting ? 'Purging All DB...' : 'YES, WIPE ENTIRE DATABASE'}
                </Button>
              </div>
            </div>
          </Modal>
        )}
      </div>
    </Modal>
  );
};

export default DbManagerModal;
