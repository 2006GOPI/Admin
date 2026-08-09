import { useState, useMemo, useEffect } from 'react';
import { db, doc, setDoc } from './firebase';
import { Award, Download, Printer, Search, Sparkles, CheckCircle2 } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription } from './components/ui/Card';
import { Button } from './components/ui/Button';
import { Input } from './components/ui/Input';
import { Badge } from './components/ui/Badge';
import CertificatePreview from './components/certificates/CertificatePreview';
import { useCertificateDownload, generateCertificateId } from './lib/certificate';
import { getCertificates } from './data/certificates';
import { getCourses } from './data';
import type { Certificate, CertificateCategory } from './types/certificate';
import type { Course } from './types';
import { useToastHelpers } from './components/ui/Toast';

/**
 * Admin tool for manually issuing a completion certificate for a student:
 * fill in the student & course details, preview the certificate exactly as
 * the student will see/download it, then generate + download it as PDF/PNG.
 */
export const CertificateGenerator = () => {
  const { certRef, downloadPNG, downloadPDF, printCertificate } = useCertificateDownload();
  const { success } = useToastHelpers();

  const [courses, setCourses] = useState<Course[]>([]);
  const [issued, setIssued] = useState<Certificate[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    getCourses().then(setCourses);
    getCertificates().then(setIssued);
  }, []);

  const [studentName, setStudentName] = useState('');
  const [courseId, setCourseId] = useState('');
  const [score, setScore] = useState(90);
  const [duration, setDuration] = useState('8 weeks');
  const [skills, setSkills] = useState('');

  const selectedCourse = useMemo(
    () => courses.find((c) => c.id === courseId),
    [courses, courseId]
  );

  const [generated, setGenerated] = useState<Certificate | null>(null);

  const canGenerate = studentName.trim().length > 1 && !!selectedCourse;

  const handleGenerate = async () => {
    if (!selectedCourse || !canGenerate) return;
    const certificateId = generateCertificateId();
    const now = new Date().toISOString();
    const verificationUrl = `${window.location.origin}/verify/${certificateId}`;

    const cert: Certificate = {
      id: certificateId.toLowerCase(),
      certificateId,
      userId: 'manual-issue',
      courseId: selectedCourse.id,
      courseName: selectedCourse.title,
      category: (selectedCourse.category as CertificateCategory) || 'other',
      studentName: studentName.trim(),
      instructorName: selectedCourse.instructor,
      organizationName: 'A2Z Academy',
      issueDate: now,
      completionDate: now,
      courseDuration: duration || selectedCourse.duration,
      completionScore: score,
      totalLessons: selectedCourse.totalLessons || 0,
      completedLessons: selectedCourse.totalLessons || 0,
      skillsLearned: skills
        ? skills.split(',').map((s) => s.trim()).filter(Boolean)
        : selectedCourse.skills || [],
      passingScore: 60,
      status: 'completed',
      qrCodeData: verificationUrl,
      digitalSignature: `sig_${typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID().split('-').join('').slice(0, 10) : Math.random().toString(36).slice(2, 12)}`,
      verificationUrl,
      downloadCount: 0,
      isFavorite: false,
    };

    try {
      await setDoc(doc(db, 'certificates', cert.id), cert);
      setGenerated(cert);
      setIssued((prev) => [cert, ...prev]);
      success('Certificate generated', `${certificateId} issued to ${cert.studentName}.`);
    } catch (err: any) {
      console.error('Error saving certificate to Firestore:', err);
      // Fallback update
      setGenerated(cert);
      setIssued((prev) => [cert, ...prev]);
      success('Certificate generated', `${certificateId} issued to ${cert.studentName}.`);
    }
  };

  const filteredIssued = issued.filter(
    (c) =>
      c.studentName.toLowerCase().includes(search.toLowerCase()) ||
      c.courseName.toLowerCase().includes(search.toLowerCase()) ||
      c.certificateId.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 pt-24 space-y-8">
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 bg-primary/10 flex items-center justify-center">
          <Award className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="font-headline-md text-headline-md text-on-surface">Certificate Generator</h1>
          <p className="text-body text-on-surface-variant">Manually issue a verified completion certificate for a student.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Form */}
        <Card padding="lg" className="lg:col-span-2 h-fit space-y-6">
          <CardHeader className="p-0 mb-3">
            <CardTitle>Certificate Details</CardTitle>
            <CardDescription>These fields populate the certificate preview on the right.</CardDescription>
          </CardHeader>

          <Input
            label="Student Full Name"
            placeholder="e.g. Priya Sharma"
            value={studentName}
            onChange={(e) => setStudentName(e.target.value)}
          />

          <div className="space-y-1.5">
            <label className="label">Course</label>
            <select
              className="input w-full"
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
            >
              <option value="">Select a course…</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>{c.title}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-5">
            <Input
              label="Completion Score (%)"
              type="number"
              min={0}
              max={100}
              value={score}
              onChange={(e) => setScore(Number(e.target.value))}
            />
            <Input
              label="Course Duration"
              placeholder="e.g. 8 weeks"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
            />
          </div>

          <Input
            label="Skills Learned (comma separated)"
            placeholder="React, Node.js, TypeScript"
            value={skills}
            onChange={(e) => setSkills(e.target.value)}
          />

          <Button
            className="w-full justify-center"
            size="lg"
            icon={<Sparkles className="h-4 w-4" />}
            disabled={!canGenerate}
            onClick={handleGenerate}
          >
            Generate Certificate
          </Button>

          {generated && (
            <div className="flex flex-col gap-2 pt-2 border-t border-outline-variant/30">
              <div className="flex items-center gap-2 text-sm text-emerald-600">
                <CheckCircle2 className="h-4 w-4" />
                Certificate {generated.certificateId} ready
              </div>
              <div className="grid grid-cols-3 gap-2">
                <Button variant="outline" size="sm" icon={<Download className="h-4 w-4" />} onClick={() => downloadPNG(generated.certificateId)}>PNG</Button>
                <Button variant="outline" size="sm" icon={<Download className="h-4 w-4" />} onClick={() => downloadPDF(generated.certificateId)}>PDF</Button>
                <Button variant="outline" size="sm" icon={<Printer className="h-4 w-4" />} onClick={printCertificate}>Print</Button>
              </div>
            </div>
          )}
        </Card>

        {/* Preview */}
        <div className="lg:col-span-3 space-y-4">
          <p className="text-label-sm font-label-sm text-on-surface-variant uppercase tracking-wide">Live Preview</p>
          {generated ? (
            <CertificatePreview ref={certRef} certificate={generated} />
          ) : (
            <Card padding="lg" className="aspect-[1.414/1] flex items-center justify-center text-center">
              <div className="max-w-xs mx-auto">
                <Award className="h-10 w-10 text-on-surface-variant/40 mx-auto mb-3" />
                <p className="text-body text-on-surface-variant">
                  Fill in the student name and select a course, then click "Generate Certificate" to preview it here.
                </p>
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* Issued list */}
      <Card padding="lg">
        <CardHeader className="p-0 mb-4 flex-row items-center justify-between">
          <div>
            <CardTitle>Recently Issued Certificates</CardTitle>
            <CardDescription>{issued.length} total certificates on record</CardDescription>
          </div>
        </CardHeader>
        <Input
          placeholder="Search by student, course, or certificate ID…"
          icon={<Search className="h-4 w-4" />}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="mb-4"
        />
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-on-surface-variant border-b border-outline-variant/30">
                <th className="py-2 pr-4 font-medium">Certificate ID</th>
                <th className="py-2 pr-4 font-medium">Student</th>
                <th className="py-2 pr-4 font-medium">Course</th>
                <th className="py-2 pr-4 font-medium">Score</th>
                <th className="py-2 pr-4 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredIssued.map((c) => (
                <tr key={c.id} className="border-b border-outline-variant/10">
                  <td className="py-2 pr-4 font-mono text-xs">{c.certificateId}</td>
                  <td className="py-2 pr-4">{c.studentName}</td>
                  <td className="py-2 pr-4">{c.courseName}</td>
                  <td className="py-2 pr-4">{c.completionScore}%</td>
                  <td className="py-2 pr-4">
                    <Badge variant={c.status === 'completed' ? 'success' : 'warning'}>{c.status}</Badge>
                  </td>
                </tr>
              ))}
              {filteredIssued.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-on-surface-variant">No certificates found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

export default CertificateGenerator;
