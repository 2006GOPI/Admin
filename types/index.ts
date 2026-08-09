export type CourseLevel = 'Beginner' | 'Intermediate' | 'Advanced';
export type CourseStatus = 'draft' | 'published' | 'archived';

export type CourseLesson = {
  id: string;
  title: string;
  duration?: string;
  freePreview?: boolean;
};

export type CourseModule = {
  id: string;
  title: string;
  description?: string;
  lessons?: CourseLesson[];
};

export type Course = {
  id: string;
  title: string;
  slug?: string;
  instructor: string;
  category: string;
  level: CourseLevel;
  price: number;
  originalPrice?: number;
  duration?: string;
  status: CourseStatus;
  skills?: string[];
  prerequisites?: string[];
  thumbnail: string;
  rating: number;
  reviewCount: number;
  studentCount: number;
  totalLessons?: number;
  totalModules?: number;
  whatYouLearn?: string[];
  description?: string;
  shortDescription?: string;
  modules?: CourseModule[];
  certificateTitle?: string;
  certificateDescription?: string;
  verificationType?: string;
  badge?: string;
  createdAt: string;
  updatedAt: string;
};

export type InternshipPhase = {
  id: string;
  weeks: string;
  title: string;
  description?: string;
  keyDeliverables?: string[];
};

export type Internship = {
  id: string;
  title: string;
  company?: string;
  organization?: string;
  domain: string;
  domainId?: string;
  location?: string;
  type?: 'Full-time' | 'Part-time';
  format?: string;
  duration?: string;
  stipend?: string;
  status: 'active' | 'upcoming' | 'completed' | 'applied' | 'draft';
  logo?: string;
  skills?: string[];
  description?: string;
  roadmap?: InternshipPhase[];
  verifiedCertificate?: string;
  lorEligibility?: string;
  startDate?: string;
  endDate?: string;
  applicationDeadline?: string;
  progress?: number;
  createdAt?: string;
  updatedAt?: string;
};

export type InternshipDomain = { id: string; name: string };

export type UserRole = 'student' | 'instructor' | 'admin' | 'root_admin';

export type AdminPermissions = {
  viewPayments?: boolean;        // Hide financial & revenue metrics if false
  manageCourses?: boolean;       // Create/edit/delete courses
  manageInternships?: boolean;   // Create/edit/delete internships
  manageUsers?: boolean;         // Change roles & permissions
  issueCertificates?: boolean;   // Generate certificates
  viewAnalytics?: boolean;       // View platform analytics
  manageDatabase?: boolean;      // Access Firestore DB Manager
};

export type UserProfile = {
  id: string;
  email: string;
  fullName?: string;
  role: UserRole;
  isRootAdmin?: boolean;
  adminPermissions?: AdminPermissions;
  avatarUrl?: string;
  phone?: string;
  bio?: string;
  a2zPoints?: number;
  enrolledCourses?: number;
  enrolledInternships?: number;
  joinDate?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type NotificationType = string;
export type Notification = { id: string; userId: string; type: NotificationType; title: string; message: string; read?: boolean; createdAt?: string; updatedAt?: string };

export type AdminAnalytics = {
  totalStudents: number; activeStudents: number; totalCourses: number; totalInternships: number; revenue: number; certificatesIssued: number; studentsByDomain: { domain: string; count: number }[]; enrollmentTrend: { date: string; count: number }[]; revenueTrend: { date: string; amount: number }[]; topCourses: { courseId: string; title: string; enrollments: number }[]; completionRate: number; averageRating: number;
};

export type PaymentStatus = 'pending' | 'verified' | 'completed' | 'failed' | 'rejected' | 'refunded';
export type PaymentMethod = 'upi_qr' | 'razorpay' | 'stripe' | 'bank_transfer' | 'card' | 'cash' | 'other';
export type PaymentItemType = 'course' | 'internship' | 'bundle' | 'workshop';

export type PaymentTransaction = {
  id: string;
  transactionId: string;
  utrNumber?: string;
  userId: string;
  userName: string;
  userEmail: string;
  userPhone?: string;
  itemId: string;
  itemTitle: string;
  itemType: PaymentItemType;
  amount: number;
  originalAmount?: number;
  discountAmount?: number;
  couponCode?: string;
  currency: string;
  paymentMethod: PaymentMethod;
  status: PaymentStatus;
  receiptUrl?: string;
  notes?: string;
  rejectionReason?: string;
  verifiedBy?: string;
  verifiedAt?: string;
  createdAt: string;
  updatedAt?: string;
};

