import React, { useState, useEffect, useMemo } from 'react';
import {
  CreditCard,
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  Filter,
  Download,
  Plus,
  ArrowUpRight,
  Eye,
  RefreshCw,
  AlertCircle,
  FileText,
  DollarSign,
  ShieldCheck,
  Building2,
  QrCode,
  BookOpen,
  GraduationCap,
  ExternalLink,
  CornerUpLeft,
  Check,
  X,
  Database
} from 'lucide-react';
import { db, collection, getDocs, doc, setDoc, updateDoc, addDoc } from './firebase';
import type { PaymentTransaction, PaymentStatus, PaymentMethod, PaymentItemType, AdminPermissions } from './types';

interface PaymentsManagerProps {
  permissions?: AdminPermissions;
}

export const PaymentsManager: React.FC<PaymentsManagerProps> = () => {
  const [payments, setPayments] = useState<PaymentTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<PaymentStatus | 'all'>('all');
  const [methodFilter, setMethodFilter] = useState<PaymentMethod | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState<PaymentItemType | 'all'>('all');

  // Modals
  const [selectedPayment, setSelectedPayment] = useState<PaymentTransaction | null>(null);
  const [verifyModalOpen, setVerifyModalOpen] = useState(false);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [manualPayModalOpen, setManualPayModalOpen] = useState(false);
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);

  // Form State for Manual Offline Payment
  const [manualForm, setManualForm] = useState({
    userName: '',
    userEmail: '',
    userPhone: '',
    itemTitle: '',
    itemType: 'course' as PaymentItemType,
    amount: '',
    paymentMethod: 'upi_qr' as PaymentMethod,
    utrNumber: '',
    notes: '',
  });

  // Helper to remove undefined or null values before sending to Firestore
  const cleanDocData = <T extends Record<string, any>>(obj: T): T => {
    const cleaned: Record<string, any> = {};
    Object.keys(obj).forEach((key) => {
      if (obj[key] !== undefined && obj[key] !== null && obj[key] !== '') {
        cleaned[key] = obj[key];
      }
    });
    return cleaned as T;
  };

  // Fetch Live Payments from Firestore DB (with Local Cache Fallback)
  const fetchPayments = async () => {
    setLoading(true);
    try {
      let fetched: PaymentTransaction[] = [];
      try {
        const snap = await getDocs(collection(db, 'payments'));
        if (!snap.empty) {
          fetched = snap.docs.map(docSnap => ({
            id: docSnap.id,
            ...docSnap.data()
          })) as PaymentTransaction[];
        }
      } catch (fsErr) {
        console.warn('Firestore fetch failed, checking local cache:', fsErr);
      }

      // Merge with local storage fallback payments
      const localStr = localStorage.getItem('a2z_local_payments');
      if (localStr) {
        try {
          const localItems: PaymentTransaction[] = JSON.parse(localStr);
          const existingIds = new Set(fetched.map(p => p.id));
          localItems.forEach(item => {
            if (!existingIds.has(item.id)) {
              fetched.push(item);
            }
          });
        } catch (e) {
          console.error('Error reading local payments:', e);
        }
      }

      fetched.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setPayments(fetched);
    } catch (err) {
      console.error('Error in fetchPayments:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, []);

  // KPI Calculations from Live Data
  const stats = useMemo(() => {
    const completed = payments.filter(p => p.status === 'completed' || p.status === 'verified');
    const pending = payments.filter(p => p.status === 'pending');
    const rejected = payments.filter(p => p.status === 'rejected' || p.status === 'failed');
    const refunded = payments.filter(p => p.status === 'refunded');

    const totalRevenue = completed.reduce((sum, p) => sum + (p.amount || 0), 0);
    const pendingAmount = pending.reduce((sum, p) => sum + (p.amount || 0), 0);

    return {
      totalRevenue,
      pendingCount: pending.length,
      pendingAmount,
      completedCount: completed.length,
      rejectedCount: rejected.length,
      refundedCount: refunded.length,
      totalCount: payments.length,
    };
  }, [payments]);

  // Filtered List from Live Data
  const filteredPayments = useMemo(() => {
    return payments.filter(p => {
      const queryLower = searchQuery.toLowerCase().trim();
      if (queryLower) {
        const matchesName = p.userName?.toLowerCase().includes(queryLower);
        const matchesEmail = p.userEmail?.toLowerCase().includes(queryLower);
        const matchesTxn = p.transactionId?.toLowerCase().includes(queryLower);
        const matchesUtr = p.utrNumber?.toLowerCase().includes(queryLower);
        const matchesTitle = p.itemTitle?.toLowerCase().includes(queryLower);
        if (!matchesName && !matchesEmail && !matchesTxn && !matchesUtr && !matchesTitle) {
          return false;
        }
      }

      if (statusFilter !== 'all' && p.status !== statusFilter) return false;
      if (methodFilter !== 'all' && p.paymentMethod !== methodFilter) return false;
      if (typeFilter !== 'all' && p.itemType !== typeFilter) return false;

      return true;
    });
  }, [payments, searchQuery, statusFilter, methodFilter, typeFilter]);

  // Handle Action: Verify & Approve Payment
  const handleApprovePayment = async (payment: PaymentTransaction) => {
    setSyncing(true);
    try {
      const nowStr = new Date().toISOString();
      const updatedData = cleanDocData({
        status: 'completed',
        verifiedBy: 'Admin Verification Desk',
        verifiedAt: nowStr,
        updatedAt: nowStr,
      });

      try {
        await updateDoc(doc(db, 'payments', payment.id), updatedData);
        const enrollmentId = `enr_${payment.userId}_${payment.itemId}`;
        await setDoc(doc(db, 'enrollments', enrollmentId), cleanDocData({
          id: enrollmentId,
          userId: payment.userId,
          userName: payment.userName,
          userEmail: payment.userEmail,
          courseId: payment.itemId,
          courseTitle: payment.itemTitle,
          paymentId: payment.id,
          amountPaid: payment.amount,
          enrolledAt: nowStr,
          status: 'active',
          progress: 0,
        }));
        await addDoc(collection(db, 'notifications'), cleanDocData({
          userId: payment.userId,
          type: 'payment_verified',
          title: 'Payment Verified & Enrolled!',
          message: `Your payment of ₹${payment.amount} for "${payment.itemTitle}" has been verified! You now have full access.`,
          read: false,
          createdAt: nowStr,
        }));
      } catch (fsErr) {
        console.warn('Firestore update failed, updating local state:', fsErr);
      }

      // Update in local state & cache
      setPayments(prev => prev.map(p => p.id === payment.id ? { ...p, status: 'completed', verifiedAt: nowStr } : p));
      
      setVerifyModalOpen(false);
      setSelectedPayment(null);
      alert(`Payment for ${payment.userName} approved & access granted!`);
    } catch (err: any) {
      console.error('Error approving payment:', err);
      alert(`Failed to approve payment: ${err?.message || 'Unknown error'}`);
    } finally {
      setSyncing(false);
    }
  };

  // Handle Action: Reject Payment
  const handleRejectPayment = async () => {
    if (!selectedPayment) return;
    if (!rejectionReason.trim()) {
      alert('Please provide a reason for rejection.');
      return;
    }

    setSyncing(true);
    try {
      const nowStr = new Date().toISOString();
      const updatedData = cleanDocData({
        status: 'rejected',
        rejectionReason: rejectionReason.trim(),
        verifiedBy: 'Admin Verification Desk',
        verifiedAt: nowStr,
        updatedAt: nowStr,
      });

      try {
        await updateDoc(doc(db, 'payments', selectedPayment.id), updatedData);
        await addDoc(collection(db, 'notifications'), cleanDocData({
          userId: selectedPayment.userId,
          type: 'payment_rejected',
          title: 'Payment Verification Action Required',
          message: `Your payment verification for "${selectedPayment.itemTitle}" was not approved. Reason: ${rejectionReason}`,
          read: false,
          createdAt: nowStr,
        }));
      } catch (fsErr) {
        console.warn('Firestore update failed, updating local state:', fsErr);
      }

      // Update local state
      setPayments(prev => prev.map(p => p.id === selectedPayment.id ? { ...p, status: 'rejected', rejectionReason: rejectionReason.trim() } : p));

      setRejectModalOpen(false);
      setRejectionReason('');
      setSelectedPayment(null);
      alert('Payment marked as rejected.');
    } catch (err: any) {
      console.error('Error rejecting payment:', err);
      alert(`Failed to reject payment: ${err?.message || 'Unknown error'}`);
    } finally {
      setSyncing(false);
    }
  };

  // Handle Action: Record Offline / Manual Payment into DB & Local Cache
  const handleCreateManualPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualForm.userName || !manualForm.userEmail || !manualForm.itemTitle || !manualForm.amount) {
      alert('Please fill out all required fields.');
      return;
    }

    setSyncing(true);
    try {
      const nowStr = new Date().toISOString();
      const newPayId = `pay_manual_${Date.now()}`;
      const utrClean = manualForm.utrNumber ? manualForm.utrNumber.trim() : '';
      
      // Construct raw payment object without undefined fields
      const rawPayment: Record<string, any> = {
        id: newPayId,
        transactionId: utrClean ? `UTR${utrClean}` : `MANUAL_${Date.now()}`,
        userId: `usr_off_${Date.now().toString().slice(-4)}`,
        userName: manualForm.userName.trim(),
        userEmail: manualForm.userEmail.trim(),
        itemId: `item_${Date.now()}`,
        itemTitle: manualForm.itemTitle.trim(),
        itemType: manualForm.itemType,
        amount: Number(manualForm.amount),
        currency: 'INR',
        paymentMethod: manualForm.paymentMethod,
        status: 'completed',
        notes: manualForm.notes.trim() || 'Recorded manually by Admin',
        verifiedBy: 'Admin Offline Desk',
        verifiedAt: nowStr,
        createdAt: nowStr,
      };

      if (utrClean) {
        rawPayment.utrNumber = utrClean;
      }
      if (manualForm.userPhone.trim()) {
        rawPayment.userPhone = manualForm.userPhone.trim();
      }

      const newPayment = cleanDocData(rawPayment) as PaymentTransaction;

      const enrollmentId = `enr_${newPayment.userId}_${newPayment.itemId}`;
      const enrollmentDoc = cleanDocData({
        id: enrollmentId,
        userId: newPayment.userId,
        userName: newPayment.userName,
        userEmail: newPayment.userEmail,
        courseId: newPayment.itemId,
        courseTitle: newPayment.itemTitle,
        paymentId: newPayment.id,
        amountPaid: newPayment.amount,
        enrolledAt: nowStr,
        status: 'active',
        progress: 0,
      });

      // Save to Firestore DB
      let firestoreSuccess = false;
      try {
        await setDoc(doc(db, 'payments', newPayId), newPayment);
        await setDoc(doc(db, 'enrollments', enrollmentId), enrollmentDoc);
        firestoreSuccess = true;
      } catch (fsErr) {
        console.warn('Firestore setDoc failed, persisting to local fallback:', fsErr);
      }

      // Always save to LocalStorage cache so record is never lost
      try {
        const localStr = localStorage.getItem('a2z_local_payments');
        const existing: PaymentTransaction[] = localStr ? JSON.parse(localStr) : [];
        existing.unshift(newPayment);
        localStorage.setItem('a2z_local_payments', JSON.stringify(existing));
      } catch (lsErr) {
        console.error('LocalStorage write error:', lsErr);
      }

      // Update in-memory state immediately so UI refreshes without relying solely on network fetch
      setPayments(prev => [newPayment, ...prev]);

      setManualPayModalOpen(false);
      setManualForm({
        userName: '',
        userEmail: '',
        userPhone: '',
        itemTitle: '',
        itemType: 'course',
        amount: '',
        paymentMethod: 'upi_qr',
        utrNumber: '',
        notes: '',
      });

      if (firestoreSuccess) {
        alert('Manual payment saved to Firestore DB & access activated!');
      } else {
        alert('Payment saved locally & course access activated! (DB offline fallback active)');
      }
    } catch (err: any) {
      console.error('Error saving manual payment:', err);
      alert(`Failed to save payment: ${err?.message || 'Unknown error'}`);
    } finally {
      setSyncing(false);
    }
  };

  // Export filtered data to CSV
  const handleExportCSV = () => {
    if (!filteredPayments.length) {
      alert('No records to export.');
      return;
    }

    const headers = ['Transaction ID', 'UTR Number', 'Student Name', 'Email', 'Phone', 'Item Title', 'Type', 'Amount (INR)', 'Payment Method', 'Status', 'Date'];
    const rows = filteredPayments.map(p => [
      `"${p.transactionId}"`,
      `"${p.utrNumber || '-'}"`,
      `"${p.userName}"`,
      `"${p.userEmail}"`,
      `"${p.userPhone || '-'}"`,
      `"${p.itemTitle.replace(/"/g, '""')}"`,
      `"${p.itemType}"`,
      p.amount,
      `"${p.paymentMethod}"`,
      `"${p.status}"`,
      `"${new Date(p.createdAt).toLocaleString()}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `payments_export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Status Badge Component with Guaranteed Single Line Layout & High Contrast
  const renderStatusBadge = (status: PaymentStatus) => {
    switch (status) {
      case 'completed':
      case 'verified':
        return (
          <span
            style={{
              backgroundColor: '#d1fae5',
              color: '#065f46',
              border: '1px solid #a7f3d0',
              padding: '6px 12px',
              borderRadius: '8px',
              whiteSpace: 'nowrap',
              fontWeight: 800,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '12px'
            }}
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            Verified & Access Granted
          </span>
        );
      case 'pending':
        return (
          <span
            style={{
              backgroundColor: '#fef3c7',
              color: '#78350f',
              border: '1px solid #fde68a',
              padding: '6px 12px',
              borderRadius: '8px',
              whiteSpace: 'nowrap',
              fontWeight: 800,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '12px'
            }}
          >
            <Clock className="w-3.5 h-3.5 text-amber-700 animate-spin shrink-0" />
            Needs Verification
          </span>
        );
      case 'rejected':
      case 'failed':
        return (
          <span
            style={{
              backgroundColor: '#ffe4e6',
              color: '#881337',
              border: '1px solid #fecdd3',
              padding: '6px 12px',
              borderRadius: '8px',
              whiteSpace: 'nowrap',
              fontWeight: 800,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '12px'
            }}
          >
            <XCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
            Rejected
          </span>
        );
      case 'refunded':
        return (
          <span
            style={{
              backgroundColor: '#f3e8ff',
              color: '#581c87',
              border: '1px solid #e9d5ff',
              padding: '6px 12px',
              borderRadius: '8px',
              whiteSpace: 'nowrap',
              fontWeight: 800,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '12px'
            }}
          >
            <CornerUpLeft className="w-3.5 h-3.5 text-purple-600 shrink-0" />
            Refunded
          </span>
        );
      default:
        return <span className="text-xs text-slate-700 font-bold">{status}</span>;
    }
  };

  // Payment Method Badge
  const renderMethodBadge = (method: PaymentMethod) => {
    switch (method) {
      case 'upi_qr':
        return (
          <span className="inline-flex items-center gap-1 text-xs font-extrabold text-cyan-950 bg-cyan-100 px-2.5 py-1 rounded border border-cyan-300">
            <QrCode className="w-3.5 h-3.5 text-cyan-700 shrink-0" /> UPI / QR Proof
          </span>
        );
      case 'razorpay':
        return (
          <span className="inline-flex items-center gap-1 text-xs font-extrabold text-blue-950 bg-blue-100 px-2.5 py-1 rounded border border-blue-300">
            <CreditCard className="w-3.5 h-3.5 text-blue-700 shrink-0" /> Razorpay
          </span>
        );
      case 'bank_transfer':
        return (
          <span className="inline-flex items-center gap-1 text-xs font-extrabold text-purple-950 bg-purple-100 px-2.5 py-1 rounded border border-purple-300">
            <Building2 className="w-3.5 h-3.5 text-purple-700 shrink-0" /> Bank NEFT/IMPS
          </span>
        );
      case 'card':
        return (
          <span className="inline-flex items-center gap-1 text-xs font-extrabold text-indigo-950 bg-indigo-100 px-2.5 py-1 rounded border border-indigo-300">
            <CreditCard className="w-3.5 h-3.5 text-indigo-700 shrink-0" /> Card Gateway
          </span>
        );
      case 'cash':
        return (
          <span className="inline-flex items-center gap-1 text-xs font-extrabold text-emerald-950 bg-emerald-100 px-2.5 py-1 rounded border border-emerald-300">
            <DollarSign className="w-3.5 h-3.5 text-emerald-700 shrink-0" /> Direct Cash
          </span>
        );
      default:
        return <span className="text-xs text-slate-800 font-bold capitalize">{method}</span>;
    }
  };

  return (
    <div className="space-y-6 w-full text-slate-900">
      {/* Top Header Card with Square Green Icon & Solid Buttons */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
        <div className="flex items-center gap-4">
          <div
            style={{
              width: '52px',
              height: '52px',
              backgroundColor: '#d1fae5',
              border: '1px solid #a7f3d0',
              borderRadius: '14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            <CreditCard className="w-7 h-7 text-emerald-800" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Payments & UTR Verification</h1>
            <p className="text-sm font-semibold text-slate-600 mt-0.5">Real-time payment tracking, UTR verification queue, and automated course access</p>
          </div>
        </div>

        {/* Header Buttons with Explicit Colors */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={fetchPayments}
            disabled={loading}
            style={{
              height: '48px',
              backgroundColor: '#f1f5f9',
              color: '#0f172a',
              border: '1px solid #cbd5e1',
              borderRadius: '12px',
              padding: '0 24px',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              whiteSpace: 'nowrap',
              minWidth: '140px'
            }}
          >
            <RefreshCw className={`w-4 h-4 text-emerald-700 ${loading ? 'animate-spin' : ''}`} />
            Refresh DB
          </button>

          <button
            onClick={handleExportCSV}
            style={{
              height: '48px',
              backgroundColor: '#f1f5f9',
              color: '#0f172a',
              border: '1px solid #cbd5e1',
              borderRadius: '12px',
              padding: '0 24px',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              whiteSpace: 'nowrap',
              minWidth: '140px'
            }}
          >
            <Download className="w-4 h-4 text-emerald-700" />
            Export CSV
          </button>

          <button
            onClick={() => setManualPayModalOpen(true)}
            style={{
              height: '48px',
              backgroundColor: '#059669',
              color: '#ffffff',
              border: '1px solid #047857',
              borderRadius: '12px',
              padding: '0 32px',
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              boxShadow: '0 4px 12px rgba(5,150,105,0.25)',
              whiteSpace: 'nowrap',
              minWidth: '190px'
            }}
          >
            <Plus className="w-5 h-5 stroke-[3]" />
            Record Payment
          </button>
        </div>
      </div>

      {/* Pending Verification Banner */}
      {stats.pendingCount > 0 && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 bg-amber-50 border border-amber-300 rounded-2xl text-amber-950 shadow-sm">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 flex items-center justify-center bg-amber-200 text-amber-950 rounded-xl shrink-0">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div>
              <p className="font-black text-base text-amber-950">
                {stats.pendingCount} Pending Payment Verification{stats.pendingCount > 1 ? 's' : ''} Awaiting Action
              </p>
              <p className="text-xs text-amber-900 font-bold">
                Total value: <span className="font-black text-amber-950">₹{stats.pendingAmount.toLocaleString()}</span>. Verify UTR reference numbers to grant course access.
              </p>
            </div>
          </div>
          <button
            onClick={() => setStatusFilter('pending')}
            style={{ height: '42px', backgroundColor: '#d97706', color: '#ffffff' }}
            className="px-5 font-black text-xs rounded-xl shadow-sm shrink-0 flex items-center justify-center"
          >
            Filter Pending Queue
          </button>
        </div>
      )}

      {/* KPI Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Verified Gross Revenue */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between" style={{ minHeight: '135px' }}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-slate-500 uppercase tracking-wider">Total Verified Revenue</span>
            <div className="w-10 h-10 flex items-center justify-center bg-emerald-100 text-emerald-800 rounded-xl">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-3xl font-black text-slate-900">₹{stats.totalRevenue.toLocaleString()}</h3>
            <p className="text-xs text-emerald-800 font-extrabold mt-1 flex items-center gap-1">
              <ArrowUpRight className="w-4 h-4" /> {stats.completedCount} verified payments
            </p>
          </div>
        </div>

        {/* Pending Approval Desk */}
        <div
          onClick={() => setStatusFilter('pending')}
          className="bg-amber-50/90 p-5 rounded-2xl border border-amber-300 shadow-sm flex flex-col justify-between cursor-pointer hover:border-amber-400 transition-all"
          style={{ minHeight: '135px' }}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-amber-900 uppercase tracking-wider">Pending Verification</span>
            <div className="w-10 h-10 flex items-center justify-center bg-amber-200 text-amber-950 rounded-xl">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-3xl font-black text-amber-950">{stats.pendingCount} Pending</h3>
            <p className="text-xs text-amber-900 font-extrabold mt-1">₹{stats.pendingAmount.toLocaleString()} awaiting approval</p>
          </div>
        </div>

        {/* Completed Payments */}
        <div
          onClick={() => setStatusFilter('completed')}
          className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between cursor-pointer hover:border-slate-300 transition-all"
          style={{ minHeight: '135px' }}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-slate-500 uppercase tracking-wider">Completed Payments</span>
            <div className="w-10 h-10 flex items-center justify-center bg-blue-100 text-blue-800 rounded-xl">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-3xl font-black text-slate-900">{stats.completedCount}</h3>
            <p className="text-xs text-slate-600 font-extrabold mt-1">Enrollments active</p>
          </div>
        </div>

        {/* Rejected / Refunded */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between" style={{ minHeight: '135px' }}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-slate-500 uppercase tracking-wider">Rejected / Failed</span>
            <div className="w-10 h-10 flex items-center justify-center bg-rose-100 text-rose-800 rounded-xl">
              <XCircle className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-3xl font-black text-slate-900">{stats.rejectedCount}</h3>
            <p className="text-xs text-rose-800 font-extrabold mt-1">{stats.refundedCount} refunded records</p>
          </div>
        </div>
      </div>

      {/* Toolbar: Search & Tab Buttons with Explicit Inline Styles */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="relative w-full md:w-[450px]">
            <Search className="w-5 h-5 absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none z-10" />
            <input
              type="text"
              placeholder="Search student, UTR number, transaction ID, course..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ height: '48px', paddingLeft: '54px' }}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-600 focus:bg-white shadow-sm"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Filter Tabs with Guaranteed High-Contrast Rectangular Styling */}
          <div className="flex items-center gap-1.5 bg-slate-100 p-1.5 rounded-xl border border-slate-200 w-full md:w-auto overflow-x-auto">
            {(['all', 'pending', 'completed', 'rejected', 'refunded'] as const).map((st) => {
              const isActive = statusFilter === st;
              return (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  style={{
                    height: '38px',
                    padding: '0 16px',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: 800,
                    whiteSpace: 'nowrap',
                    backgroundColor: isActive ? '#0f172a' : '#f1f5f9',
                    color: isActive ? '#ffffff' : '#334155',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  {st === 'pending' ? `Pending (${stats.pendingCount})` : st}
                </button>
              );
            })}
          </div>
        </div>

        {/* Dropdown Filters row */}
        <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-slate-200 text-xs">
          <div className="flex items-center gap-1.5 text-slate-700 font-extrabold">
            <Filter className="w-4 h-4 text-emerald-600" />
            <span>Filters:</span>
          </div>

          <select
            value={methodFilter}
            onChange={(e) => setMethodFilter(e.target.value as any)}
            style={{ height: '44px' }}
            className="bg-white text-slate-900 font-bold border border-slate-300 rounded-xl px-4 focus:outline-none focus:border-emerald-600 shadow-sm"
          >
            <option value="all">All Payment Methods</option>
            <option value="upi_qr">UPI / QR Code</option>
            <option value="razorpay">Razorpay Gateway</option>
            <option value="bank_transfer">Bank Transfer (NEFT/IMPS)</option>
            <option value="card">Credit / Debit Card</option>
            <option value="cash">Offline Cash</option>
          </select>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as any)}
            style={{ height: '44px' }}
            className="bg-white text-slate-900 font-bold border border-slate-300 rounded-xl px-4 focus:outline-none focus:border-emerald-600 shadow-sm"
          >
            <option value="all">All Item Types</option>
            <option value="course">Courses Only</option>
            <option value="internship">Internships Only</option>
            <option value="bundle">Bundles</option>
          </select>

          {(statusFilter !== 'all' || methodFilter !== 'all' || typeFilter !== 'all' || searchQuery) && (
            <button
              onClick={() => {
                setStatusFilter('all');
                setMethodFilter('all');
                setTypeFilter('all');
                setSearchQuery('');
              }}
              className="text-xs text-emerald-800 hover:underline font-black ml-auto"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Main Transactions Table Container */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="text-center py-16 text-slate-600 font-bold">
            <RefreshCw className="w-7 h-7 animate-spin mx-auto mb-3 text-emerald-600" />
            Loading Firestore payments collection...
          </div>
        ) : filteredPayments.length === 0 ? (
          <div className="text-center py-16 px-6 space-y-4">
            <div className="w-16 h-16 bg-slate-100 text-slate-500 rounded-2xl mx-auto flex items-center justify-center border border-slate-200">
              <Database className="w-8 h-8 text-slate-600" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900">No Payments Recorded in Database</h3>
              <p className="text-xs font-semibold text-slate-600 max-w-md mx-auto mt-1">
                Your Firestore <code className="text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded font-mono">payments</code> collection has no records matching your criteria.
              </p>
            </div>
            <div className="flex items-center justify-center pt-2">
              <button
                onClick={() => setManualPayModalOpen(true)}
                style={{
                  height: '48px',
                  backgroundColor: '#059669',
                  color: '#ffffff',
                  padding: '0 32px',
                  whiteSpace: 'nowrap',
                  minWidth: '220px'
                }}
                className="font-black text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4 stroke-[3]" /> Record First Payment
              </button>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-900">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500 border-b border-slate-200 font-black tracking-wider">
                <tr>
                  <th className="py-4 px-6 h-14">Transaction / UTR</th>
                  <th className="py-4 px-6 h-14">Student Details</th>
                  <th className="py-4 px-6 h-14">Purchased Item</th>
                  <th className="py-4 px-6 h-14">Method & Amount</th>
                  <th className="py-4 px-6 h-14">Status</th>
                  <th className="py-4 px-6 h-14">Date</th>
                  <th className="py-4 px-6 h-14 text-right">Actions</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {filteredPayments.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                    {/* Txn ID / UTR */}
                    <td className="py-5 px-6 font-mono text-xs">
                      <div className="font-black text-slate-900 text-sm">{p.transactionId}</div>
                      {p.utrNumber && (
                        <div className="text-xs text-cyan-950 font-black mt-1">
                          UTR: {p.utrNumber}
                        </div>
                      )}
                    </td>

                    {/* Student Info */}
                    <td className="py-5 px-6">
                      <div className="font-black text-slate-900 text-sm">{p.userName}</div>
                      <div className="text-xs text-slate-600 font-bold">{p.userEmail}</div>
                      {p.userPhone && <div className="text-xs text-slate-500 font-bold mt-0.5">{p.userPhone}</div>}
                    </td>

                    {/* Purchased Item */}
                    <td className="py-5 px-6 max-w-xs">
                      <div className="flex items-center gap-2">
                        {p.itemType === 'course' ? (
                          <BookOpen className="w-4 h-4 text-emerald-600 shrink-0" />
                        ) : (
                          <GraduationCap className="w-4 h-4 text-purple-600 shrink-0" />
                        )}
                        <span className="font-black text-slate-900 truncate" title={p.itemTitle}>
                          {p.itemTitle}
                        </span>
                      </div>
                      {p.couponCode && (
                        <span className="inline-block mt-1 text-[10px] bg-emerald-100 text-emerald-950 font-black px-2 py-0.5 rounded border border-emerald-300">
                          Code: {p.couponCode} (-₹{p.discountAmount})
                        </span>
                      )}
                    </td>

                    {/* Amount & Method */}
                    <td className="py-5 px-6">
                      <div className="font-black text-slate-900 text-base">₹{p.amount?.toLocaleString()}</div>
                      <div className="mt-1">{renderMethodBadge(p.paymentMethod)}</div>
                    </td>

                    {/* Status Badge */}
                    <td className="py-5 px-6">
                      {renderStatusBadge(p.status)}
                      {p.rejectionReason && (
                        <p className="text-[11px] text-rose-900 font-black mt-1 max-w-xs truncate" title={p.rejectionReason}>
                          Reason: {p.rejectionReason}
                        </p>
                      )}
                    </td>

                    {/* Date */}
                    <td className="py-5 px-6 text-xs text-slate-600 font-bold whitespace-nowrap">
                      <div>{new Date(p.createdAt).toLocaleDateString()}</div>
                      <div className="text-[11px] text-slate-400 font-semibold">{new Date(p.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                    </td>

                    {/* Action Buttons */}
                    <td className="py-5 px-6 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {p.status === 'pending' ? (
                          <>
                            <button
                              onClick={() => {
                                setSelectedPayment(p);
                                setVerifyModalOpen(true);
                              }}
                              style={{ height: '38px', backgroundColor: '#059669', color: '#ffffff', border: 'none', borderRadius: '10px', padding: '0 14px', fontWeight: 800 }}
                              className="text-xs transition-all flex items-center gap-1.5 shadow-sm"
                            >
                              <Check className="w-4 h-4 stroke-[3]" />
                              Verify UTR
                            </button>

                            <button
                              onClick={() => {
                                setSelectedPayment(p);
                                setRejectModalOpen(true);
                              }}
                              style={{ height: '38px', backgroundColor: '#ffe4e6', color: '#881337', border: '1px solid #fecdd3', borderRadius: '10px', padding: '0 12px' }}
                              className="text-xs font-extrabold flex items-center justify-center"
                            >
                              <X className="w-4 h-4 stroke-[3]" />
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => {
                              setSelectedPayment(p);
                              setReceiptModalOpen(true);
                            }}
                            style={{ height: '38px', backgroundColor: '#f1f5f9', color: '#0f172a', border: '1px solid #cbd5e1', borderRadius: '10px', padding: '0 14px', fontWeight: 700 }}
                            className="text-xs transition-colors flex items-center gap-1.5"
                          >
                            <Eye className="w-4 h-4 text-emerald-700" />
                            View Receipt
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal 1: Verify & Approve Payment */}
      {verifyModalOpen && selectedPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-md animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-3xl w-full p-8 shadow-2xl space-y-5 text-slate-900">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 flex items-center justify-center bg-emerald-100 text-emerald-800 rounded-2xl shrink-0">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-900">Verify Payment & Grant Access</h3>
                  <p className="text-xs font-semibold text-slate-600">Review student transaction and verify UTR reference</p>
                </div>
              </div>
              <button onClick={() => setVerifyModalOpen(false)} className="text-slate-400 hover:text-slate-700 p-1.5">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-2.5 bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs font-semibold">
              <div className="flex justify-between py-1 border-b border-slate-200">
                <span className="text-slate-500 font-bold">Student Name:</span>
                <span className="font-black text-slate-900 text-sm">{selectedPayment.userName}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-200">
                <span className="text-slate-500 font-bold">Email Address:</span>
                <span className="text-slate-800 font-bold">{selectedPayment.userEmail}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-200">
                <span className="text-slate-500 font-bold">Purchased Item:</span>
                <span className="font-black text-emerald-800">{selectedPayment.itemTitle}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-200">
                <span className="text-slate-500 font-bold">Amount Paid:</span>
                <span className="font-black text-emerald-700 text-base">₹{selectedPayment.amount}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-200">
                <span className="text-slate-500 font-bold">UTR Ref Number:</span>
                <span className="font-mono font-black text-cyan-950 text-sm">{selectedPayment.utrNumber || selectedPayment.transactionId}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-500 font-bold">Payment Method:</span>
                <span>{renderMethodBadge(selectedPayment.paymentMethod)}</span>
              </div>
            </div>

            {selectedPayment.receiptUrl && (
              <div className="space-y-2">
                <label className="block text-xs font-black text-slate-800">Submitted Receipt Screenshot:</label>
                <div className="relative group rounded-2xl overflow-hidden border border-slate-300 max-h-52">
                  <img src={selectedPayment.receiptUrl} alt="Payment proof" className="w-full object-cover" />
                  <a
                    href={selectedPayment.receiptUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="absolute bottom-3 right-3 px-4 py-2 bg-slate-900/90 text-white text-xs rounded-xl flex items-center gap-1.5 font-extrabold"
                  >
                    <ExternalLink className="w-4 h-4" /> Full View
                  </a>
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
              <button
                onClick={() => setVerifyModalOpen(false)}
                style={{ height: '48px' }}
                className="px-5 text-sm font-bold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl border border-slate-300"
              >
                Cancel
              </button>
              <button
                onClick={() => handleApprovePayment(selectedPayment)}
                disabled={syncing}
                style={{ height: '48px', backgroundColor: '#059669', color: '#ffffff' }}
                className="px-6 text-sm font-black rounded-xl shadow-md border border-emerald-700 transition-all flex items-center gap-2"
              >
                {syncing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                Confirm & Activate Access
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 2: Reject Payment */}
      {rejectModalOpen && selectedPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-md animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full p-7 shadow-2xl space-y-5 text-slate-900">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 flex items-center justify-center bg-rose-100 text-rose-800 rounded-2xl shrink-0">
                  <XCircle className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-black text-slate-900">Reject Payment</h3>
              </div>
              <button onClick={() => setRejectModalOpen(false)} className="text-slate-400 hover:text-slate-700 p-1.5">
                <X className="w-6 h-6" />
              </button>
            </div>

            <p className="text-xs font-bold text-slate-600">
              Rejecting payment for <span className="font-black text-slate-900">{selectedPayment.userName}</span> (₹{selectedPayment.amount}). Please specify reason:
            </p>

            <div className="space-y-2">
              <label className="block text-xs font-black text-slate-800">Common Reasons:</label>
              <div className="flex flex-wrap gap-2">
                {[
                  'Invalid UTR reference number',
                  'Amount received does not match price',
                  'Duplicate transaction submission',
                  'Payment screenshot unreadable',
                  'Payment not reflected in bank account'
                ].map((reason) => (
                  <button
                    key={reason}
                    type="button"
                    onClick={() => setRejectionReason(reason)}
                    className="text-xs px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-900 rounded-xl border border-slate-300 font-extrabold transition-colors"
                  >
                    {reason}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-black text-slate-800">Rejection Reason Note:</label>
              <textarea
                rows={3}
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Type reason to notify student..."
                className="w-full p-3.5 bg-white border border-slate-300 rounded-xl text-sm font-bold text-slate-900 placeholder-slate-400 focus:outline-none focus:border-rose-600 focus:ring-2 focus:ring-rose-600/20"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
              <button
                onClick={() => setRejectModalOpen(false)}
                style={{ height: '48px' }}
                className="px-5 text-sm font-bold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl border border-slate-300"
              >
                Cancel
              </button>
              <button
                onClick={handleRejectPayment}
                disabled={syncing}
                style={{ height: '48px', backgroundColor: '#e11d48', color: '#ffffff' }}
                className="px-6 text-sm font-black rounded-xl shadow-md border border-rose-700 transition-all"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 3: Record Manual Offline Payment */}
      {manualPayModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 sm:p-10 md:p-14 bg-slate-900/70 backdrop-blur-md animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-4xl w-full p-8 sm:p-12 md:p-14 shadow-2xl space-y-7 max-h-[85vh] overflow-y-auto text-slate-900">
            <div className="flex items-center justify-between border-b border-slate-200 pb-5">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 flex items-center justify-center bg-emerald-100 text-emerald-800 rounded-2xl shrink-0">
                  <Plus className="w-6 h-6 stroke-[3]" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-900">Record Offline / Manual Payment</h3>
                  <p className="text-xs font-bold text-slate-600 mt-0.5">Save payment directly into Firestore DB and activate course access</p>
                </div>
              </div>
              <button onClick={() => setManualPayModalOpen(false)} className="text-slate-400 hover:text-slate-700 p-2 rounded-xl hover:bg-slate-100 transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleCreateManualPayment} className="space-y-6 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="block font-black text-slate-900 text-xs">Student Full Name *</label>
                  <input
                    type="text"
                    required
                    value={manualForm.userName}
                    onChange={(e) => setManualForm({ ...manualForm, userName: e.target.value })}
                    placeholder="e.g. Ramesh Kumar"
                    style={{ height: '50px', paddingLeft: '20px', paddingRight: '20px' }}
                    className="w-full bg-white border border-slate-300 rounded-xl text-sm font-bold text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 shadow-sm"
                  />
                </div>

                <div className="space-y-2">
                  <label className="block font-black text-slate-900 text-xs">Student Email Address *</label>
                  <input
                    type="email"
                    required
                    value={manualForm.userEmail}
                    onChange={(e) => setManualForm({ ...manualForm, userEmail: e.target.value })}
                    placeholder="student@example.com"
                    style={{ height: '50px', paddingLeft: '20px', paddingRight: '20px' }}
                    className="w-full bg-white border border-slate-300 rounded-xl text-sm font-bold text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 shadow-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="block font-black text-slate-900 text-xs">Phone Number</label>
                  <input
                    type="text"
                    value={manualForm.userPhone}
                    onChange={(e) => setManualForm({ ...manualForm, userPhone: e.target.value })}
                    placeholder="+91 98765 43210"
                    style={{ height: '50px', paddingLeft: '20px', paddingRight: '20px' }}
                    className="w-full bg-white border border-slate-300 rounded-xl text-sm font-bold text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 shadow-sm"
                  />
                </div>

                <div className="space-y-2">
                  <label className="block font-black text-slate-900 text-xs">Item Type</label>
                  <select
                    value={manualForm.itemType}
                    onChange={(e) => setManualForm({ ...manualForm, itemType: e.target.value as any })}
                    style={{ height: '50px', paddingLeft: '20px', paddingRight: '20px' }}
                    className="w-full bg-white border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:border-emerald-600 shadow-sm cursor-pointer"
                  >
                    <option value="course">Course</option>
                    <option value="internship">Internship</option>
                    <option value="bundle">Bundle</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="block font-black text-slate-900 text-xs">Course / Program Title *</label>
                <input
                  type="text"
                  required
                  value={manualForm.itemTitle}
                  onChange={(e) => setManualForm({ ...manualForm, itemTitle: e.target.value })}
                  placeholder="e.g. Full-Stack Web Development Bootcamp"
                  style={{ height: '50px', paddingLeft: '20px', paddingRight: '20px' }}
                  className="w-full bg-white border border-slate-300 rounded-xl text-sm font-bold text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-600 shadow-sm"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <label className="block font-black text-slate-900 text-xs">Amount (INR ₹) *</label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={manualForm.amount}
                    onChange={(e) => setManualForm({ ...manualForm, amount: e.target.value })}
                    placeholder="2999"
                    style={{ height: '50px', paddingLeft: '20px', paddingRight: '20px' }}
                    className="w-full bg-white border border-slate-300 rounded-xl text-sm font-bold text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-600 shadow-sm"
                  />
                </div>

                <div className="space-y-2">
                  <label className="block font-black text-slate-900 text-xs">Payment Method</label>
                  <select
                    value={manualForm.paymentMethod}
                    onChange={(e) => setManualForm({ ...manualForm, paymentMethod: e.target.value as any })}
                    style={{ height: '50px', paddingLeft: '20px', paddingRight: '20px' }}
                    className="w-full bg-white border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:border-emerald-600 shadow-sm cursor-pointer"
                  >
                    <option value="upi_qr">UPI / QR Code</option>
                    <option value="cash">Cash at Office Desk</option>
                    <option value="bank_transfer">Direct Bank Transfer</option>
                    <option value="razorpay">Razorpay / Card</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="block font-black text-slate-900 text-xs">UTR / Ref Number</label>
                  <input
                    type="text"
                    value={manualForm.utrNumber}
                    onChange={(e) => setManualForm({ ...manualForm, utrNumber: e.target.value })}
                    placeholder="12-digit UTR"
                    style={{ height: '50px', paddingLeft: '20px', paddingRight: '20px' }}
                    className="w-full bg-white border border-slate-300 rounded-xl text-sm font-bold text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-600 shadow-sm"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="block font-black text-slate-900 text-xs">Notes / Internal Remark</label>
                <input
                  type="text"
                  value={manualForm.notes}
                  onChange={(e) => setManualForm({ ...manualForm, notes: e.target.value })}
                  placeholder="e.g. Received by desk coordinator Rahul"
                  style={{ height: '50px', paddingLeft: '20px', paddingRight: '20px' }}
                  className="w-full bg-white border border-slate-300 rounded-xl text-sm font-bold text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-600 shadow-sm"
                />
              </div>

              <div className="flex items-center justify-end gap-4 pt-5 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setManualPayModalOpen(false)}
                  style={{ height: '48px', minWidth: '120px' }}
                  className="px-6 text-sm font-bold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl border border-slate-300 transition-colors flex items-center justify-center shrink-0"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={syncing}
                  style={{
                    height: '48px',
                    minWidth: '260px',
                    backgroundColor: '#059669',
                    color: '#ffffff',
                    padding: '0 28px',
                    whiteSpace: 'nowrap'
                  }}
                  className="text-sm font-black rounded-xl shadow-md border border-emerald-700 transition-all flex items-center justify-center gap-2 shrink-0"
                >
                  <CheckCircle2 className="w-5 h-5 stroke-[2.5]" /> Save to DB & Activate Access
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 4: Receipt / Invoice View */}
      {receiptModalOpen && selectedPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-md animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-2xl w-full p-8 shadow-2xl space-y-5 text-slate-900">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 flex items-center justify-center bg-emerald-100 text-emerald-800 rounded-2xl shrink-0">
                  <FileText className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-900">Official Fee Receipt</h3>
                  <p className="text-xs font-semibold text-slate-600">A2Z Academy Transaction Record</p>
                </div>
              </div>
              <button onClick={() => setReceiptModalOpen(false)} className="text-slate-400 hover:text-slate-700 p-1.5">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-300 space-y-3 font-mono text-xs text-slate-900">
              <div className="text-center border-b border-slate-300 pb-3">
                <h2 className="text-lg font-black text-slate-900 uppercase tracking-wider">A2Z Academy</h2>
                <p className="text-[11px] text-slate-600 font-bold">Tax Payment Receipt & Enrollment Confirmation</p>
              </div>

              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500 font-bold">Transaction ID:</span>
                  <span className="text-slate-900 font-black">{selectedPayment.transactionId}</span>
                </div>
                {selectedPayment.utrNumber && (
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-bold">Bank UTR Ref:</span>
                    <span className="text-cyan-950 font-black">{selectedPayment.utrNumber}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-slate-500 font-bold">Date & Time:</span>
                  <span className="text-slate-800 font-bold">{new Date(selectedPayment.createdAt).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-bold">Student Name:</span>
                  <span className="text-slate-900 font-black">{selectedPayment.userName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-bold">Student Email:</span>
                  <span className="text-slate-800 font-bold">{selectedPayment.userEmail}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-bold">Program Enrolled:</span>
                  <span className="text-emerald-800 font-black max-w-[220px] text-right truncate">{selectedPayment.itemTitle}</span>
                </div>
              </div>

              <div className="border-t border-b border-slate-300 py-3 my-2 space-y-1 text-sm font-sans">
                <div className="flex justify-between text-slate-600 text-xs font-bold">
                  <span>Base Program Fee</span>
                  <span>₹{selectedPayment.originalAmount || selectedPayment.amount}</span>
                </div>
                {selectedPayment.discountAmount && (
                  <div className="flex justify-between text-emerald-800 text-xs font-black">
                    <span>Discount Applied ({selectedPayment.couponCode})</span>
                    <span>-₹{selectedPayment.discountAmount}</span>
                  </div>
                )}
                <div className="flex justify-between text-slate-900 font-black text-base pt-1">
                  <span>Net Amount Paid</span>
                  <span className="text-emerald-700">₹{selectedPayment.amount}</span>
                </div>
              </div>

              <div className="text-center text-[10px] text-slate-600 font-bold">
                Verified by: {selectedPayment.verifiedBy || 'System'} at {selectedPayment.verifiedAt ? new Date(selectedPayment.verifiedAt).toLocaleString() : 'N/A'}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => window.print()}
                style={{ height: '48px' }}
                className="px-5 text-xs font-bold text-slate-800 bg-white hover:bg-slate-100 rounded-xl border border-slate-300 shadow-sm"
              >
                Print / Save PDF
              </button>
              <button
                onClick={() => setReceiptModalOpen(false)}
                style={{ height: '48px', backgroundColor: '#059669', color: '#ffffff' }}
                className="px-5 text-xs font-black rounded-xl shadow-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PaymentsManager;
