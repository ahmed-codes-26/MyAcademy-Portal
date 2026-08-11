import { KeyRound, Clock, CheckCircle2, Trash2 } from 'lucide-react';

export default function PasswordRequestCard({ request, onResolve, onDelete }) {
  const isPending = request.status === 'pending';
  const date = new Date(request.createdAt).toLocaleDateString('en-PK', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div
      className={`bg-white rounded-xl border ${isPending ? 'border-amber-200' : 'border-slate-200'} shadow-sm p-4 flex items-start justify-between gap-4 transition-all hover:shadow-md`}
    >
      <div className="flex items-start gap-3 min-w-0">
        <div
          className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
            isPending ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'
          }`}
        >
          {isPending ? <KeyRound className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900 truncate">
            {request.identifier}
          </p>
          {request.message && (
            <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{request.message}</p>
          )}
          <div className="flex items-center gap-1.5 mt-1.5">
            <Clock className="w-3 h-3 text-slate-400" />
            <span className="text-xs text-slate-400">{date}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1.5 flex-shrink-0">
        {isPending && (
          <button
            onClick={() => onResolve(request._id)}
            className="bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
          >
            Resolve
          </button>
        )}
        <button
          onClick={() => onDelete(request._id)}
          className="text-slate-400 hover:text-red-500 p-1.5 rounded-lg hover:bg-red-50 transition-colors"
          title="Delete request"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
