import { useState, useEffect } from 'react';
import {
  BarChart3, TrendingUp, Users, BookOpen, GraduationCap,
  DollarSign, Award, Star, Activity,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './components/ui/Card';
import { cn } from './utils';
import { getAdminAnalytics } from './data';
import type { AdminAnalytics } from './types';

const defaultAnalytics: AdminAnalytics = {
  totalStudents: 0, activeStudents: 0, totalCourses: 0,
  totalInternships: 0, revenue: 0, certificatesIssued: 0,
  studentsByDomain: [], enrollmentTrend: [], revenueTrend: [],
  topCourses: [], completionRate: 0, averageRating: 0,
};

const formatCurrency = (amount: number) =>
  '₹' + amount.toLocaleString('en-IN');

const formatNumber = (n: number) => {
  if (n >= 1_00_00_000) return (n / 1_00_00_000).toFixed(1) + 'Cr';
  if (n >= 1_00_000) return (n / 1_00_000).toFixed(1) + 'L';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return n.toLocaleString('en-IN');
};

const statCards = [
  {
    label: 'Total Students', key: 'totalStudents' as const,
    icon: Users, color: 'text-emerald-600', bg: 'bg-emerald-50',
  },
  {
    label: 'Active Students', key: 'activeStudents' as const,
    icon: Activity, color: 'text-emerald-500', bg: 'bg-emerald-50',
  },
  {
    label: 'Total Courses', key: 'totalCourses' as const,
    icon: BookOpen, color: 'text-purple-500', bg: 'bg-purple-50',
  },
  {
    label: 'Revenue', key: 'revenue' as const,
    icon: DollarSign, color: 'text-amber-500', bg: 'bg-amber-50',
  },
  {
    label: 'Certificates Issued', key: 'certificatesIssued' as const,
    icon: Award, color: 'text-rose-500', bg: 'bg-rose-50',
  },
  {
    label: 'Completion Rate', key: 'completionRate' as const,
    icon: TrendingUp, color: 'text-teal-600', bg: 'bg-teal-50',
  },
];

const formatPercent = (v: number) => v.toFixed(0) + '%';

export const Analytics = ({ permissions }: { permissions?: AdminPermissions }) => {
  const [analytics, setAnalytics] = useState<AdminAnalytics>(defaultAnalytics);
  const [loading, setLoading] = useState(true);

  const canViewPayments = permissions?.viewPayments ?? true;

  useEffect(() => {
    getAdminAnalytics().then((data) => {
      setAnalytics(data);
      setLoading(false);
    });
  }, []);

  if (loading) return null;

  const valueRenderers: Record<string, (v: number) => string> = {
    totalStudents: formatNumber,
    activeStudents: formatNumber,
    totalCourses: String,
    totalInternships: String,
    revenue: (v) => canViewPayments ? formatCurrency(v) : '•••• (Restricted)',
    certificatesIssued: formatNumber,
    completionRate: formatPercent,
    averageRating: (v) => v.toFixed(1),
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="h-12 w-12 bg-primary-gradient flex items-center justify-center shadow-sm">
          <BarChart3 className="h-6 w-6 text-white" />
        </div>
        <div>
          <h1 className="text-headline-md font-headline-md text-on-surface">Analytics</h1>
          <p className="text-body text-on-surface-variant mt-0.5">
            Platform-wide performance metrics and insights
          </p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {statCards.map((stat) => (
          <Card key={stat.key} variant="hover" padding="lg" className="relative overflow-hidden">
            <div className="flex flex-col gap-2">
              <div className={cn('w-10 h-10 flex items-center justify-center', stat.bg)}>
                <stat.icon className={cn('h-5 w-5', stat.color)} />
              </div>
              <div>
                <p className="text-label-sm font-label-sm text-on-surface-variant">{stat.label}</p>
                <p className="font-display text-2xl font-bold text-on-surface mt-0.5">
                  {valueRenderers[stat.key](analytics[stat.key])}
                </p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Two-Column: Domain Distribution + Top Courses */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Students by Domain */}
        <Card variant="default" padding="lg">
          <CardHeader className="px-0 pt-0">
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Students by Domain
            </CardTitle>
            <CardDescription>
              Distribution of students across internship domains
            </CardDescription>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            <div className="space-y-4">
              {analytics.studentsByDomain.map((domain) => {
                const total = analytics.studentsByDomain.reduce((s, d) => s + d.count, 0);
                const pct = total > 0 ? (domain.count / total) * 100 : 0;
                return (
                  <div key={domain.domain}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-label-sm font-label-sm text-on-surface">{domain.domain}</span>
                      <span className="text-xs font-semibold text-on-surface-variant">
                        {formatNumber(domain.count)} ({pct.toFixed(0)}%)
                      </span>
                    </div>
                    <div className="h-2 bg-surface-container overflow-hidden">
                      <div
                        className="h-full bg-primary transition-all duration-700"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Top Courses */}
        <Card variant="default" padding="lg">
          <CardHeader className="px-0 pt-0">
            <CardTitle className="flex items-center gap-2">
              <Star className="h-5 w-5 text-amber-500" />
              Top Courses by Enrollment
            </CardTitle>
            <CardDescription>
              Most popular courses on the platform
            </CardDescription>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            <div className="space-y-3">
              {analytics.topCourses.map((course, index) => {
                const max = Math.max(...analytics.topCourses.map(c => c.enrollments));
                const pct = max > 0 ? (course.enrollments / max) * 100 : 0;
                return (
                  <div
                    key={course.courseId}
                    className="flex items-center gap-4 p-3 bg-surface-container-low hover:bg-surface-container transition-colors"
                  >
                    <div className="w-7 h-7 flex items-center justify-center bg-primary/10 text-primary font-bold text-xs shrink-0">
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-label-sm font-label-sm text-on-surface truncate">{course.title}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="flex-1 h-1.5 bg-surface-container overflow-hidden">
                          <div
                            className="h-full bg-primary "
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-[11px] font-semibold text-on-surface-variant shrink-0">
                          {formatNumber(course.enrollments)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bottom Row: Key Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card variant="hover" padding="lg" className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
            <GraduationCap className="h-6 w-6 text-emerald-600" />
          </div>
          <div className="min-w-0">
            <p className="text-label-sm font-label-sm text-on-surface-variant">Total Internships</p>
            <p className="text-2xl font-bold text-on-surface mt-0.5">{analytics.totalInternships}</p>
          </div>
        </Card>
        <Card variant="hover" padding="lg" className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
            <Award className="h-6 w-6 text-emerald-600" />
          </div>
          <div className="min-w-0">
            <p className="text-label-sm font-label-sm text-on-surface-variant">Average Rating</p>
            <p className="text-2xl font-bold text-on-surface mt-0.5">{analytics.averageRating.toFixed(1)}</p>
          </div>
        </Card>
        <Card variant="hover" padding="lg" className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-lg bg-amber-50 flex items-center justify-center shrink-0">
            <TrendingUp className="h-6 w-6 text-amber-600" />
          </div>
          <div className="min-w-0">
            <p className="text-label-sm font-label-sm text-on-surface-variant">Completion Rate</p>
            <p className="text-2xl font-bold text-on-surface mt-0.5">{analytics.completionRate}%</p>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Analytics;
