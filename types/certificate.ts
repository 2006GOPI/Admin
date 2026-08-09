export type CertificateCategory = 'other' | 'programming' | 'data' | 'security';

export type Certificate = {
  id: string;
  certificateId: string;
  userId: string;
  courseId: string;
  courseName: string;
  category: CertificateCategory;
  studentName: string;
  instructorName?: string;
  organizationName?: string;
  issueDate: string;
  completionDate?: string;
  courseDuration?: string;
  completionScore?: number;
  totalLessons?: number;
  completedLessons?: number;
  skillsLearned?: string[];
  passingScore?: number;
  status?: 'completed' | 'pending';
  qrCodeData?: string;
  digitalSignature?: string;
  verificationUrl?: string;
  downloadCount?: number;
  isFavorite?: boolean;
};
