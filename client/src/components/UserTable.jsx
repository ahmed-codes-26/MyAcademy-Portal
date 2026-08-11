import { Pencil, Trash2 } from 'lucide-react';

export default function UserTable({ columns, data, onEdit, onDelete, loading }) {
  if (loading) {
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-500"
                >
                  {col.label}
                </th>
              ))}
              <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-500 text-right">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {[...Array(4)].map((_, i) => (
              <tr key={i} className="border-b border-slate-100">
                {columns.map((col) => (
                  <td key={col.key} className="px-5 py-4">
                    <div className="h-4 bg-slate-200 rounded animate-pulse w-24" />
                  </td>
                ))}
                <td className="px-5 py-4">
                  <div className="h-4 bg-slate-200 rounded animate-pulse w-16 ml-auto" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-slate-400">
        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
          </svg>
        </div>
        <p className="text-sm font-medium">No records found</p>
        <p className="text-xs mt-1">Add your first entry using the button above</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-200">
            {columns.map((col) => (
              <th
                key={col.key}
                className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-500"
              >
                {col.label}
              </th>
            ))}
            <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-500 text-right">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr
              key={row._id}
              className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors"
            >
              {columns.map((col) => (
                <td
                  key={col.key}
                  className="px-5 py-4 text-sm text-slate-700 whitespace-nowrap"
                >
                  {col.render ? col.render(row) : row[col.key]}
                </td>
              ))}
              <td className="px-5 py-4">
                <div className="flex items-center justify-end gap-1.5">
                  <button
                    onClick={() => onEdit(row)}
                    className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                    title="Edit"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => onDelete(row)}
                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
