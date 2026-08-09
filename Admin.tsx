import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  LayoutDashboard, BookOpen, GraduationCap, Users, BarChart3,
  DollarSign, Plus, Search, Database,
  Eye, Trash,
  Shield, Star, Edit, MessageSquare,
  Send, X, UserPlus, UserCheck,
  RefreshCw, CheckCircle, CreditCard
} from 'lucide-react';
import { PaymentsManager } from './PaymentsManager';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from './components/ui/Card';
import { Button } from './components/ui/Button';
import { Badge } from './components/ui/Badge';
import { Modal, ModalProvider } from './components/ui/Modal';
import { useToastHelpers } from './components/ui/Toast';
import { cn } from './utils';
import type {
  AdminAnalytics, Course, Internship, InternshipDomain,
  CourseStatus, CourseLevel, UserProfile, UserRole, Notification, NotificationType
} from './types';
import { 
  getAdminAnalytics, clearAllFirestoreCollections, cleanObject,
  createCourse, updateCourse, deleteCourse,
  createInternship, updateInternship, deleteInternship
} from './data';
import { fetchFirebaseCollection } from './lib/firebase';
import { doc, updateDoc, deleteDoc, writeBatch, setDoc, db } from './firebase';
import { DbManagerModal } from './components/DbManagerModal';

/* ─── Helpers ─── */
const statusColor: Record<string, 'success' | 'warning' | 'error' | 'primary' | 'outline'> = {
  published: 'success',
  draft: 'warning',
  archived: 'outline',
  active: 'success',
  completed: 'primary',
  upcoming: 'warning',
  applied: 'outline',
  success: 'success',
  pending: 'warning',
  failed: 'error',
  refunded: 'outline',
};

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
};

