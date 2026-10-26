export function dashboardPath(role) {
  return ({ admin: '/admin/dashboard', teacher: '/teacher/dashboard', student: '/student/dashboard' })[role] || '/login';
}
