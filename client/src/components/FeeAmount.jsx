import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

export function FeeVisibilityButton({ visible, onToggle, label }) {
  const action = `${visible ? 'Hide' : 'Show'} ${label}`;
  return (
    <button type="button" onClick={onToggle} aria-label={action} title={action} aria-pressed={visible}
      className="inline-flex shrink-0 items-center justify-center rounded-md p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 focus-visible:outline-2 focus-visible:outline-amber-500 focus-visible:outline-offset-2 transition-colors">
      {visible ? <EyeOff aria-hidden="true" className="w-4 h-4" /> : <Eye aria-hidden="true" className="w-4 h-4" />}
    </button>
  );
}

export default function FeeAmount({ children, label = 'fee amount', currency = 'PKR' }) {
  const [visible, setVisible] = useState(false);
  return (
    <span className="inline-flex max-w-full items-center gap-1.5 align-middle">
      <FeeVisibilityButton visible={visible} onToggle={() => setVisible((value) => !value)} label={label} />
      {/* Both layers keep their footprint so toggling cannot resize a table column. */}
      <span className="inline-grid tabular-nums whitespace-nowrap">
        <span aria-hidden={!visible} className={`col-start-1 row-start-1 ${visible ? 'visible' : 'invisible'}`}>{children}</span>
        <span aria-hidden={visible} className={`col-start-1 row-start-1 ${visible ? 'invisible' : 'visible'}`}>
          <span aria-hidden="true">{currency} ****</span><span className="sr-only">Amount hidden</span>
        </span>
      </span>
    </span>
  );
}