const formatCount = (n: number) => {
  if (n >= 10000000) return `${(n / 10000000).toFixed(1)}Cr`;
  if (n >= 100000) return `${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
};

/* ─── Stat Card ─── */
const StatCard = ({ label, value, icon: Icon, sub, color }: {
  label: string; value: string | number; icon: React.ElementType; sub?: string; color: string;
}) => (
  <Card variant="hover" padding="lg" className="relative overflow-hidden">
    <div className="flex items-start justify-between">
      <div className="space-y-1">
        <p className="text-label-sm font-label-sm text-on-surface-variant">{label}</p>
        <p className="font-display text-3xl font-bold text-on-surface">{value}</p>
        {sub && <p className="text-xs text-on-surface-variant">{sub}</p>}
      </div>
      <div className={cn('w-12 h-12 flex items-center justify-center', color)}>
        <Icon className="h-6 w-6" />
      </div>
    </div>
  </Card>
);

/* ─── Mini Bar Chart ─── */
const MiniBar = ({ data, color }: { data: { label: string; value: number }[]; color: string }) => {
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div className="flex items-end gap-1 h-20">
      {data.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative">
          <div
            className={cn('w-full transition-all duration-300 hover:opacity-80', color)}
            style={{ height: `${(d.value / max) * 100}%` }}
          />
          <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-inverse-surface text-inverse-on-surface text-xs px-2 py-1 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            {d.value.toLocaleString()}
          </div>
        </div>
      ))}
    </div>
  );
};

/* ─── Image Upload / URL Input Helper ─── */
const ImageUploadInput = ({ label, value, onChange, placeholder, maxSizeMB = 2 }: {
  label: string;
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  maxSizeMB?: number;
}) => {
  const [fileError, setFileError] = useState<string>('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFileError('');
    const file = e.target.files?.[0];
    if (file) {
      const maxSizeBytes = maxSizeMB * 1024 * 1024;
      if (file.size > maxSizeBytes) {
        const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
        setFileError(`File size (${fileSizeMB} MB) exceeds maximum limit of ${maxSizeMB} MB. Please choose a smaller image.`);
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          onChange(reader.result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="col-span-2 space-y-2 mb-1">
      <div className="flex items-center justify-between">
        <label className="label">{label}</label>
        <span className="text-[11px] font-semibold text-on-surface-variant/70">Max Size: {maxSizeMB} MB</span>
      </div>
      <div className="flex items-center gap-4 p-3 bg-surface-container/50 border border-outline-variant/30 rounded-lg">
        {value ? (
          <img src={value} alt="Preview" className="w-16 h-16 object-cover border border-outline-variant/40 rounded-md shrink-0 bg-white" />
        ) : (
          <div className="w-16 h-16 bg-white border border-dashed border-outline-variant/50 rounded-md flex items-center justify-center text-xs font-semibold text-on-surface-variant shrink-0">
            No Image
          </div>
        )}
        <div className="flex-1 space-y-2 min-w-0">
          <input
            type="text"
            className="input w-full text-xs"
            placeholder={placeholder || 'Paste Image PNG / JPG URL (https://...)'}
            value={value}
            onChange={(e) => { setFileError(''); onChange(e.target.value); }}
          />
          <div className="flex items-center gap-3">
            <label className="btn btn-outline text-xs cursor-pointer py-1.5 px-3">
              <span>Upload PNG / Image File</span>
              <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
            </label>
            <span className="text-[11px] text-on-surface-variant">Max {maxSizeMB}MB</span>
            {value && (
              <button type="button" onClick={() => { setFileError(''); onChange(''); }} className="text-xs text-error hover:underline font-semibold ml-auto">
                Remove
              </button>
            )}
          </div>
        </div>
      </div>
      {fileError && (
        <p className="text-xs text-error font-medium bg-error/10 border border-error/20 p-2 rounded mt-1">
          {fileError}
        </p>
      )}
    </div>
  );
};

/* ─── Course Form Modal ─── */
/* ─── Course Form Modal ─── */
const CourseFormModal = ({ course, onSave, onClose }: {
  course?: Course;
  onSave: (data: Partial<Course>) => Promise<void>;
  onClose: () => void;
}) => {
  const [activeTab, setActiveTab] = useState<'basic' | 'syllabus' | 'certificate'>('basic');
  const [submitting, setSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string>('');

  const [form, setForm] = useState({
    title: course?.title || '',
    shortDescription: course?.shortDescription || '',
    description: course?.description || '',
    instructor: course?.instructor || '',
    category: course?.category || 'Web Development',
    level: course?.level || ('Beginner' as CourseLevel),
    price: course?.price ?? 0,
    originalPrice: course?.originalPrice ?? 0,
    duration: course?.duration || '',
    status: course?.status || ('draft' as CourseStatus),
    thumbnail: course?.thumbnail || '',
    skills: course?.skills?.join(', ') || '',
    prerequisites: course?.prerequisites?.join(', ') || '',
    whatYouLearn: course?.whatYouLearn?.join('\n') || '',
    certificateTitle: course?.certificateTitle || 'ISO Verified Certification',
    certificateDescription: course?.certificateDescription || 'Upon passing the final capstone assessment, you receive a tamper-proof digital certificate with QR code verification shareable directly on LinkedIn and your resume.',
    verificationType: course?.verificationType || 'Verification QR Code (Included free)',
  });

  const [modules, setModules] = useState<CourseModule[]>(course?.modules || [
    {
      id: 'mod-1',
      title: 'Module 1: Orientation & Core Fundamentals',
      description: 'Establish foundational concepts, tools setup, architecture overview, and initial project structure.',
      lessons: [
        { id: 'les-1', title: '1.1 Industry Overview & Architecture Overview', duration: '45m', freePreview: true },
        { id: 'les-2', title: '1.2 Environment Setup & Tools Configuration', duration: '60m', freePreview: true },
        { id: 'les-3', title: '1.3 Core Concepts & Best Practices', duration: '50m', freePreview: false },
      ]
    },
    {
      id: 'mod-2',
      title: 'Module 2: In-Depth Technical Implementation',
      description: 'Master practical skills through hands-on implementation, live exercises, and step-by-step guidance.',
      lessons: [
        { id: 'les-4', title: '2.1 Advanced Concepts & Deep Dive', duration: '60m', freePreview: false },
        { id: 'les-5', title: '2.2 Project Build & Hands-on Lab', duration: '90m', freePreview: false },
      ]
    }
  ]);

  const totalLessonsCount = useMemo(() => {
    return modules.reduce((sum, m) => sum + (m.lessons?.length || 0), 0);
  }, [modules]);

  const addModule = () => {
    const nextNum = modules.length + 1;
    setModules(prev => [
      ...prev,
      {
        id: `mod-${Date.now()}`,
        title: `Module ${nextNum}: New Course Module`,
        description: 'Module summary description',
        lessons: [
          { id: `les-${Date.now()}`, title: `${nextNum}.1 Lesson Title`, duration: '45m', freePreview: false }
        ]
      }
    ]);
  };

  const updateModule = (index: number, key: 'title' | 'description', val: string) => {
    setModules(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [key]: val };
      return copy;
    });
  };

  const deleteModule = (index: number) => {
    setModules(prev => prev.filter((_, i) => i !== index));
  };

  const addLesson = (modIndex: number) => {
    setModules(prev => {
      const copy = [...prev];
      const targetMod = copy[modIndex];
      const lessons = targetMod.lessons || [];
      const nextLesNum = lessons.length + 1;
      const newLesson: CourseLesson = {
        id: `les-${Date.now()}`,
        title: `Lesson ${modIndex + 1}.${nextLesNum}: New Lesson Topic`,
        duration: '45m',
        freePreview: false
      };
      copy[modIndex] = { ...targetMod, lessons: [...lessons, newLesson] };
      return copy;
    });
  };

  const updateLesson = (modIndex: number, lesIndex: number, updated: Partial<CourseLesson>) => {
    setModules(prev => {
      const copy = [...prev];
      const targetMod = copy[modIndex];
      const lessons = [...(targetMod.lessons || [])];
      lessons[lesIndex] = { ...lessons[lesIndex], ...updated };
      copy[modIndex] = { ...targetMod, lessons };
      return copy;
    });
  };

  const deleteLesson = (modIndex: number, lesIndex: number) => {
    setModules(prev => {
      const copy = [...prev];
      const targetMod = copy[modIndex];
      const lessons = (targetMod.lessons || []).filter((_, i) => i !== lesIndex);
      copy[modIndex] = { ...targetMod, lessons };
      return copy;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError('');

    // 1. Validate Basic Details
    if (!form.title.trim()) { setValidationError('Course Title cannot be left empty.'); setActiveTab('basic'); return; }
    if (!form.thumbnail.trim()) { setValidationError('Course Thumbnail Image cannot be left empty.'); setActiveTab('basic'); return; }
    if (!form.shortDescription.trim()) { setValidationError('Short Description cannot be left empty.'); setActiveTab('basic'); return; }
    if (!form.description.trim()) { setValidationError('Full Overview Description cannot be left empty.'); setActiveTab('basic'); return; }
    if (!form.instructor.trim()) { setValidationError('Instructor Name cannot be left empty.'); setActiveTab('basic'); return; }
    if (form.price === undefined || form.price === null || isNaN(form.price) || form.price <= 0) { setValidationError('Offer Price (₹) must be greater than 0.'); setActiveTab('basic'); return; }
    if (!form.duration.trim()) { setValidationError('Total Duration cannot be left empty.'); setActiveTab('basic'); return; }
    if (!form.skills.trim()) { setValidationError('Skills Covered cannot be left empty.'); setActiveTab('basic'); return; }
    if (!form.prerequisites.trim()) { setValidationError('Course Prerequisites cannot be left empty.'); setActiveTab('basic'); return; }

    // 2. Validate Syllabus & Modules
    if (modules.length === 0) { setValidationError('Course must have at least 1 module in Syllabus.'); setActiveTab('syllabus'); return; }
    for (let i = 0; i < modules.length; i++) {
      const m = modules[i];
      if (!m.title.trim()) { setValidationError(`Module ${i + 1} title cannot be left empty.`); setActiveTab('syllabus'); return; }
      if (!m.description?.trim()) { setValidationError(`Module ${i + 1} ("${m.title}") description cannot be left empty.`); setActiveTab('syllabus'); return; }
      if (!m.lessons || m.lessons.length === 0) { setValidationError(`Module ${i + 1} ("${m.title}") must have at least 1 lesson.`); setActiveTab('syllabus'); return; }
      for (let j = 0; j < m.lessons.length; j++) {
        const l = m.lessons[j];
        if (!l.title.trim()) { setValidationError(`Lesson ${j + 1} in Module ${i + 1} title cannot be left empty.`); setActiveTab('syllabus'); return; }
        if (!l.duration?.trim()) { setValidationError(`Lesson "${l.title}" in Module ${i + 1} duration cannot be left empty.`); setActiveTab('syllabus'); return; }
      }
    }

    // 3. Validate ISO Certificate & Highlights
    if (!form.certificateTitle.trim()) { setValidationError('Certification Title cannot be left empty.'); setActiveTab('certificate'); return; }
    if (!form.certificateDescription.trim()) { setValidationError('Certification Description cannot be left empty.'); setActiveTab('certificate'); return; }
    if (!form.verificationType.trim()) { setValidationError('Verification Badge / Type cannot be left empty.'); setActiveTab('certificate'); return; }
    if (!form.whatYouLearn.trim()) { setValidationError('What You Will Learn points cannot be left empty.'); setActiveTab('certificate'); return; }

    setSubmitting(true);
    try {
      const whatYouLearnArr = form.whatYouLearn
        .split('\n')
        .map(s => s.trim())
        .filter(Boolean);

      await onSave({
        ...form,
        price: Number(form.price),
        originalPrice: Number(form.originalPrice) || Number(form.price),
        skills: form.skills.split(',').map(s => s.trim()).filter(Boolean),
        prerequisites: form.prerequisites.split(',').map(s => s.trim()).filter(Boolean),
        whatYouLearn: whatYouLearnArr,
        modules,
        totalModules: modules.length,
        totalLessons: totalLessonsCount,
      });
      onClose();
    } catch (err) {
      console.error('Failed to save course:', err);
      setValidationError('Failed to save course. Please check all fields and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {validationError && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold rounded-xl flex items-center gap-2">
          <span className="shrink-0 font-black">⚠️ Validation Error:</span>
          <span>{validationError}</span>
        </div>
      )}

      {/* Sub-Header Tabs */}
      <div className="flex border-b border-slate-200 gap-2 font-bold text-xs">
        <button
          type="button"
          onClick={() => setActiveTab('basic')}
          className={cn(
            'px-4 py-2.5 rounded-t-xl transition-all border-b-2',
            activeTab === 'basic'
              ? 'border-emerald-600 text-emerald-800 bg-emerald-50/60 font-black'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          )}
        >
          1. Basic Details *
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('syllabus')}
          className={cn(
            'px-4 py-2.5 rounded-t-xl transition-all border-b-2 flex items-center gap-2',
            activeTab === 'syllabus'
              ? 'border-emerald-600 text-emerald-800 bg-emerald-50/60 font-black'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          )}
        >
          2. Syllabus & Modules * ({modules.length} Modules, {totalLessonsCount} Lessons)
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('certificate')}
          className={cn(
            'px-4 py-2.5 rounded-t-xl transition-all border-b-2',
            activeTab === 'certificate'
              ? 'border-emerald-600 text-emerald-800 bg-emerald-50/60 font-black'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          )}
        >
          3. ISO Certificate & Highlights *
        </button>
      </div>

      {/* TAB 1: BASIC DETAILS */}
      {activeTab === 'basic' && (
        <div className="grid grid-cols-2 gap-x-6 gap-y-5 text-slate-900">
          <div className="col-span-2">
            <label className="label">Title *</label>
            <input
              className="input"
              value={form.title}
              onChange={e => setForm({ ...form, title: e.target.value })}
              placeholder="e.g. Master Full-Stack Web Development & Cloud Architecture"
              required
            />
          </div>

          <ImageUploadInput
            label="Course Thumbnail Image (PNG / JPG file or URL) *"
            value={form.thumbnail}
            onChange={(val) => setForm({ ...form, thumbnail: val })}
            placeholder="https://... image PNG link or click Upload PNG File"
          />

          <div className="col-span-2">
            <label className="label">Short Description *</label>
            <input
              className="input"
              value={form.shortDescription}
              onChange={e => setForm({ ...form, shortDescription: e.target.value })}
              placeholder="Brief tagline for course cards..."
              required
            />
          </div>

          <div className="col-span-2">
            <label className="label">Full Overview Description *</label>
            <textarea
              className="input min-h-[90px]"
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              placeholder="Comprehensive course breakdown and expectations..."
              required
            />
          </div>

          <div>
            <label className="label">Instructor Name *</label>
            <input className="input" value={form.instructor} onChange={e => setForm({ ...form, instructor: e.target.value })} placeholder="e.g. Senior Tech Lead Rahul Sharma" required />
          </div>

          <div>
            <label className="label">Category *</label>
            <select className="input" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} required>
              {['Web Development', 'AI & Machine Learning', 'Cybersecurity', 'Data Science', 'DevOps & Cloud', 'Programming', 'Red Teaming', 'Cyber Defense', 'Ethical Hacking'].map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">Difficulty Level *</label>
            <select className="input" value={form.level} onChange={e => setForm({ ...form, level: e.target.value as CourseLevel })} required>
              <option value="Beginner">Beginner</option>
              <option value="Intermediate">Intermediate</option>
              <option value="Advanced">Advanced</option>
            </select>
          </div>

          <div>
            <label className="label">Publish Status *</label>
            <select className="input" value={form.status} onChange={e => setForm({ ...form, status: e.target.value as CourseStatus })} required>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
            </select>
          </div>

          <div>
            <label className="label">Offer Price (₹) *</label>
            <input className="input" type="number" min={1} value={form.price} onChange={e => setForm({ ...form, price: Number(e.target.value) })} required />
          </div>

          <div>
            <label className="label">Original Price (₹) *</label>
            <input className="input" type="number" min={1} value={form.originalPrice} onChange={e => setForm({ ...form, originalPrice: Number(e.target.value) })} required />
          </div>

          <div>
            <label className="label">Total Duration *</label>
            <input className="input" value={form.duration} onChange={e => setForm({ ...form, duration: e.target.value })} placeholder="e.g. 20 hr (or 4 Weeks)" required />
          </div>

          <div className="col-span-2">
            <label className="label">Skills Covered (comma-separated) *</label>
            <input className="input" value={form.skills} onChange={e => setForm({ ...form, skills: e.target.value })} placeholder="React, TypeScript, Node.js, Docker, AWS" required />
          </div>

          <div className="col-span-2">
            <label className="label">Prerequisites (comma-separated) *</label>
            <input className="input" value={form.prerequisites} onChange={e => setForm({ ...form, prerequisites: e.target.value })} placeholder="Basic JavaScript fundamentals" required />
          </div>
        </div>
      )}

      {/* TAB 2: COURSE SYLLABUS & MODULES BUILDER */}
      {activeTab === 'syllabus' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div>
              <h4 className="font-black text-sm text-slate-900">Course Syllabus & Curriculum Builder *</h4>
              <p className="text-xs font-semibold text-slate-600">All module & lesson fields are required and cannot be empty</p>
            </div>
            <button
              type="button"
              onClick={addModule}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" /> Add Module
            </button>
          </div>

          <div className="space-y-5">
            {modules.map((mod, modIdx) => (
              <div key={mod.id} className="bg-white border border-slate-300 rounded-2xl p-5 shadow-sm space-y-4">
                <div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-3">
                  <div className="flex-1 space-y-2">
                    <input
                      className="input font-black text-sm bg-slate-50 text-slate-900"
                      value={mod.title}
                      onChange={e => updateModule(modIdx, 'title', e.target.value)}
                      placeholder={`e.g. Module ${modIdx + 1}: Orientation & Core Fundamentals`}
                      required
                    />
                    <input
                      className="input text-xs font-semibold"
                      value={mod.description || ''}
                      onChange={e => updateModule(modIdx, 'description', e.target.value)}
                      placeholder="Module summary description..."
                      required
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => deleteModule(modIdx)}
                    className="p-2 text-rose-600 hover:bg-rose-50 rounded-xl transition-colors shrink-0"
                    title="Delete Module"
                  >
                    <Trash className="w-5 h-5" />
                  </button>
                </div>

                {/* Lessons inside Module */}
                <div className="space-y-3 pl-2 sm:pl-4">
                  <div className="flex items-center justify-between text-xs font-extrabold text-slate-700">
                    <span>Lessons in this Module ({mod.lessons?.length || 0}) *</span>
                    <button
                      type="button"
                      onClick={() => addLesson(modIdx)}
                      className="text-emerald-700 hover:underline flex items-center gap-1 font-black"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Lesson
                    </button>
                  </div>

                  {(mod.lessons || []).map((les, lesIdx) => (
                    <div key={les.id} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
                      <input
                        className="input flex-1 font-bold text-xs"
                        value={les.title}
                        onChange={e => updateLesson(modIdx, lesIdx, { title: e.target.value })}
                        placeholder="e.g. 1.1 Industry Overview & Architecture Overview"
                        required
                      />
                      <input
                        className="input w-full sm:w-28 font-bold text-xs"
                        value={les.duration || ''}
                        onChange={e => updateLesson(modIdx, lesIdx, { duration: e.target.value })}
                        placeholder="e.g. 45m"
                        required
                      />
                      <label className="flex items-center gap-1.5 font-bold text-slate-700 cursor-pointer shrink-0">
                        <input
                          type="checkbox"
                          checked={les.freePreview || false}
                          onChange={e => updateLesson(modIdx, lesIdx, { freePreview: e.target.checked })}
                          className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-600"
                        />
                        <span>Free Preview</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => deleteLesson(modIdx, lesIdx)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded"
                        title="Delete Lesson"
                      >
                        <Trash className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: CERTIFICATION & HIGHLIGHTS */}
      {activeTab === 'certificate' && (
        <div className="space-y-5 text-slate-900">
          <div>
            <label className="label">Certification Title *</label>
            <input
              className="input"
              value={form.certificateTitle}
              onChange={e => setForm({ ...form, certificateTitle: e.target.value })}
              placeholder="e.g. ISO Verified Certification"
              required
            />
          </div>

          <div>
            <label className="label">Certification Details & Credential Description *</label>
            <textarea
              className="input min-h-[90px]"
              value={form.certificateDescription}
              onChange={e => setForm({ ...form, certificateDescription: e.target.value })}
              placeholder="e.g. Upon passing the final capstone assessment, you receive a tamper-proof digital certificate with QR code verification shareable directly on LinkedIn and your resume."
              required
            />
          </div>

          <div>
            <label className="label">Verification Badge / Type *</label>
            <input
              className="input"
              value={form.verificationType}
              onChange={e => setForm({ ...form, verificationType: e.target.value })}
              placeholder="e.g. Verification QR Code (Included free)"
              required
            />
          </div>

          <div>
            <label className="label">What You Will Learn (1 bullet point per line) *</label>
            <textarea
              className="input min-h-[110px]"
              value={form.whatYouLearn}
              onChange={e => setForm({ ...form, whatYouLearn: e.target.value })}
              placeholder="Master full-stack React & Node.js architecture&#10;Build end-to-end cloud microservices&#10;Implement OAuth 2.0 authentication & security"
              required
            />
          </div>
        </div>
      )}

      <CardFooter className="mt-6 flex justify-end gap-2 border-t border-slate-200 pt-4">
        <Button variant="ghost" type="button" onClick={onClose} disabled={submitting}>Cancel</Button>
        <Button variant="primary" type="submit" disabled={submitting}>
          {submitting ? 'Saving...' : course ? 'Update Course' : 'Create Course'}
        </Button>
      </CardFooter>
    </form>
  );
};

/* ─── Internship Form Modal ─── */
const InternshipFormModal = ({ internship, onSave, onClose, internshipDomains }: {
  internship?: Internship;
  onSave: (data: Partial<Internship>) => Promise<void>;
  onClose: () => void;
  internshipDomains: InternshipDomain[];
}) => {
  const [activeTab, setActiveTab] = useState<'basic' | 'roadmap' | 'certificate'>('basic');
  const [submitting, setSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string>('');

  const [form, setForm] = useState({
    title: internship?.title || '',
    company: internship?.company || '',
    organization: internship?.organization || internship?.company || '',
    domain: internship?.domain || 'Cybersecurity',
    location: internship?.location || 'Remote',
    type: internship?.type || ('Full-time' as 'Full-time' | 'Part-time'),
    format: internship?.format || 'Part-time (online)',
    duration: internship?.duration || '1 month',
    stipend: internship?.stipend || '0',
    status: internship?.status || ('active' as Internship['status']),
    logo: internship?.logo || '',
    skills: internship?.skills?.join(', ') || '',
    description: internship?.description || '',
    verifiedCertificate: internship?.verifiedCertificate || 'Included',
    lorEligibility: internship?.lorEligibility || 'Based on evaluation',
  });

  const [roadmap, setRoadmap] = useState<InternshipPhase[]>(internship?.roadmap || [
    {
      id: 'phase-1',
      weeks: 'WEEKS 1 - 2',
      title: 'Phase 1: Onboarding, Tools & Architecture Foundations',
      description: 'Set up development environments, study system specifications, master team workflow protocols, and analyze existing codebase.',
      keyDeliverables: [
        'Git workflow & branch management setup',
        'Architecture walkthrough and code review standard setup',
        'First feature task completion & code submission'
      ]
    },
    {
      id: 'phase-2',
      weeks: 'WEEKS 3 - 6',
      title: 'Phase 2: Core Feature Implementation & Live Modules',
      description: 'Implement core modules, write production unit tests, connect backend services, and optimize module performance.',
      keyDeliverables: [
        'Core API endpoints integration & data validation',
        'Database query optimizations & caching layer',
        'Weekly sprint demos & peer code reviews'
      ]
    },
    {
      id: 'phase-3',
      weeks: 'WEEKS 7 - 10',
      title: 'Phase 3: Production Testing, Optimization & Security Audit',
      description: 'Perform load testing, vulnerability assessments, resolution of edge-case bugs, and production environment readiness.',
      keyDeliverables: [
        'Security vulnerability audit report & remediation',
        'Performance load test & latency reduction',
        'Staging deployment verification & sign-off'
      ]
    },
    {
      id: 'phase-4',
      weeks: 'WEEKS 11 - 12',
      title: 'Phase 4: Capstone Presentation, LOR & Placement Review',
      description: 'Final capstone demonstration, leadership review for Letter of Recommendation (LOR) & priority placement consideration.',
      keyDeliverables: [
        'Capstone project live demonstration',
        'Final engineering assessment & evaluation report',
        'Performance-backed LOR issuance & career recommendation'
      ]
    }
  ]);

  const addPhase = () => {
    const nextNum = roadmap.length + 1;
    setRoadmap(prev => [
      ...prev,
      {
        id: `phase-${Date.now()}`,
        weeks: `WEEKS ${nextNum * 2 - 1} - ${nextNum * 2}`,
        title: `Phase ${nextNum}: Advanced Project Execution`,
        description: 'Detailed execution phase description...',
        keyDeliverables: [
          'Deliverable task 1',
          'Deliverable task 2'
        ]
      }
    ]);
  };

  const updatePhase = (index: number, key: keyof InternshipPhase, val: any) => {
    setRoadmap(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [key]: val };
      return copy;
    });
  };

  const deletePhase = (index: number) => {
    setRoadmap(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError('');

    // 1. Validate Program Overview & Details
    if (!form.title.trim()) { setValidationError('Internship Title cannot be left empty.'); setActiveTab('basic'); return; }
    if (!form.logo.trim()) { setValidationError('Organization / Brand Logo cannot be left empty.'); setActiveTab('basic'); return; }
    if (!form.organization.trim()) { setValidationError('Organization / Company Name cannot be left empty.'); setActiveTab('basic'); return; }
    if (!form.format.trim()) { setValidationError('Format (Mode) cannot be left empty.'); setActiveTab('basic'); return; }
    if (!form.duration.trim()) { setValidationError('Duration cannot be left empty.'); setActiveTab('basic'); return; }
    if (!form.stipend.trim()) { setValidationError('Stipend Amount cannot be left empty.'); setActiveTab('basic'); return; }
    if (!form.location.trim()) { setValidationError('Location cannot be left empty.'); setActiveTab('basic'); return; }
    if (!form.skills.trim()) { setValidationError('Skills Covered cannot be left empty.'); setActiveTab('basic'); return; }
    if (!form.description.trim()) { setValidationError('Program Description cannot be left empty.'); setActiveTab('basic'); return; }

    // 2. Validate Roadmap
    if (roadmap.length === 0) { setValidationError('Internship must have at least 1 phase in Execution Roadmap.'); setActiveTab('roadmap'); return; }
    for (let i = 0; i < roadmap.length; i++) {
      const p = roadmap[i];
      if (!p.weeks.trim()) { setValidationError(`Phase ${i + 1} weeks duration cannot be left empty.`); setActiveTab('roadmap'); return; }
      if (!p.title.trim()) { setValidationError(`Phase ${i + 1} title cannot be left empty.`); setActiveTab('roadmap'); return; }
      if (!p.description?.trim()) { setValidationError(`Phase ${i + 1} ("${p.title}") summary description cannot be left empty.`); setActiveTab('roadmap'); return; }
      if (!p.keyDeliverables || p.keyDeliverables.length === 0 || p.keyDeliverables.every(d => !d.trim())) {
        setValidationError(`Phase ${i + 1} ("${p.title}") must have at least 1 key deliverable.`);
        setActiveTab('roadmap');
        return;
      }
    }

    // 3. Validate Certificate & LOR
    if (!form.verifiedCertificate.trim()) { setValidationError('Verified Certificate Status cannot be left empty.'); setActiveTab('certificate'); return; }
    if (!form.lorEligibility.trim()) { setValidationError('Letter of Recommendation (LOR) Eligibility cannot be left empty.'); setActiveTab('certificate'); return; }

    setSubmitting(true);
    try {
      await onSave({
        ...form,
        company: form.organization || form.company,
        skills: form.skills.split(',').map(s => s.trim()).filter(Boolean),
        roadmap,
      });
      onClose();
    } catch (err) {
      console.error('Failed to save internship:', err);
      setValidationError('Failed to save internship. Please check all fields and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const defaultDomains = [
    'Cybersecurity',
    'Web Development',
    'AI & Machine Learning',
    'Data Science',
    'DevOps & Cloud',
    'Red Teaming',
    'Cyber Defense',
    'Ethical Hacking'
  ];

  const availableDomains = (internshipDomains && internshipDomains.length > 0)
    ? internshipDomains.map(d => d.name)
    : defaultDomains;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {validationError && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold rounded-xl flex items-center gap-2">
          <span className="shrink-0 font-black">⚠️ Validation Error:</span>
          <span>{validationError}</span>
        </div>
      )}

      {/* Sub-Header Tabs */}
      <div className="flex border-b border-slate-200 gap-2 font-bold text-xs">
        <button
          type="button"
          onClick={() => setActiveTab('basic')}
          className={cn(
            'px-4 py-2.5 rounded-t-xl transition-all border-b-2',
            activeTab === 'basic'
              ? 'border-emerald-600 text-emerald-800 bg-emerald-50/60 font-black'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          )}
        >
          1. Program Overview & Details *
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('roadmap')}
          className={cn(
            'px-4 py-2.5 rounded-t-xl transition-all border-b-2 flex items-center gap-2',
            activeTab === 'roadmap'
              ? 'border-emerald-600 text-emerald-800 bg-emerald-50/60 font-black'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          )}
        >
          2. Curriculum & Execution Roadmap * ({roadmap.length} Phases)
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('certificate')}
          className={cn(
            'px-4 py-2.5 rounded-t-xl transition-all border-b-2',
            activeTab === 'certificate'
              ? 'border-emerald-600 text-emerald-800 bg-emerald-50/60 font-black'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          )}
        >
          3. Certificate & LOR Eligibility *
        </button>
      </div>

      {/* TAB 1: BASIC & PROGRAM OVERVIEW */}
      {activeTab === 'basic' && (
        <div className="grid grid-cols-2 gap-x-6 gap-y-5 text-slate-900">
          <div className="col-span-2">
            <label className="label">Internship Title *</label>
            <input className="input" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="e.g. Cybersecurity Engineering Internship" required />
          </div>

          <ImageUploadInput
            label="Organization / Brand Logo (PNG / JPG file or URL) *"
            value={form.logo}
            onChange={(val) => setForm({ ...form, logo: val })}
            placeholder="https://... logo PNG link or click Upload PNG File"
          />

          <div>
            <label className="label">Organization / Company Name *</label>
            <input className="input" value={form.organization} onChange={e => setForm({ ...form, organization: e.target.value, company: e.target.value })} placeholder="e.g. A2Z Cyber Labs" required />
          </div>

          <div>
            <label className="label">Domain *</label>
            <select className="input" value={form.domain} onChange={e => setForm({ ...form, domain: e.target.value })} required>
              {availableDomains.map(name => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">Format (Mode) *</label>
            <input className="input" value={form.format} onChange={e => setForm({ ...form, format: e.target.value })} placeholder="e.g. Part-time (online)" required />
          </div>

          <div>
            <label className="label">Work Type *</label>
            <select className="input" value={form.type} onChange={e => setForm({ ...form, type: e.target.value as 'Full-time' | 'Part-time' })} required>
              <option value="Full-time">Full-time</option>
              <option value="Part-time">Part-time</option>
            </select>
          </div>

          <div>
            <label className="label">Duration *</label>
            <input className="input" value={form.duration} onChange={e => setForm({ ...form, duration: e.target.value })} placeholder="e.g. 1 month (or 3 months)" required />
          </div>

          <div>
            <label className="label">Stipend Amount *</label>
            <input className="input" value={form.stipend} onChange={e => setForm({ ...form, stipend: e.target.value })} placeholder="e.g. 0 (or ₹10,000/mo)" required />
          </div>

          <div>
            <label className="label">Location *</label>
            <input className="input" value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} placeholder="Remote / Hybrid" required />
          </div>

          <div>
            <label className="label">Status *</label>
            <select className="input" value={form.status} onChange={e => setForm({ ...form, status: e.target.value as Internship['status'] })} required>
              <option value="active">Active</option>
              <option value="upcoming">Upcoming</option>
              <option value="completed">Completed</option>
              <option value="applied">Applied</option>
            </select>
          </div>

          <div className="col-span-2">
            <label className="label">Skills Covered (comma-separated) *</label>
            <input className="input" value={form.skills} onChange={e => setForm({ ...form, skills: e.target.value })} placeholder="Penetration Testing, SIEM, Wireshark, Python" required />
          </div>

          <div className="col-span-2">
            <label className="label">Program Description *</label>
            <textarea className="input min-h-[90px]" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Overview of internship expectations, mentorship, and live projects..." required />
          </div>
        </div>
      )}

      {/* TAB 2: CURRICULUM & EXECUTION ROADMAP */}
      {activeTab === 'roadmap' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div>
              <h4 className="font-black text-sm text-slate-900">Internship Curriculum & Execution Roadmap *</h4>
              <p className="text-xs font-semibold text-slate-600">All phase duration, title, description, and deliverable fields are required</p>
            </div>
            <button
              type="button"
              onClick={addPhase}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" /> Add Roadmap Phase
            </button>
          </div>

          <div className="space-y-5">
            {roadmap.map((phase, pIdx) => (
              <div key={phase.id} className="bg-white border border-slate-300 rounded-2xl p-5 shadow-sm space-y-4">
                <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-3">
                  <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-black text-emerald-700 uppercase mb-1">Weeks Duration *</label>
                      <input
                        className="input font-extrabold text-xs text-emerald-800 bg-emerald-50"
                        value={phase.weeks}
                        onChange={e => updatePhase(pIdx, 'weeks', e.target.value)}
                        placeholder="e.g. WEEKS 1 - 2"
                        required
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-black text-slate-700 uppercase mb-1">Phase Title *</label>
                      <input
                        className="input font-black text-xs text-slate-900"
                        value={phase.title}
                        onChange={e => updatePhase(pIdx, 'title', e.target.value)}
                        placeholder={`e.g. Phase ${pIdx + 1}: Onboarding & Architecture Foundations`}
                        required
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => deletePhase(pIdx)}
                    className="p-2 text-rose-600 hover:bg-rose-50 rounded-xl transition-colors shrink-0 mt-4"
                    title="Delete Phase"
                  >
                    <Trash className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-black text-slate-800">Phase Summary & Objectives *</label>
                  <textarea
                    className="input min-h-[70px] text-xs font-semibold"
                    value={phase.description || ''}
                    onChange={e => updatePhase(pIdx, 'description', e.target.value)}
                    placeholder="Describe phase tasks, tools setup, architecture overview, and team protocol..."
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-black text-slate-800">Key Deliverables (1 item per line) *</label>
                  <textarea
                    className="input min-h-[80px] text-xs font-medium"
                    value={(phase.keyDeliverables || []).join('\n')}
                    onChange={e => updatePhase(pIdx, 'keyDeliverables', e.target.value.split('\n').map(s => s.trim()).filter(Boolean))}
                    placeholder="Git workflow & branch management setup&#10;Architecture walkthrough and code review standard setup&#10;First feature task completion & code submission"
                    required
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: CERTIFICATE & LOR ELIGIBILITY */}
      {activeTab === 'certificate' && (
        <div className="space-y-5 text-slate-900">
          <div>
            <label className="label">Verified Certificate Status *</label>
            <input
              className="input"
              value={form.verifiedCertificate}
              onChange={e => setForm({ ...form, verifiedCertificate: e.target.value })}
              placeholder="e.g. Included (or Included free)"
              required
            />
          </div>

          <div>
            <label className="label">Letter of Recommendation (LOR) Eligibility *</label>
            <input
              className="input"
              value={form.lorEligibility}
              onChange={e => setForm({ ...form, lorEligibility: e.target.value })}
              placeholder="e.g. Based on evaluation (or Performance-backed LOR from engineering leadership)"
              required
            />
          </div>
        </div>
      )}

      <CardFooter className="mt-6 flex justify-end gap-2 border-t border-slate-200 pt-4">
        <Button variant="ghost" type="button" onClick={onClose} disabled={submitting}>Cancel</Button>
        <Button variant="primary" type="submit" disabled={submitting}>
          {submitting ? 'Saving...' : internship ? 'Update Internship' : 'Create Internship'}
        </Button>
      </CardFooter>
    </form>
  );
};

/* ─── User Form Modal ─── */
const UserFormModal = ({ user, onSave, onClose }: {
  user?: UserProfile;
  onSave: (data: Partial<UserProfile>) => Promise<void>;
  onClose: () => void;
}) => {
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    fullName: user?.fullName || '',
    email: user?.email || '',
    role: user?.role || 'student' as UserRole,
    phone: user?.phone || '',
    bio: user?.bio || '',
    avatarUrl: user?.avatarUrl || '',
    a2zPoints: user?.a2zPoints || 0,
  });

  const [perms, setPerms] = useState<AdminPermissions>({
    viewPayments: user?.adminPermissions?.viewPayments ?? false,
    manageCourses: user?.adminPermissions?.manageCourses ?? true,
    manageInternships: user?.adminPermissions?.manageInternships ?? true,
    manageUsers: user?.adminPermissions?.manageUsers ?? false,
    issueCertificates: user?.adminPermissions?.issueCertificates ?? true,
    viewAnalytics: user?.adminPermissions?.viewAnalytics ?? true,
    manageDatabase: user?.adminPermissions?.manageDatabase ?? false,
  });

  const togglePerm = (key: keyof AdminPermissions) => {
    setPerms((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const isRoot = form.role === 'root_admin';
      const finalPerms: AdminPermissions = isRoot ? {
        viewPayments: true,
        manageCourses: true,
        manageInternships: true,
        manageUsers: true,
        issueCertificates: true,
        viewAnalytics: true,
        manageDatabase: true,
      } : perms;

      await onSave({
        ...form,
        isRootAdmin: isRoot,
        adminPermissions: finalPerms,
        a2zPoints: Number(form.a2zPoints),
      });
      onClose();
    } catch (err) {
      console.error('Failed to save user:', err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-2 gap-x-6 gap-y-5">
        <div className="col-span-2">
          <label className="label font-bold">Full Name</label>
          <input
            className="input"
            value={form.fullName}
            onChange={e => setForm({ ...form, fullName: e.target.value })}
            required
            placeholder="John Doe"
          />
        </div>

        <ImageUploadInput
          label="User Avatar Image (PNG / JPG file or URL)"
          value={form.avatarUrl}
          onChange={(val) => setForm({ ...form, avatarUrl: val })}
          placeholder="https://... avatar PNG link or click Upload PNG File"
        />

        <div className="col-span-2">
          <label className="label font-bold">Email Address</label>
          <input
            className="input"
            type="email"
            value={form.email}
            onChange={e => setForm({ ...form, email: e.target.value })}
            required
            disabled={!!user}
            placeholder="user@example.com"
          />
        </div>

        <div className="col-span-2">
          <label className="label font-bold">Account Role & Access Scope</label>
          <select className="input font-medium" value={form.role} onChange={e => setForm({ ...form, role: e.target.value as UserRole })}>
            <option value="student">Student (Standard Learner)</option>
            <option value="instructor">Instructor (Course & Internship Author)</option>
            <option value="admin">Sub-Admin (Restricted Admin)</option>
            <option value="root_admin">Root Admin (Super Admin - Full Control)</option>
          </select>

          {/* Specific Access Area Banner */}
          <div className="mt-3 p-3.5 rounded-lg border bg-surface-container/50">
            {form.role === 'student' && (
              <div>
                <p className="text-xs font-bold text-on-surface">Specific Access Area: Student Portal</p>
                <p className="text-[11px] text-on-surface-variant mt-0.5">Learner account. Access is restricted exclusively to public learning pages. Cannot access Admin/Instructor Console.</p>
              </div>
            )}
            {form.role === 'instructor' && (
              <div>
                <p className="text-xs font-bold text-purple-700">Specific Access Area: Instructor Console</p>
                <p className="text-[11px] text-on-surface-variant mt-0.5">Authorized for Course Creation, Internship Postings, and Student Messages. Financial payments, user roles, and database tools are restricted.</p>
              </div>
            )}
            {form.role === 'admin' && (
              <div>
                <p className="text-xs font-bold text-amber-700">Specific Access Area: Granular Sub-Admin Console</p>
                <p className="text-[11px] text-on-surface-variant mt-0.5">Access is determined by the specific feature permission checkboxes toggled below.</p>
              </div>
            )}
            {form.role === 'root_admin' && (
              <div>
                <p className="text-xs font-bold text-primary">Specific Access Area: Root Admin Super Console</p>
                <p className="text-[11px] text-on-surface-variant mt-0.5">Full unrestricted access across all platform modules (Overview, Courses, Internships, Users, Revenue Analytics, Certificates, and DB Manager).</p>
              </div>
            )}
          </div>
        </div>

        {/* Sub-Admin Permissions Box inside UserFormModal */}
        {form.role === 'admin' && (
          <div className="col-span-2 space-y-3 pt-3 border-t border-outline-variant/30">
            <h4 className="text-xs font-bold text-on-surface uppercase tracking-wider">Sub-Admin Access Permissions</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              <label className={`flex items-start gap-2.5 p-3 border rounded-lg cursor-pointer transition-all ${perms.viewPayments ? 'border-primary/40 bg-emerald-50/40' : 'border-outline-variant/30 bg-surface-container/20 opacity-80'}`}>
                <input type="checkbox" checked={perms.viewPayments} onChange={() => togglePerm('viewPayments')} className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <p className="text-xs font-bold text-on-surface">View Payments & Revenue</p>
                  <p className="text-[11px] text-on-surface-variant">Access monetary totals & revenue analytics</p>
                </div>
              </label>

              <label className={`flex items-start gap-2.5 p-3 border rounded-lg cursor-pointer transition-all ${perms.manageCourses ? 'border-primary/40 bg-emerald-50/40' : 'border-outline-variant/30 bg-surface-container/20 opacity-80'}`}>
                <input type="checkbox" checked={perms.manageCourses} onChange={() => togglePerm('manageCourses')} className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <p className="text-xs font-bold text-on-surface">Manage Courses</p>
                  <p className="text-[11px] text-on-surface-variant">Create, edit, or delete platform courses</p>
                </div>
              </label>

              <label className={`flex items-start gap-2.5 p-3 border rounded-lg cursor-pointer transition-all ${perms.manageInternships ? 'border-primary/40 bg-emerald-50/40' : 'border-outline-variant/30 bg-surface-container/20 opacity-80'}`}>
                <input type="checkbox" checked={perms.manageInternships} onChange={() => togglePerm('manageInternships')} className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <p className="text-xs font-bold text-on-surface">Manage Internships</p>
                  <p className="text-[11px] text-on-surface-variant">Post or edit internship listings</p>
                </div>
              </label>

              <label className={`flex items-start gap-2.5 p-3 border rounded-lg cursor-pointer transition-all ${perms.manageUsers ? 'border-primary/40 bg-emerald-50/40' : 'border-outline-variant/30 bg-surface-container/20 opacity-80'}`}>
                <input type="checkbox" checked={perms.manageUsers} onChange={() => togglePerm('manageUsers')} className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <p className="text-xs font-bold text-on-surface">Manage Users & Roles</p>
                  <p className="text-[11px] text-on-surface-variant">Manage directory & user permissions</p>
                </div>
              </label>

              <label className={`flex items-start gap-2.5 p-3 border rounded-lg cursor-pointer transition-all ${perms.issueCertificates ? 'border-primary/40 bg-emerald-50/40' : 'border-outline-variant/30 bg-surface-container/20 opacity-80'}`}>
                <input type="checkbox" checked={perms.issueCertificates} onChange={() => togglePerm('issueCertificates')} className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <p className="text-xs font-bold text-on-surface">Issue Certificates</p>
                  <p className="text-[11px] text-on-surface-variant">Generate verified certificates</p>
                </div>
              </label>

              <label className={`flex items-start gap-2.5 p-3 border rounded-lg cursor-pointer transition-all ${perms.viewAnalytics ? 'border-primary/40 bg-emerald-50/40' : 'border-outline-variant/30 bg-surface-container/20 opacity-80'}`}>
                <input type="checkbox" checked={perms.viewAnalytics} onChange={() => togglePerm('viewAnalytics')} className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <p className="text-xs font-bold text-on-surface">View Analytics</p>
                  <p className="text-[11px] text-on-surface-variant">Access performance analytics reports</p>
                </div>
              </label>
            </div>
          </div>
        )}

        <div>
          <label className="label font-bold">Points</label>
          <input className="input" type="number" min={0} value={form.a2zPoints} onChange={e => setForm({ ...form, a2zPoints: Number(e.target.value) })} />
        </div>

        <div>
          <label className="label font-bold">Phone</label>
          <input className="input" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="+91-XXXXXXXXXX" />
        </div>

        <div className="col-span-2">
          <label className="label font-bold">Bio</label>
          <textarea className="input min-h-[80px]" value={form.bio} onChange={e => setForm({ ...form, bio: e.target.value })} placeholder="Tell us about yourself..." />
        </div>
      </div>

      <CardFooter className="mt-6 flex justify-end gap-2">
        <Button variant="ghost" type="button" onClick={onClose} disabled={submitting}>Cancel</Button>
        <Button variant="primary" type="submit" disabled={submitting}>
          {submitting ? 'Saving...' : user ? 'Update User' : 'Create User'}
        </Button>
      </CardFooter>
    </form>
  );
};

/* ─── Admin Permissions & Role Config Modal ─── */
const AdminPermissionsModal = ({
  targetUser,
  onSave,
  onClose,
}: {
  targetUser: UserProfile;
  onSave: (role: UserRole, isRootAdmin: boolean, permissions: AdminPermissions) => Promise<void>;
  onClose: () => void;
}) => {
  const [submitting, setSubmitting] = useState(false);
  const [role, setRole] = useState<UserRole>(targetUser.role || 'admin');
  const [isRoot, setIsRoot] = useState<boolean>(targetUser.isRootAdmin || targetUser.role === 'root_admin');

  const [perms, setPerms] = useState<AdminPermissions>({
    viewPayments: targetUser.adminPermissions?.viewPayments ?? false,
    manageCourses: targetUser.adminPermissions?.manageCourses ?? true,
    manageInternships: targetUser.adminPermissions?.manageInternships ?? true,
    manageUsers: targetUser.adminPermissions?.manageUsers ?? false,
    issueCertificates: targetUser.adminPermissions?.issueCertificates ?? true,
    viewAnalytics: targetUser.adminPermissions?.viewAnalytics ?? true,
    manageDatabase: targetUser.adminPermissions?.manageDatabase ?? false,
  });

  const togglePerm = (key: keyof AdminPermissions) => {
    setPerms((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const finalRole = isRoot ? 'root_admin' : role;
      const finalPerms: AdminPermissions = isRoot
        ? {
            viewPayments: true,
            manageCourses: true,
            manageInternships: true,
            manageUsers: true,
            issueCertificates: true,
            viewAnalytics: true,
            manageDatabase: true,
          }
        : perms;
      await onSave(finalRole, isRoot, finalPerms);
      onClose();
    } catch (err) {
      console.error('Failed to save admin permissions:', err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSave} className="space-y-6">
      {/* Target User Banner */}
      <div className="flex items-center gap-4 p-4 bg-surface-container border border-outline-variant/30 rounded-lg">
        <div className="h-12 w-12 rounded-full bg-primary-gradient flex items-center justify-center font-bold text-slate-950 shrink-0 text-lg">
          {targetUser.fullName?.charAt(0) || targetUser.email?.charAt(0) || 'U'}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-on-surface truncate">{targetUser.fullName || 'User'}</p>
          <p className="text-xs text-on-surface-variant truncate">{targetUser.email}</p>
          <p className="text-[11px] font-semibold text-slate-500 mt-0.5">User ID: {targetUser.id}</p>
        </div>
      </div>

      {/* Role Selection */}
      <div className="space-y-2">
        <label className="label text-sm font-bold text-on-surface">Select User Role</label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <button
            type="button"
            onClick={() => { setRole('root_admin'); setIsRoot(true); }}
            className={`p-3 rounded-lg border text-left transition-all ${isRoot ? 'border-primary bg-primary/10 text-primary font-bold shadow-sm' : 'border-outline-variant/30 hover:bg-surface-container text-on-surface-variant'}`}
          >
            <p className="text-xs font-bold">Root Admin</p>
            <p className="text-[11px] text-on-surface-variant/70 mt-0.5">Unrestricted Super Admin</p>
          </button>

          <button
            type="button"
            onClick={() => { setRole('admin'); setIsRoot(false); }}
            className={`p-3 rounded-lg border text-left transition-all ${role === 'admin' && !isRoot ? 'border-amber-500 bg-amber-50 text-amber-700 font-bold shadow-sm' : 'border-outline-variant/30 hover:bg-surface-container text-on-surface-variant'}`}
          >
            <p className="text-xs font-bold">Sub-Admin</p>
            <p className="text-[11px] text-on-surface-variant/70 mt-0.5">Granular Restricted Admin</p>
          </button>

          <button
            type="button"
            onClick={() => { setRole('instructor'); setIsRoot(false); }}
            className={`p-3 rounded-lg border text-left transition-all ${role === 'instructor' ? 'border-purple-500 bg-purple-50 text-purple-700 font-bold shadow-sm' : 'border-outline-variant/30 hover:bg-surface-container text-on-surface-variant'}`}
          >
            <p className="text-xs font-bold">Instructor</p>
            <p className="text-[11px] text-on-surface-variant/70 mt-0.5">Course Content Author</p>
          </button>

          <button
            type="button"
            onClick={() => { setRole('student'); setIsRoot(false); }}
            className={`p-3 rounded-lg border text-left transition-all ${role === 'student' ? 'border-emerald-500 bg-emerald-50 text-emerald-700 font-bold shadow-sm' : 'border-outline-variant/30 hover:bg-surface-container text-on-surface-variant'}`}
          >
            <p className="text-xs font-bold">Student</p>
            <p className="text-[11px] text-on-surface-variant/70 mt-0.5">Standard Learner</p>
          </button>
        </div>
      </div>

      {/* Permissions Toggles */}
      {(role === 'admin' || role === 'root_admin') && (
        <div className="space-y-4 pt-4 border-t border-outline-variant/30">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-bold text-on-surface">Sub-Admin Restrictions & Permissions</h4>
              <p className="text-xs text-on-surface-variant mt-0.5">
                {isRoot ? 'Root Admins bypass all restrictions with full access.' : 'Toggle specific features accessible to this sub-admin user.'}
              </p>
            </div>
            {isRoot && (
              <Badge variant="primary" size="sm">Full Unrestricted</Badge>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* View Payments & Revenue */}
            <label className={`flex items-start gap-3 p-3.5 border rounded-lg cursor-pointer transition-all ${perms.viewPayments || isRoot ? 'border-primary/40 bg-emerald-50/50' : 'border-outline-variant/30 bg-surface-container/30 opacity-85'}`}>
              <input
                type="checkbox"
                checked={isRoot || perms.viewPayments}
                disabled={isRoot}
                onChange={() => togglePerm('viewPayments')}
                className="mt-1 h-4 w-4 shrink-0"
              />
              <div>
                <p className="text-xs font-bold text-on-surface flex items-center gap-1.5">
                  View Payments & Financial Revenue
                </p>
                <p className="text-[11px] text-on-surface-variant mt-0.5">
                  When disabled, financial totals, revenue metrics, and course prices are masked/hidden.
                </p>
              </div>
            </label>

            {/* Manage Courses */}
            <label className={`flex items-start gap-3 p-3.5 border rounded-lg cursor-pointer transition-all ${perms.manageCourses || isRoot ? 'border-primary/40 bg-emerald-50/50' : 'border-outline-variant/30 bg-surface-container/30 opacity-85'}`}>
              <input
                type="checkbox"
                checked={isRoot || perms.manageCourses}
                disabled={isRoot}
                onChange={() => togglePerm('manageCourses')}
                className="mt-1 h-4 w-4 shrink-0"
              />
              <div>
                <p className="text-xs font-bold text-on-surface flex items-center gap-1.5">
                  Manage Courses
                </p>
                <p className="text-[11px] text-on-surface-variant mt-0.5">
                  Create, edit, publish, or remove platform courses.
                </p>
              </div>
            </label>

            {/* Manage Internships */}
            <label className={`flex items-start gap-3 p-3.5 border rounded-lg cursor-pointer transition-all ${perms.manageInternships || isRoot ? 'border-primary/40 bg-emerald-50/50' : 'border-outline-variant/30 bg-surface-container/30 opacity-85'}`}>
              <input
                type="checkbox"
                checked={isRoot || perms.manageInternships}
                disabled={isRoot}
                onChange={() => togglePerm('manageInternships')}
                className="mt-1 h-4 w-4 shrink-0"
              />
              <div>
                <p className="text-xs font-bold text-on-surface flex items-center gap-1.5">
                  Manage Internships
                </p>
                <p className="text-[11px] text-on-surface-variant mt-0.5">
                  Create, update, or remove internship listings.
                </p>
              </div>
            </label>

            {/* Manage Users */}
            <label className={`flex items-start gap-3 p-3.5 border rounded-lg cursor-pointer transition-all ${perms.manageUsers || isRoot ? 'border-primary/40 bg-emerald-50/50' : 'border-outline-variant/30 bg-surface-container/30 opacity-85'}`}>
              <input
                type="checkbox"
                checked={isRoot || perms.manageUsers}
                disabled={isRoot}
                onChange={() => togglePerm('manageUsers')}
                className="mt-1 h-4 w-4 shrink-0"
              />
              <div>
                <p className="text-xs font-bold text-on-surface flex items-center gap-1.5">
                  Manage Users & Roles
                </p>
                <p className="text-[11px] text-on-surface-variant mt-0.5">
                  Edit user details, modify roles, and set access permissions.
                </p>
              </div>
            </label>

            {/* Issue Certificates */}
            <label className={`flex items-start gap-3 p-3.5 border rounded-lg cursor-pointer transition-all ${perms.issueCertificates || isRoot ? 'border-primary/40 bg-emerald-50/50' : 'border-outline-variant/30 bg-surface-container/30 opacity-85'}`}>
              <input
                type="checkbox"
                checked={isRoot || perms.issueCertificates}
                disabled={isRoot}
                onChange={() => togglePerm('issueCertificates')}
                className="mt-1 h-4 w-4 shrink-0"
              />
              <div>
                <p className="text-xs font-bold text-on-surface flex items-center gap-1.5">
                  Issue Certificates
                </p>
                <p className="text-[11px] text-on-surface-variant mt-0.5">
                  Generate and issue verified student certificates.
                </p>
              </div>
            </label>

            {/* View Analytics */}
            <label className={`flex items-start gap-3 p-3.5 border rounded-lg cursor-pointer transition-all ${perms.viewAnalytics || isRoot ? 'border-primary/40 bg-emerald-50/50' : 'border-outline-variant/30 bg-surface-container/30 opacity-85'}`}>
              <input
                type="checkbox"
                checked={isRoot || perms.viewAnalytics}
                disabled={isRoot}
                onChange={() => togglePerm('viewAnalytics')}
                className="mt-1 h-4 w-4 shrink-0"
              />
              <div>
                <p className="text-xs font-bold text-on-surface flex items-center gap-1.5">
                  View Analytics
                </p>
                <p className="text-[11px] text-on-surface-variant mt-0.5">
                  Access platform-wide performance analytics reports.
                </p>
              </div>
            </label>

            {/* Manage Database */}
            <label className={`flex items-start gap-3 p-3.5 border rounded-lg cursor-pointer transition-all ${perms.manageDatabase || isRoot ? 'border-primary/40 bg-emerald-50/50' : 'border-outline-variant/30 bg-surface-container/30 opacity-85'}`}>
              <input
                type="checkbox"
                checked={isRoot || perms.manageDatabase}
                disabled={isRoot}
                onChange={() => togglePerm('manageDatabase')}
                className="mt-1 h-4 w-4 shrink-0"
              />
              <div>
                <p className="text-xs font-bold text-on-surface flex items-center gap-1.5">
                  Firestore DB Manager
                </p>
                <p className="text-[11px] text-on-surface-variant mt-0.5">
                  Access Firestore DB manager tool and collection cleanup.
                </p>
              </div>
            </label>
          </div>
        </div>
      )}

      <CardFooter className="mt-6 flex justify-end gap-3 pt-4 border-t border-outline-variant/30">
        <Button variant="ghost" type="button" onClick={onClose} disabled={submitting}>Cancel</Button>
        <Button variant="primary" type="submit" disabled={submitting}>
          {submitting ? 'Saving Permissions...' : 'Save Role & Permissions'}
        </Button>
      </CardFooter>
    </form>
  );
};

/* ─── Message/Notification Form Modal ─── */
const MessageFormModal = ({ notification, onSave, onClose, allUsers }: {
  notification?: Notification;
  onSave: (data: Partial<Notification> & { sendToAll?: boolean }) => Promise<void>;
  onClose: () => void;
  allUsers: UserProfile[];
}) => {
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    userId: notification?.userId || '',
    type: notification?.type || 'reminder' as NotificationType,
    title: notification?.title || '',
    message: notification?.message || '',
    sendToAll: false,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await onSave({ ...form });
      onClose();
    } catch (err) {
      console.error('Failed to send notification:', err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className="label flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.sendToAll}
              onChange={e => setForm({ ...form, sendToAll: e.target.checked })}
              className="w-4 h-4 rounded border-outline-variant/40 text-primary focus:ring-primary"
            />
            Send to all users (broadcast)
          </label>
        </div>
        {!form.sendToAll && (
          <div className="col-span-2">
            <label className="label">Recipient</label>
            <select className="input" value={form.userId} onChange={e => setForm({ ...form, userId: e.target.value })} required>
              <option value="">Select a user...</option>
              {allUsers.map(user => (
                <option key={user.id} value={user.id}>
                  {user.fullName || user.email} ({user.email})
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="col-span-2">
          <label className="label">Type</label>
          <select className="input" value={form.type} onChange={e => setForm({ ...form, type: e.target.value as NotificationType })}>
            <option value="reminder">Reminder</option>
            <option value="new-course">New Course</option>
            <option value="course-launch">Course Launch</option>
            <option value="enrollment">Enrollment</option>
            <option value="payment">Payment</option>
            <option value="assignment-due">Assignment Due</option>
            <option value="quiz-available">Quiz Available</option>
            <option value="certificate-ready">Certificate Ready</option>
            <option value="points-earned">Points Earned</option>
            <option value="discount">Discount</option>
            <option value="referral-bonus">Referral Bonus</option>
            <option value="achievement">Achievement</option>
            <option value="registration">Registration</option>
          </select>
        </div>
        <div className="col-span-2">
          <label className="label">Title</label>
          <input className="input" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required placeholder="Notification title" />
        </div>
        <div className="col-span-2">
          <label className="label">Message</label>
          <textarea className="input min-h-[100px]" value={form.message} onChange={e => setForm({ ...form, message: e.target.value })} required placeholder="Notification message content" />
        </div>
      </div>
      <CardFooter className="mt-6 flex justify-end gap-2">
        <Button variant="ghost" type="button" onClick={onClose} disabled={submitting}>Cancel</Button>
        <Button variant="primary" type="submit" disabled={submitting}>
          {submitting ? 'Sending...' : notification ? 'Update Notification' : 'Send Notification'}
        </Button>
      </CardFooter>
    </form>
  );
};

/* ─── Delete Confirm Modal ─── */
const DeleteConfirmModal = ({ title, onConfirm, onClose }: {
  title: string;
  onConfirm: () => void;
  onClose: () => void;
}) => (
  <div className="space-y-4">
    <div className="flex items-center gap-3 p-4 bg-error/5 border border-error/30">
      <Trash className="h-6 w-6 text-error flex-shrink-0" />
      <div>
        <p className="font-label-sm text-label-sm text-on-surface">Delete "{title}"?</p>
        <p className="text-sm text-on-surface-variant mt-1">
          This action cannot be undone. The item will be permanently removed.
        </p>
      </div>
    </div>
    <CardFooter className="flex justify-end gap-2">
      <Button variant="ghost" onClick={onClose}>Cancel</Button>
      <Button variant="primary" className="bg-error hover:bg-red-700" onClick={onConfirm}>
        Delete
      </Button>
    </CardFooter>
  </div>
);

interface AdminProps {
  initialTab?: 'overview' | 'courses' | 'internships' | 'users' | 'payments' | 'messages' | 'analytics';
  onTabChange?: (tab: any) => void;
  userProfile?: UserProfile | null;
}

/* ─── Main Admin Component ─── */
export const Admin = ({ initialTab = 'overview', onTabChange, userProfile }: AdminProps) => {
  const { success, error: toastError } = useToastHelpers();
  const [activeTab, setActiveTabState] = useState<'overview' | 'courses' | 'internships' | 'users' | 'payments' | 'messages' | 'analytics'>(initialTab);

  const isRoot = userProfile?.isRootAdmin || userProfile?.role === 'root_admin' || !userProfile;
  const userPerms = userProfile?.adminPermissions;
  const canViewPayments = isRoot || (userPerms?.viewPayments ?? true);
  const canManageCourses = isRoot || (userPerms?.manageCourses ?? true);
  const canManageInternships = isRoot || (userPerms?.manageInternships ?? true);
  const canManageUsers = isRoot || (userPerms?.manageUsers ?? true);
  const canManageDatabase = isRoot || (userPerms?.manageDatabase ?? false);

  useEffect(() => {
    if (initialTab && ['overview', 'courses', 'internships', 'users', 'payments', 'messages', 'analytics'].includes(initialTab)) {
      setActiveTabState(initialTab);
    }
  }, [initialTab]);

  const setActiveTab = (tab: any) => {
    setActiveTabState(tab);
    if (onTabChange) onTabChange(tab);
  };
  const [analytics, setAnalytics] = useState<AdminAnalytics | null>(null);
  const [allCourses, setAllCourses] = useState<Course[]>([]);
  const [allInternships, setAllInternships] = useState<Internship[]>([]);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [allNotifications, setAllNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [internshipDomains, setInternshipDomains] = useState<InternshipDomain[]>([]);

  // Search & filter states
  const [courseSearch, setCourseSearch] = useState('');
  const [courseFilter, setCourseFilter] = useState<CourseStatus | 'all'>('all');
  const [internshipSearch, setInternshipSearch] = useState('');
  const [internshipFilter, setInternshipFilter] = useState<Internship['status'] | 'all'>('all');
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState<UserRole | 'all'>('all');
  const [notificationSearch, setNotificationSearch] = useState('');
  const [notificationTypeFilter, setNotificationTypeFilter] = useState<NotificationType | 'all'>('all');
  const [notificationReadFilter, setNotificationReadFilter] = useState<'all' | 'read' | 'unread'>('all');

  // Modal form state
  const [editCourse, setEditCourse] = useState<Course | undefined>(undefined);
  const [editInternship, setEditInternship] = useState<Internship | undefined>(undefined);
  const [editUser, setEditUser] = useState<UserProfile | undefined>(undefined);
  const [editingNotification, setEditingNotification] = useState<Notification | undefined>(undefined);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string; type: 'course' | 'internship' | 'user' | 'notification' } | null>(null);
  const [showCourseForm, setShowCourseForm] = useState(false);
  const [showInternshipForm, setShowInternshipForm] = useState(false);
  const [showUserForm, setShowUserForm] = useState(false);
  const [showMessageForm, setShowMessageForm] = useState(false);
  const [showRoleToggle, setShowRoleToggle] = useState(false);
  const [userToToggleRole, setUserToToggleRole] = useState<UserProfile | null>(null);
  const [showClearDbConfirm, setShowClearDbConfirm] = useState(false);

  const handleClearDb = async () => {
    try {
      await clearAllFirestoreCollections();
      setAllCourses([]);
      setAllInternships([]);
      setAllUsers([]);
      setAllNotifications([]);
      setAnalytics({
        totalStudents: 0, activeStudents: 0, totalCourses: 0,
        totalInternships: 0, revenue: 0, certificatesIssued: 0,
        studentsByDomain: [], enrollmentTrend: [], revenueTrend: [],
        topCourses: [], completionRate: 0, averageRating: 0,
      });
      setShowClearDbConfirm(false);
      success('Database Cleared', 'All documents in Firestore collections have been deleted.');
    } catch (err) {
      toastError('Error clearing database', err instanceof Error ? err.message : 'Unknown error');
    }
  };

  // Load data from Firestore
  const loadUsers = useCallback(async () => {
    try {
      const usersData = await fetchFirebaseCollection<UserProfile>('users');
      setAllUsers(Array.isArray(usersData) ? usersData : []);
    } catch (error) {
      console.error('Failed to load users:', error);
    }
  }, []);

  const loadNotifications = useCallback(async () => {
    try {
      const notifsData = await fetchFirebaseCollection<Notification>('notifications');
      setAllNotifications(Array.isArray(notifsData) ? notifsData.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()) : []);
    } catch (error) {
      console.error('Failed to load notifications:', error);
    }
  }, []);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [
          analyticsData,
          coursesData,
          internshipsData,
          domainsData,
          usersData,
          notificationsData,
        ] = await Promise.all([
          getAdminAnalytics(),
          fetchFirebaseCollection<Course>('courses'),
          fetchFirebaseCollection<Internship>('internships'),
          fetchFirebaseCollection<InternshipDomain>('internship_domains'),
          fetchFirebaseCollection<UserProfile>('users'),
          fetchFirebaseCollection<Notification>('notifications'),
        ]);

        setAnalytics(analyticsData);
        setAllCourses(Array.isArray(coursesData) ? coursesData : []);
        setAllInternships(Array.isArray(internshipsData) ? internshipsData : []);
        setInternshipDomains(Array.isArray(domainsData) ? domainsData : []);
        setAllUsers(Array.isArray(usersData) ? usersData : []);
        setAllNotifications(Array.isArray(notificationsData) ? notificationsData.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()) : []);
      } catch (error) {
        console.error('Failed to load admin data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // Filtered data
  const filteredCourses = useMemo(() => {
    let list = [...allCourses];
    if (courseFilter !== 'all') list = list.filter(c => c.status === courseFilter);
    if (courseSearch) {
      const q = courseSearch.toLowerCase();
      list = list.filter(c => c.title.toLowerCase().includes(q) || c.instructor.toLowerCase().includes(q) || c.category.toLowerCase().includes(q));
    }
    return list;
  }, [allCourses, courseSearch, courseFilter]);

  const filteredInternships = useMemo(() => {
    let list = [...allInternships];
    if (internshipFilter !== 'all') list = list.filter(i => i.status === internshipFilter);
    if (internshipSearch) {
      const q = internshipSearch.toLowerCase();
      list = list.filter(i => i.title.toLowerCase().includes(q) || i.company.toLowerCase().includes(q) || i.domain.toLowerCase().includes(q));
    }
    return list;
  }, [allInternships, internshipSearch, internshipFilter]);

  const filteredUsers = useMemo(() => {
    let list = [...allUsers];
    if (userRoleFilter !== 'all') list = list.filter(u => u.role === userRoleFilter);
    if (userSearch) {
      const q = userSearch.toLowerCase();
      list = list.filter(u => (u.fullName?.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)));
    }
    return list;
  }, [allUsers, userSearch, userRoleFilter]);

  const filteredNotifications = useMemo(() => {
    let list = [...allNotifications];
    if (notificationTypeFilter !== 'all') list = list.filter(n => n.type === notificationTypeFilter);
    if (notificationReadFilter !== 'all') list = list.filter(n => notificationReadFilter === 'read' ? n.read : !n.read);
    if (notificationSearch) {
      const q = notificationSearch.toLowerCase();
      list = list.filter(n => n.title.toLowerCase().includes(q) || n.message.toLowerCase().includes(q));
    }
    return list;
  }, [allNotifications, notificationSearch, notificationTypeFilter, notificationReadFilter]);

  // CRUD handlers with Firestore
  const handleSaveCourse = async (data: Partial<Course>) => {
    try {
      if (editCourse) {
        await updateCourse(editCourse.id, data);
        setAllCourses(prev => prev.map(c => c.id === editCourse.id ? { ...c, ...data, updatedAt: new Date().toISOString() } as Course : c));
        success('Success', 'Course updated successfully');
      } else {
        const rawCourse: Course = {
          id: `course-${Date.now()}`,
          slug: data.title?.toLowerCase().replace(/\s+/g, '-') || '',
          thumbnail: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=300&q=60',
          rating: 0,
          reviewCount: 0,
          studentCount: 0,
          totalLessons: 0,
          totalModules: 0,
          whatYouLearn: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          ...data,
        } as Course;
        const newCourse = cleanObject(rawCourse);
        await createCourse(newCourse);
        setAllCourses(prev => [newCourse, ...prev]);
        success('Success', 'Course created successfully');
      }
    } catch (err) {
      toastError('Error saving course', err instanceof Error ? err.message : 'Unknown error');
      throw err;
    }
  };

  const handleDeleteCourse = async (id: string) => {
    try {
      await deleteCourse(id);
      setAllCourses(prev => prev.filter(c => c.id !== id));
      setDeleteTarget(null);
      success('Success', 'Course deleted successfully');
    } catch (err) {
      toastError('Error deleting course', err instanceof Error ? err.message : 'Unknown error');
    }
  };

  const handleSaveInternship = async (data: Partial<Internship>) => {
    try {
      if (editInternship) {
        await updateInternship(editInternship.id, data);
        setAllInternships(prev => prev.map(i => i.id === editInternship.id ? { ...i, ...data } as Internship : i));
        success('Success', 'Internship updated successfully');
      } else {
        const domainObj = internshipDomains.find(d => d.name === data.domain);
        const rawInternship: Internship = {
          id: `intern-${Date.now()}`,
          domainId: domainObj?.id || '',
          startDate: new Date().toISOString(),
          endDate: new Date().toISOString(),
          applicationDeadline: new Date().toISOString(),
          logo: 'https://picsum.photos/seed/new/60/60',
          progress: 0,
          ...data,
        } as Internship;
        const newInternship = cleanObject(rawInternship);
        await createInternship(newInternship);
        setAllInternships(prev => [newInternship, ...prev]);
        success('Success', 'Internship created successfully');
      }
    } catch (err) {
      toastError('Error saving internship', err instanceof Error ? err.message : 'Unknown error');
      throw err;
    }
  };

  const handleDeleteInternship = async (id: string) => {
    try {
      await deleteInternship(id);
      setAllInternships(prev => prev.filter(i => i.id !== id));
      setDeleteTarget(null);
      success('Success', 'Internship deleted successfully');
    } catch (err) {
      toastError('Error deleting internship', err instanceof Error ? err.message : 'Unknown error');
    }
  };

  // User CRUD handlers
  const handleSaveUser = async (data: Partial<UserProfile>) => {
    try {
      if (editUser) {
        await updateDoc(doc(db, 'users', editUser.id), {
          ...data,
          updatedAt: new Date().toISOString(),
        });
        setAllUsers(prev => prev.map(u => u.id === editUser.id ? { ...u, ...data, updatedAt: new Date().toISOString() } as UserProfile : u));
        success('Success', 'User updated successfully');
      } else {
        const newUser: UserProfile = {
          id: `user-${Date.now()}`,
          email: data.email || '',
          fullName: data.fullName || '',
          role: data.role || 'student',
          avatarUrl: data.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(data.fullName || 'User')}&background=random`,
          phone: '',
          bio: '',
          enrolledCourses: 0,
          enrolledInternships: 0,
          a2zPoints: 100,
          joinDate: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          ...data,
        } as UserProfile;
        await setDoc(doc(db, 'users', newUser.id), newUser);
        setAllUsers(prev => [newUser, ...prev]);
        success('Success', 'User created successfully');
      }
    } catch (err) {
      toastError('Error saving user', err instanceof Error ? err.message : 'Unknown error');
      throw err;
    }
  };

  const handleDeleteUser = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'users', id));
      setAllUsers(prev => prev.filter(u => u.id !== id));
      setDeleteTarget(null);
      success('Success', 'User deleted successfully');
    } catch (err) {
      toastError('Error deleting user', err instanceof Error ? err.message : 'Unknown error');
    }
  };

  const handleSaveUserPermissions = async (
    userId: string,
    newRole: UserRole,
    isRootAdmin: boolean,
    permissions: AdminPermissions
  ) => {
    try {
      const cleanData = cleanObject({
        role: newRole,
        isRootAdmin,
        adminPermissions: permissions,
        updatedAt: new Date().toISOString(),
      });
      await updateDoc(doc(db, 'users', userId), cleanData);
      setAllUsers(prev => prev.map(u => u.id === userId ? {
        ...u,
        role: newRole,
        isRootAdmin,
        adminPermissions: permissions,
        updatedAt: new Date().toISOString(),
      } as UserProfile : u));
      setShowRoleToggle(false);
      setUserToToggleRole(null);
      success('Success', `Admin permissions updated for user.`);
    } catch (err) {
      toastError('Error updating role & permissions', err instanceof Error ? err.message : 'Unknown error');
    }
  };

  const toggleNotificationRead = async (id: string, read: boolean) => {
    try {
      await updateDoc(doc(db, 'notifications', id), { read });
      setAllNotifications(prev => prev.map(n => n.id === id ? { ...n, read } : n));
    } catch (err) {
      toastError('Error updating notification', err instanceof Error ? err.message : 'Unknown error');
    }
  };

  const handleDeleteNotification = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'notifications', id));
      setAllNotifications(prev => prev.filter(n => n.id !== id));
      setDeleteTarget(null);
      success('Success', 'Notification deleted successfully');
    } catch (err) {
      toastError('Error deleting notification', err instanceof Error ? err.message : 'Unknown error');
    }
  };

  const sendBulkNotification = async (userIds: string[], notification: Omit<Notification, 'id' | 'createdAt' | 'read'>) => {
    if (userIds.length === 0) return;
    for (let i = 0; i < userIds.length; i += 450) {
      const batch = writeBatch(db);
      const chunk = userIds.slice(i, i + 450);
      chunk.forEach(userId => {
        const notifRef = doc(db, 'notifications', `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
        batch.set(notifRef, {
          ...notification,
          userId,
          read: false,
          createdAt: new Date().toISOString(),
        });
      });
      await batch.commit();
    }
    await loadNotifications();
  };

  const handleSaveNotification = async (data: Partial<Notification> & { sendToAll?: boolean }) => {
    try {
      if (editingNotification) {
        await updateDoc(doc(db, 'notifications', editingNotification.id), {
          ...data,
          updatedAt: new Date().toISOString(),
        });
        setAllNotifications(prev => prev.map(n => n.id === editingNotification.id ? { ...n, ...data, updatedAt: new Date().toISOString() } as Notification : n));
        success('Success', 'Notification updated successfully');
      } else if (data.sendToAll) {
        const userIds = allUsers.map(u => u.id);
        await sendBulkNotification(userIds, {
          type: data.type || 'reminder',
          title: data.title || '',
          message: data.message || '',
          userId: '',
        });
        success('Success', `Notification broadcasted to ${userIds.length} users`);
      } else {
        const newNotification: Notification = {
          id: `notif-${Date.now()}`,
          userId: data.userId || '',
          type: data.type || 'reminder',
          title: data.title || '',
          message: data.message || '',
          read: false,
          createdAt: new Date().toISOString(),
          ...data,
        } as Notification;
        await setDoc(doc(db, 'notifications', newNotification.id), newNotification);
        setAllNotifications(prev => [newNotification, ...prev]);
        success('Success', 'Notification sent successfully');
      }
    } catch (err) {
      toastError('Error sending notification', err instanceof Error ? err.message : 'Unknown error');
      throw err;
    }
  };

  const tabs = [
    { id: 'overview' as const, label: 'Overview', icon: LayoutDashboard },
    { id: 'courses' as const, label: 'Courses', icon: BookOpen },
    { id: 'internships' as const, label: 'Internships', icon: GraduationCap },
    { id: 'users' as const, label: 'Users', icon: Users },
    ...(canViewPayments ? [{ id: 'payments' as const, label: 'Payments', icon: CreditCard }] : []),
    { id: 'messages' as const, label: 'Messages', icon: MessageSquare },
    { id: 'analytics' as const, label: 'Analytics', icon: BarChart3 },
  ];

  if (loading) return <div className="text-center py-16 text-on-surface-variant">Loading admin panel...</div>;

  return (
    <ModalProvider>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="font-headline-md text-headline-md text-on-surface">Admin Panel</h1>
            <p className="text-body text-on-surface-variant mt-1">
              Manage courses, internships, users, and platform analytics
            </p>
          </div>
          <div className="flex items-center gap-3">
            {canManageDatabase && (
              <Button variant="outline" size="sm" icon={<Database className="h-4 w-4 text-error" />} className="text-error border-error/30 hover:bg-error/10" onClick={() => setShowClearDbConfirm(true)}>
                Manage / Clear DB
              </Button>
            )}
            <Badge variant={isRoot ? 'primary' : 'warning'} size="lg" className="gap-2">
              <Shield className="h-4 w-4" />
              {isRoot ? 'Root Admin' : 'Sub-Admin Access'}
            </Badge>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex flex-wrap gap-1 bg-surface-container p-1 overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex items-center gap-2 px-4 py-2.5 text-label-sm font-label-sm transition-all whitespace-nowrap',
                  activeTab === tab.id
                    ? 'bg-surface-container-lowest text-primary shadow-level-1'
                    : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
                )}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* PAYMENTS TAB */}
        {activeTab === 'payments' && (
          <PaymentsManager permissions={userPerms} />
        )}

        {/* OVERVIEW TAB */}
        {activeTab === 'overview' && analytics && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard
                label="Total Students"
                value={formatCount(analytics.totalStudents)}
                icon={Users}
                sub={`${analytics.activeStudents.toLocaleString()} active`}
                color="bg-primary-fixed"
              />
              <StatCard
                label="Courses"
                value={formatCount(analytics.totalCourses)}
                icon={BookOpen}
                sub={analytics.topCourses[0]?.title}
                color="bg-emerald-50"
              />
              <StatCard
                label="Internships"
                value={formatCount(analytics.totalInternships)}
                icon={GraduationCap}
                color="bg-orange-50"
              />
              <StatCard
                label="Revenue"
                value={canViewPayments ? formatCurrency(analytics.revenue) : '•••• (Restricted)'}
                icon={DollarSign}
                sub={canViewPayments ? `${formatCount(analytics.certificatesIssued)} certificates issued` : 'Restricted'}
                color="bg-amber-50"
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card variant="default" padding="lg">
                <CardHeader>
                  <CardTitle>Enrollment Trend (12 Months)</CardTitle>
                  <CardDescription>Monthly new student enrollments</CardDescription>
                </CardHeader>
                <CardContent>
                  <MiniBar data={analytics.enrollmentTrend.map(d => ({ label: d.date, value: d.count }))} color="bg-primary" />
                </CardContent>
              </Card>

              <Card variant="default" padding="lg">
                <CardHeader>
                  <CardTitle>Revenue Trend (12 Months)</CardTitle>
                  <CardDescription>Monthly revenue in INR</CardDescription>
                </CardHeader>
                <CardContent>
                  <MiniBar data={analytics.revenueTrend.map(d => ({ label: d.date, value: d.amount }))} color="bg-emerald-500" />
                </CardContent>
              </Card>

              <Card variant="default" padding="lg">
                <CardHeader>
                  <CardTitle>Students by Domain</CardTitle>
                  <CardDescription>Distribution across tech domains</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {analytics.studentsByDomain.map((domain) => (
                      <div key={domain.domain} className="flex items-center gap-3">
                        <div className="w-24 text-sm font-medium text-on-surface-variant">{domain.domain}</div>
                        <div className="flex-1 h-2 bg-surface-container overflow-hidden">
                          <div
                            className="h-full bg-primary transition-all"
                            style={{ width: `${(domain.count / Math.max(...analytics.studentsByDomain.map(d => d.count))) * 100}%` }}
                          />
                        </div>
                        <div className="w-20 text-right text-sm font-semibold text-on-surface">{formatCount(domain.count)}</div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card variant="default" padding="lg">
                <CardHeader>
                  <CardTitle>Top Courses</CardTitle>
                  <CardDescription>By enrollment count</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {analytics.topCourses.map((course, idx) => (
                      <div key={course.courseId} className="flex items-center justify-between p-3 bg-surface-container">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                            {idx + 1}
                          </div>
                          <div>
                            <p className="font-medium text-on-surface">{course.title}</p>
                            <p className="text-xs text-on-surface-variant">{formatCount(course.enrollments)} enrollments</p>
                          </div>
                        </div>
                        <Badge variant="primary">{formatCount(course.enrollments)}</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* COURSES TAB */}
        {activeTab === 'courses' && (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h2 className="font-headline-md text-headline-md text-on-surface">Course Management</h2>
                <p className="text-body text-on-surface-variant mt-1">Create, edit, and manage all courses</p>
              </div>
              {canManageCourses && (
                <Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => { setEditCourse(undefined); setShowCourseForm(true); }}>
                  Add Course
                </Button>
              )}
            </div>

            <Card variant="default" padding="md" className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-on-surface-variant/50" />
                <input
                  type="text"
                  placeholder="Search courses..."
                  value={courseSearch}
                  onChange={(e) => setCourseSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-outline-variant/40 bg-white text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:border-primary transition-colors"
                />
              </div>
              <select
                value={courseFilter}
                onChange={(e) => setCourseFilter(e.target.value as CourseStatus | 'all')}
                className="input px-3 py-2 text-sm min-w-[160px]"
              >
                <option value="all">All Status</option>
                <option value="published">Published</option>
                <option value="draft">Draft</option>
                <option value="archived">Archived</option>
              </select>
            </Card>

            <Card variant="default" padding="none">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-outline-variant/30">
                      <th className="text-left p-4 font-label-sm text-label-sm text-on-surface-variant">Course</th>
                      <th className="text-left p-4 font-label-sm text-label-sm text-on-surface-variant hidden md:table-cell">Category</th>
                      <th className="text-left p-4 font-label-sm text-label-sm text-on-surface-variant hidden lg:table-cell">Level</th>
                      <th className="text-left p-4 font-label-sm text-label-sm text-on-surface-variant">Status</th>
                      <th className="text-left p-4 font-label-sm text-label-sm text-on-surface-variant">Price</th>
                      <th className="text-left p-4 font-label-sm text-label-sm text-on-surface-variant">Students</th>
                      <th className="text-left p-4 font-label-sm text-label-sm text-on-surface-variant">Rating</th>
                      <th className="text-right p-4 font-label-sm text-label-sm text-on-surface-variant">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCourses.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="text-center py-12 text-on-surface-variant">No courses found</td>
                      </tr>
                    ) : (
                      filteredCourses.map((course) => (
                        <tr key={course.id} className="border-b border-outline-variant/20 hover:bg-surface-container/50">
                          <td className="p-4">
                            <div>
                              <p className="font-medium text-on-surface">{course.title}</p>
                              <p className="text-xs text-on-surface-variant">{course.instructor}</p>
                            </div>
                          </td>
                          <td className="p-4 hidden md:table-cell">{course.category}</td>
                          <td className="p-4 hidden lg:table-cell">
                            <Badge variant={course.level === 'Beginner' ? 'success' : course.level === 'Intermediate' ? 'warning' : 'error'} size="sm">
                              {course.level}
                            </Badge>
                          </td>
                          <td className="p-4">
                            <Badge variant={statusColor[course.status] || 'outline'} size="sm">{course.status}</Badge>
                          </td>
                          <td className="p-4 font-medium text-on-surface">{formatCurrency(course.price)}</td>
                          <td className="p-4 text-on-surface-variant">{(course.studentCount || 0).toLocaleString()}</td>
                          <td className="p-4">
                            <div className="flex items-center gap-1">
                              <Star className="h-3.5 w-3.5 fill-current text-amber-500" />
                              <span>{course.rating}</span>
                            </div>
                          </td>
                          <td className="p-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button variant="ghost" size="sm" icon={<Eye className="h-3.5 w-3.5" />} onClick={() => window.open(`/courses/${course.id}`, '_blank')} />
                              <Button variant="ghost" size="sm" icon={<Edit className="h-3.5 w-3.5" />} onClick={() => { setEditCourse(course); setShowCourseForm(true); }} />
                              <Button variant="ghost" size="sm" icon={<Trash className="h-3.5 w-3.5" />} className="text-error hover:bg-error/10" onClick={() => setDeleteTarget({ id: course.id, title: course.title, type: 'course' })} />
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}

        {/* INTERNSHIPS TAB */}
        {activeTab === 'internships' && (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h2 className="font-headline-md text-headline-md text-on-surface">Internship Management</h2>
                <p className="text-body text-on-surface-variant mt-1">Manage internship listings and domains</p>
              </div>
              {canManageInternships && (
                <Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => { setEditInternship(undefined); setShowInternshipForm(true); }}>
                  Add Internship
                </Button>
              )}
            </div>

            <Card variant="default" padding="md" className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-on-surface-variant/50" />
                <input
                  type="text"
                  placeholder="Search internships..."
                  value={internshipSearch}
                  onChange={(e) => setInternshipSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-outline-variant/40 bg-white text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:border-primary transition-colors"
                />
              </div>
              <select
                value={internshipFilter}
                onChange={(e) => setInternshipFilter(e.target.value as Internship['status'] | 'all')}
                className="input px-3 py-2 text-sm min-w-[160px]"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="completed">Completed</option>
                <option value="upcoming">Upcoming</option>
                <option value="applied">Applied</option>
              </select>
            </Card>

            <Card variant="default" padding="none">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-outline-variant/30">
                      <th className="text-left p-4 font-label-sm text-label-sm text-on-surface-variant">Internship</th>
                      <th className="text-left p-4 font-label-sm text-label-sm text-on-surface-variant hidden md:table-cell">Company</th>
                      <th className="text-left p-4 font-label-sm text-label-sm text-on-surface-variant">Domain</th>
                      <th className="text-left p-4 font-label-sm text-label-sm text-on-surface-variant">Status</th>
                      <th className="text-left p-4 font-label-sm text-label-sm text-on-surface-variant">Stipend</th>
                      <th className="text-left p-4 font-label-sm text-label-sm text-on-surface-variant hidden lg:table-cell">Duration</th>
                      <th className="text-left p-4 font-label-sm text-label-sm text-on-surface-variant">Progress</th>
                      <th className="text-right p-4 font-label-sm text-label-sm text-on-surface-variant">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredInternships.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="text-center py-12 text-on-surface-variant">No internships found</td>
                      </tr>
                    ) : (
                      filteredInternships.map((internship) => (
                        <tr key={internship.id} className="border-b border-outline-variant/20 hover:bg-surface-container/50">
                          <td className="p-4 font-medium text-on-surface">{internship.title}</td>
                          <td className="p-4 hidden md:table-cell text-on-surface-variant">{internship.company}</td>
                          <td className="p-4">
                            <Badge variant="primary" size="sm">{internship.domain}</Badge>
                          </td>
                          <td className="p-4">
                            <Badge variant={statusColor[internship.status] || 'outline'} size="sm">{internship.status}</Badge>
                          </td>
                          <td className="p-4 text-on-surface-variant">{internship.stipend}</td>
                          <td className="p-4 hidden lg:table-cell text-on-surface-variant">{internship.duration}</td>
                          <td className="p-4">
                            <div className="w-24 h-2 bg-surface-container overflow-hidden">
                              <div className="h-full bg-primary" style={{ width: `${internship.progress}%` }} />
                            </div>
                          </td>
                          <td className="p-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button variant="ghost" size="sm" icon={<Edit className="h-3.5 w-3.5" />} onClick={() => { setEditInternship(internship); setShowInternshipForm(true); }} />
                              <Button variant="ghost" size="sm" icon={<Trash className="h-3.5 w-3.5" />} className="text-error hover:bg-error/10" onClick={() => setDeleteTarget({ id: internship.id, title: internship.title, type: 'internship' })} />
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}

        {/* USERS TAB */}
        {activeTab === 'users' && (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h2 className="font-headline-md text-headline-md text-on-surface">User Management</h2>
                <p className="text-body text-on-surface-variant mt-1">View and manage platform users</p>
              </div>
              <div className="flex items-center gap-3">
                <Button variant="outline" size="sm" icon={<RefreshCw className="h-4 w-4" />} onClick={loadUsers}>
                  Refresh
                </Button>
                {canManageUsers && (
                  <Button variant="primary" icon={<UserPlus className="h-4 w-4" />} onClick={() => { setEditUser(undefined); setShowUserForm(true); }}>
                    Add User
                  </Button>
                )}
              </div>
            </div>

            <Card variant="default" padding="md" className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-on-surface-variant/50" />
                <input
                  type="text"
                  placeholder="Search users by name or email..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-outline-variant/40 bg-white text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:border-primary transition-colors"
                />
              </div>
              <select
                value={userRoleFilter}
                onChange={(e) => setUserRoleFilter(e.target.value as UserRole | 'all')}
                className="input px-3 py-2 text-sm min-w-[160px]"
              >
                <option value="all">All Roles</option>
                <option value="student">Student</option>
                <option value="instructor">Instructor</option>
                <option value="admin">Admin</option>
              </select>
            </Card>

            <Card variant="default" padding="none">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-outline-variant/30">
                      <th className="text-left p-4 font-label-sm text-label-sm text-on-surface-variant">User</th>
                      <th className="text-left p-4 font-label-sm text-label-sm text-on-surface-variant">Email</th>
                      <th className="text-left p-4 font-label-sm text-label-sm text-on-surface-variant">Role</th>
                      <th className="text-left p-4 font-label-sm text-label-sm text-on-surface-variant hidden md:table-cell">Courses</th>
                      <th className="text-left p-4 font-label-sm text-label-sm text-on-surface-variant hidden md:table-cell">Internships</th>
                      <th className="text-left p-4 font-label-sm text-label-sm text-on-surface-variant">Points</th>
                      <th className="text-left p-4 font-label-sm text-label-sm text-on-surface-variant">Joined</th>
                      <th className="text-left p-4 font-label-sm text-label-sm text-on-surface-variant hidden lg:table-cell">Last Active</th>
                      <th className="text-right p-4 font-label-sm text-label-sm text-on-surface-variant">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="text-center py-12 text-on-surface-variant">No users found</td>
                      </tr>
                    ) : (
                      filteredUsers.map((user) => (
                        <tr key={user.id} className="border-b border-outline-variant/20 hover:bg-surface-container/50">
                          <td className="p-4">
                            <div className="flex items-center gap-3">
                              <div className="h-10 w-10 rounded-full bg-primary-gradient flex items-center justify-center text-slate-950 font-bold shrink-0">
                                {user.fullName?.charAt(0) || user.email?.charAt(0) || 'U'}
                              </div>
                              <div>
                                <p className="font-medium text-on-surface">{user.fullName || 'Unnamed'}</p>
                                <p className="text-xs text-on-surface-variant">ID: {user.id.slice(0, 8)}...</p>
                              </div>
                            </div>
                          </td>
                          <td className="p-4 text-on-surface-variant">{user.email}</td>
                          <td className="p-4">
                            {user.isRootAdmin || user.role === 'root_admin' ? (
                              <Badge variant="primary" size="sm">Root Admin</Badge>
                            ) : user.role === 'admin' ? (
                              user.adminPermissions?.viewPayments === false ? (
                                <Badge variant="warning" size="sm">Sub-Admin (Restricted)</Badge>
                              ) : (
                                <Badge variant="error" size="sm">Full Admin</Badge>
                              )
                            ) : user.role === 'instructor' ? (
                              <Badge variant="outline" size="sm">Instructor</Badge>
                            ) : (
                              <Badge variant="success" size="sm">Student</Badge>
                            )}
                          </td>
                          <td className="p-4 hidden md:table-cell text-on-surface-variant">{user.enrolledCourses || 0}</td>
                          <td className="p-4 hidden md:table-cell text-on-surface-variant">{user.enrolledInternships || 0}</td>
                          <td className="p-4 font-medium text-on-surface">{formatCount(user.a2zPoints || 0)}</td>
                          <td className="p-4 text-on-surface-variant">
                            {user.joinDate ? new Date(user.joinDate).toLocaleDateString() : 'N/A'}
                          </td>
                          <td className="p-4 hidden lg:table-cell text-on-surface-variant">
                            {user.updatedAt ? new Date(user.updatedAt).toLocaleDateString() : 'N/A'}
                          </td>
                          <td className="p-4 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button variant="ghost" size="sm" icon={<Edit className="h-3.5 w-3.5" />} onClick={() => { setEditUser(user); setShowUserForm(true); }} />
                              <Button variant="ghost" size="sm" icon={<MessageSquare className="h-3.5 w-3.5" />} onClick={() => { setEditingNotification(undefined); setShowMessageForm(true); }} />
                              <Button variant="ghost" size="sm" icon={<Shield className="h-3.5 w-3.5 text-primary" />} title="Manage Admin Access & Restrictions" onClick={() => { setUserToToggleRole(user); setShowRoleToggle(true); }} />
                              <Button variant="ghost" size="sm" icon={<Trash className="h-3.5 w-3.5" />} className="text-error hover:bg-error/10" onClick={() => setDeleteTarget({ id: user.id, title: user.fullName || user.email, type: 'user' })} />
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}

        {/* MESSAGES TAB */}
        {activeTab === 'messages' && (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h2 className="font-headline-md text-headline-md text-on-surface">Messages & Notifications</h2>
                <p className="text-body text-on-surface-variant mt-1">Manage platform-wide messages and user notifications</p>
              </div>
              <div className="flex items-center gap-3">
                <Button variant="outline" size="sm" icon={<RefreshCw className="h-4 w-4" />} onClick={loadNotifications}>
                  Refresh
                </Button>
                <Button variant="primary" icon={<Send className="h-4 w-4" />} onClick={() => { setEditingNotification(undefined); setShowMessageForm(true); }}>
                  Send New Message
                </Button>
              </div>
            </div>

            <Card variant="default" padding="md" className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-on-surface-variant/50" />
                <input
                  type="text"
                  placeholder="Search messages..."
                  value={notificationSearch}
                  onChange={(e) => setNotificationSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-outline-variant/40 bg-white text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:border-primary transition-colors"
                />
              </div>
              <select
                value={notificationTypeFilter}
                onChange={(e) => setNotificationTypeFilter(e.target.value as NotificationType | 'all')}
                className="input px-3 py-2 text-sm min-w-[180px]"
              >
                <option value="all">All Types</option>
                <option value="registration">Registration</option>
                <option value="payment">Payment</option>
                <option value="enrollment">Enrollment</option>
                <option value="reminder">Reminder</option>
                <option value="assignment-due">Assignment Due</option>
                <option value="quiz-available">Quiz Available</option>
                <option value="certificate-ready">Certificate Ready</option>
                <option value="points-earned">Points Earned</option>
                <option value="discount">Discount</option>
                <option value="referral-bonus">Referral Bonus</option>
                <option value="new-course">New Course</option>
                <option value="course-launch">Course Launch</option>
                <option value="achievement">Achievement</option>
              </select>
              <select
                value={notificationReadFilter}
                onChange={(e) => setNotificationReadFilter(e.target.value as 'all' | 'read' | 'unread')}
                className="input px-3 py-2 text-sm min-w-[140px]"
              >
                <option value="all">All Status</option>
                <option value="unread">Unread Only</option>
                <option value="read">Read Only</option>
              </select>
            </Card>

            <Card variant="default" padding="none">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-outline-variant/30">
                      <th className="text-left p-4 font-label-sm text-label-sm text-on-surface-variant">Recipient</th>
                      <th className="text-left p-4 font-label-sm text-label-sm text-on-surface-variant">Title</th>
                      <th className="text-left p-4 font-label-sm text-label-sm text-on-surface-variant">Type</th>
                      <th className="text-left p-4 font-label-sm text-label-sm text-on-surface-variant hidden md:table-cell">Preview</th>
                      <th className="text-left p-4 font-label-sm text-label-sm text-on-surface-variant">Status</th>
                      <th className="text-left p-4 font-label-sm text-label-sm text-on-surface-variant hidden lg:table-cell">Created</th>
                      <th className="text-right p-4 font-label-sm text-label-sm text-on-surface-variant">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredNotifications.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="text-center py-12 text-on-surface-variant">No notifications found</td>
                      </tr>
                    ) : (
                      filteredNotifications.map((notif) => (
                        <tr key={notif.id} className={`border-b border-outline-variant/20 ${!notif.read ? 'bg-primary/5' : ''}`}>
                          <td className="p-4">
                            <div className="flex items-center gap-2">
                              <div className="h-8 w-8 rounded-full bg-primary-gradient flex items-center justify-center text-slate-950 font-bold text-xs">
                                {notif.userId?.charAt(0) || 'U'}
                              </div>
                              <div className="text-sm text-on-surface-variant">{notif.userId?.slice(0, 8)}...</div>
                            </div>
                          </td>
                          <td className="p-4 font-medium text-on-surface">{notif.title}</td>
                          <td className="p-4">
                            <Badge variant="outline" size="sm">{notif.type}</Badge>
                          </td>
                          <td className="p-4 hidden md:table-cell text-on-surface-variant max-w-xs truncate">{notif.message}</td>
                          <td className="p-4">
                            <Badge variant={notif.read ? 'success' : 'warning'} size="sm">
                              {notif.read ? 'Read' : 'Unread'}
                            </Badge>
                          </td>
                          <td className="p-4 hidden lg:table-cell text-on-surface-variant">
                            {notif.createdAt ? new Date(notif.createdAt).toLocaleDateString() : 'N/A'}
                          </td>
                          <td className="p-4 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button variant="ghost" size="sm" icon={<Edit className="h-3.5 w-3.5" />} onClick={() => { setEditingNotification(notif); setShowMessageForm(true); }} />
                              <Button variant="ghost" size="sm" icon={notif.read ? <X className="h-3.5 w-3.5" /> : <CheckCircle className="h-3.5 w-3.5" />} onClick={() => toggleNotificationRead(notif.id, !notif.read)} className={notif.read ? 'text-success' : 'text-warning'} />
                              <Button variant="ghost" size="sm" icon={<Trash className="h-3.5 w-3.5" />} className="text-error hover:bg-error/10" onClick={() => setDeleteTarget({ id: notif.id, title: notif.title, type: 'notification' })} />
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}

        {/* ANALYTICS TAB */}
        {activeTab === 'analytics' && analytics && (
          <div className="space-y-6">
            <div>
              <h2 className="font-headline-md text-headline-md text-on-surface">Platform Analytics</h2>
              <p className="text-body text-on-surface-variant mt-1">Detailed platform metrics and insights</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card variant="default" padding="lg">
                <CardHeader>
                  <CardTitle>Completion Rate</CardTitle>
                  <CardDescription>Overall course completion percentage</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-8">
                    <div className="text-6xl font-black text-primary">{analytics.completionRate}%</div>
                    <div className="mt-4 h-4 bg-surface-container overflow-hidden w-1/2 mx-auto">
                      <div className="h-full bg-primary" style={{ width: `${analytics.completionRate}%` }} />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card variant="default" padding="lg">
                <CardHeader>
                  <CardTitle>Average Rating</CardTitle>
                  <CardDescription>Across all published courses</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-8">
                    <div className="flex items-center justify-center gap-1">
                      <span className="text-6xl font-black text-on-surface">{analytics.averageRating.toFixed(1)}</span>
                      <Star className="h-10 w-10 fill-current text-amber-500" />
                    </div>
                    <p className="text-on-surface-variant mt-2">Based on {analytics.totalCourses} courses</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card variant="default" padding="lg">
              <CardHeader>
                <CardTitle>Enrollment & Revenue Overview</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-medium text-on-surface mb-3">Monthly Enrollments</h4>
                    <MiniBar data={analytics.enrollmentTrend.map(d => ({ label: d.date, value: d.count }))} color="bg-primary" />
                  </div>
                  <div>
                    <h4 className="font-medium text-on-surface mb-3">Monthly Revenue (INR)</h4>
                    <MiniBar data={analytics.revenueTrend.map(d => ({ label: d.date, value: d.amount }))} color="bg-emerald-500" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card variant="default" padding="lg">
                <CardHeader>
                  <CardTitle>Students by Domain</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {analytics.studentsByDomain.map((domain) => (
                      <div key={domain.domain} className="flex items-center gap-3">
                        <div className="w-32 text-sm font-medium text-on-surface-variant">{domain.domain}</div>
                        <div className="flex-1 h-2 bg-surface-container overflow-hidden">
                          <div
                            className="h-full bg-primary transition-all"
                            style={{ width: `${(domain.count / Math.max(...analytics.studentsByDomain.map(d => d.count))) * 100}%` }}
                          />
                        </div>
                        <div className="w-24 text-right text-sm font-semibold text-on-surface">{formatCount(domain.count)}</div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card variant="default" padding="lg">
                <CardHeader>
                  <CardTitle>Top Performing Courses</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {analytics.topCourses.map((course, idx) => (
                      <div key={course.courseId} className="flex items-center justify-between p-3 bg-surface-container">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                            {idx + 1}
                          </div>
                          <div>
                            <p className="font-medium text-on-surface">{course.title}</p>
                            <p className="text-xs text-on-surface-variant">{formatCount(course.enrollments)} enrollments</p>
                          </div>
                        </div>
                        <Badge variant="primary">{formatCount(course.enrollments)}</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* Modals */}
        {showCourseForm && (
          <Modal onClose={() => { setShowCourseForm(false); setEditCourse(undefined); }} title={editCourse ? 'Edit Course' : 'Create Course'} size="xl">
            <CourseFormModal course={editCourse} onSave={handleSaveCourse} onClose={() => { setShowCourseForm(false); setEditCourse(undefined); }} />
          </Modal>
        )}

        {showInternshipForm && (
          <Modal onClose={() => { setShowInternshipForm(false); setEditInternship(undefined); }} title={editInternship ? 'Edit Internship' : 'Create Internship'} size="xl">
            <InternshipFormModal internship={editInternship} onSave={handleSaveInternship} onClose={() => { setShowInternshipForm(false); setEditInternship(undefined); }} internshipDomains={internshipDomains} />
          </Modal>
        )}

        {showUserForm && (
          <Modal onClose={() => { setShowUserForm(false); setEditUser(undefined); }} title={editUser ? 'Edit User' : 'Create User'} size="lg">
            <UserFormModal user={editUser} onSave={handleSaveUser} onClose={() => { setShowUserForm(false); setEditUser(undefined); }} />
          </Modal>
        )}

        {showMessageForm && (
          <Modal onClose={() => { setShowMessageForm(false); setEditingNotification(undefined); }} title={editingNotification ? 'Edit Notification' : 'Send Notification'} size="lg">
            <MessageFormModal notification={editingNotification} onSave={handleSaveNotification} onClose={() => { setShowMessageForm(false); setEditingNotification(undefined); }} allUsers={allUsers} />
          </Modal>
        )}

        {showRoleToggle && userToToggleRole && (
          <Modal onClose={() => { setShowRoleToggle(false); setUserToToggleRole(null); }} title="Manage Admin Access & Restrictions" size="lg">
            <AdminPermissionsModal
              targetUser={userToToggleRole}
              onSave={(newRole, isRoot, perms) => handleSaveUserPermissions(userToToggleRole.id, newRole, isRoot, perms)}
              onClose={() => { setShowRoleToggle(false); setUserToToggleRole(null); }}
            />
          </Modal>
        )}

        {deleteTarget && (
          <Modal onClose={() => setDeleteTarget(null)} title="Confirm Delete" size="sm">
            <DeleteConfirmModal title={deleteTarget.title} onConfirm={() => {
              if (deleteTarget.type === 'course') handleDeleteCourse(deleteTarget.id);
              else if (deleteTarget.type === 'internship') handleDeleteInternship(deleteTarget.id);
              else if (deleteTarget.type === 'user') handleDeleteUser(deleteTarget.id);
              else if (deleteTarget.type === 'notification') handleDeleteNotification(deleteTarget.id);
            }} onClose={() => setDeleteTarget(null)} />
          </Modal>
        )}

        {showClearDbConfirm && (
          <DbManagerModal
            onClose={() => setShowClearDbConfirm(false)}
            onRefreshParent={() => {
              loadUsers();
              loadNotifications();
              getAdminAnalytics().then(setAnalytics);
              fetchFirebaseCollection<Course>('courses').then(setAllCourses);
              fetchFirebaseCollection<Internship>('internships').then(setAllInternships);
            }}
          />
        )}
      </div>
    </ModalProvider>
  );
};

export default Admin;
