import Skeleton from './Skeleton';
import UserTable from './UserTable';

function Panel({ children, className = '' }) {
  return <div className={`bg-white border border-slate-200 rounded-2xl p-6 space-y-4 ${className}`}>{children}</div>;
}

export default function DashboardSkeleton({ variant = 'student' }) {
  if (variant === 'admin') return <AdminDashboardSkeleton />;
  const teacher = variant === 'teacher';
  return (
    <div className="min-h-screen bg-slate-50 w-full overflow-x-hidden">
      {teacher && (
        <div aria-hidden="true" className="hidden lg:flex fixed inset-y-0 left-0 w-[260px] bg-white border-r border-slate-200 p-6 flex-col gap-8">
          <div className="flex items-center gap-3"><Skeleton className="h-12 w-12 rounded-full shrink-0" /><Skeleton className="h-6 w-28" /></div>
          <div className="space-y-4">{[0, 1, 2, 3, 4, 5, 6].map((item) => <Skeleton key={item} className="h-10 w-full" />)}</div>
          <div className="mt-auto space-y-3"><Skeleton className="h-10 w-full" /><Skeleton className="h-4 w-32" /></div>
        </div>
      )}
      <div className={teacher ? 'lg:pl-[260px]' : ''}>
        <div aria-hidden="true" className="bg-white border-b border-slate-200 h-16 px-6 flex items-center justify-between">
          <Skeleton className="h-7 w-44" /><Skeleton className="h-9 w-24" />
        </div>
        <div role="status" aria-label="Loading dashboard" aria-busy="true" className="max-w-[1440px] mx-auto p-4 sm:p-6 space-y-6">
          <span className="sr-only">Loading dashboard…</span>
          {!teacher && <Panel className="flex items-center gap-5"><Skeleton className="h-16 w-16 rounded-full shrink-0" /><div className="space-y-3 flex-1"><Skeleton className="h-6 w-1/2" /><Skeleton className="h-4 w-1/3" /></div></Panel>}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[0, 1, 2].map((item) => <Panel key={item}><Skeleton className="h-3 w-28" /><Skeleton className="h-8 w-36" /><Skeleton className="h-3 w-24" /></Panel>)}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Panel><Skeleton className="h-5 w-36" /><Skeleton className="h-44 w-44 rounded-full mx-auto my-6" /></Panel>
            <Panel className="lg:col-span-2"><Skeleton className="h-5 w-40" /><Skeleton className="h-56 w-full" /></Panel>
          </div>
          <Panel><Skeleton className="h-5 w-40" />{[0, 1, 2, 3].map((row) => <div key={row} className="flex gap-6 border-t border-slate-100 pt-4"><Skeleton className="h-5 w-1/3" /><Skeleton className="h-5 w-1/3" /><Skeleton className="h-5 w-1/4" /></div>)}</Panel>
        </div>
      </div>
    </div>
  );
}

function AdminDashboardSkeleton() {
  const columns = [
    ['#', '#'], ['rollNumber', 'Roll Number'], ['name', 'Name'],
    ['studentClass', 'Class'], ['assignedTeacher', 'Teacher'], ['fees', 'Fees'], ['phone', 'Phone'],
  ].map(([key, label]) => ({ key, label }));

  return (
    <div className="min-h-screen bg-slate-50 w-full max-w-full overflow-x-hidden">
      <div aria-hidden="true" className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 min-h-16 py-2 flex flex-wrap sm:flex-nowrap gap-2 items-center justify-between">
          <div className="flex items-center gap-3"><Skeleton className="w-10 h-10 sm:w-12 sm:h-12 rounded-full" /><Skeleton className="h-7 w-36" /></div>
          <Skeleton className="hidden lg:block h-3 w-64 mx-4" />
          <div className="flex justify-end w-full sm:w-auto gap-2">{[0, 1, 2].map((item) => <Skeleton key={item} className="h-9 w-20" />)}</div>
        </div>
      </div>
      <main aria-busy="true" aria-label="Loading admin dashboard" className="max-w-[1440px] mx-auto px-4 sm:px-6 py-6 sm:py-8 w-full">
        <span role="status" className="sr-only">Loading admin dashboard…</span>
        <div aria-hidden="true" className="mb-8 space-y-2"><Skeleton className="h-8 w-40" /><Skeleton className="h-5 w-64 max-w-full" /></div>
        <div className="space-y-6">
          <section aria-label="Loading user management" className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden min-w-0">
            <div aria-hidden="true" className="px-4 sm:px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-50/50">
              <Skeleton className="h-5 w-44" />
              <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto"><Skeleton className="h-9 w-52" /><Skeleton className="h-9 w-28" /></div>
            </div>
            <UserTable columns={columns} data={[]} loading />
          </section>
          <section aria-label="Loading password requests" className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-6">
            <Skeleton className="h-6 w-44 mb-4" />
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {[0, 1, 2].map((item) => <div key={item} className="rounded-xl border border-slate-200 p-4 flex items-center gap-3"><Skeleton className="w-10 h-10 rounded-lg shrink-0" /><div className="flex-1 min-w-0 space-y-2"><Skeleton className="h-4 w-32 max-w-full" /><Skeleton className="h-3 w-24 max-w-full" /></div></div>)}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
