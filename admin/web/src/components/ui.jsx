import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import {
  AlertTriangle, CheckCircle2, ChevronDown, Info, Loader2, X, XCircle,
} from "lucide-react";

// ---------------------------------------------------------------- data loading

// Runs `fn` when `deps` change; `reload()` runs it again. Keeps the last data while reloading.
export function useLoad(fn, deps) {
  const [state, setState] = useState({ data: undefined, error: null, loading: true });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let live = true;
    setState((s) => ({ ...s, loading: true }));
    Promise.resolve()
      .then(fn)
      .then((data) => live && setState({ data, error: null, loading: false }))
      .catch((error) => live && setState((s) => ({ ...s, error, loading: false })));
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);
  return { ...state, reload: useCallback(() => setTick((t) => t + 1), []) };
}

// ---------------------------------------------------------------- toasts

const ToastCtx = createContext(() => {});

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const id = useRef(0);
  const dismiss = (tid) => setToasts((t) => t.filter((x) => x.id !== tid));
  const toast = useCallback((kind, message) => {
    const tid = ++id.current;
    setToasts((t) => [...t, { id: tid, kind, message }]);
    setTimeout(() => dismiss(tid), kind === "error" ? 8000 : 4500);
  }, []);
  return (
    <ToastCtx.Provider value={toast}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.kind}`}>
            <AlertIcon tone={t.kind} />
            <span>{t.message}</span>
            <button className="icon-btn" onClick={() => dismiss(t.id)} aria-label="Dismiss"><X size={16} /></button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

// toast("success" | "error" | "warning" | "info", message)
export const useToast = () => useContext(ToastCtx);

// Wraps an async action: shows its returned { message } as a success toast, errors as error toasts.
export function useAction() {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const run = useCallback(async (fn, { quiet = false } = {}) => {
    setBusy(true);
    try {
      const res = await fn();
      if (!quiet && res && res.message) toast("success", res.message);
      return res;
    } catch (e) {
      toast("error", e.message);
      return undefined;
    } finally {
      setBusy(false);
    }
  }, [toast]);
  return [run, busy];
}

// ---------------------------------------------------------------- layout pieces

export function Card({ title, icon: IconC, actions, children, className = "", flush = false }) {
  return (
    <section className={`card ${flush ? "card-flush" : ""} ${className}`}>
      {(title || actions) && (
        <header className="card-head">
          {title && <h3>{IconC && <IconC size={18} />}{title}</h3>}
          {actions && <div className="card-actions">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  );
}

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        {subtitle && <p className="muted">{subtitle}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </div>
  );
}

export function Metric({ label, value, hint, tone }) {
  return (
    <div className={`metric ${tone ? `metric-${tone}` : ""}`}>
      <div className="metric-label">{label}</div>
      <div className="metric-value">{value}</div>
      {hint && <div className="metric-hint">{hint}</div>}
    </div>
  );
}

export function Empty({ icon: IconC = Info, title, children }) {
  return (
    <div className="empty">
      <IconC size={28} />
      {title && <strong>{title}</strong>}
      {children && <div className="muted">{children}</div>}
    </div>
  );
}

export function Collapsible({ title, children, defaultOpen = false, tone }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`collapsible ${open ? "open" : ""} ${tone ? `collapsible-${tone}` : ""}`}>
      <button className="collapsible-head" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span>{title}</span>
        <ChevronDown size={18} className="chev" />
      </button>
      {open && <div className="collapsible-body">{children}</div>}
    </div>
  );
}

export function Progress({ value, label }) {
  const pct = Math.round(Math.max(0, Math.min(1, value || 0)) * 100);
  return (
    <div className="progress-wrap">
      {label && <div className="progress-label"><span>{label}</span><span>{pct}%</span></div>}
      <div className="progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className="progress-bar" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- feedback

function AlertIcon({ tone }) {
  const I = { success: CheckCircle2, error: XCircle, warning: AlertTriangle }[tone] || Info;
  return <I size={18} className="alert-icon" />;
}

export function Alert({ tone = "info", title, children, onClose }) {
  return (
    <div className={`alert alert-${tone}`}>
      <AlertIcon tone={tone} />
      <div className="alert-body">
        {title && <strong>{title}</strong>}
        {children && <div>{children}</div>}
      </div>
      {onClose && <button className="icon-btn" onClick={onClose} aria-label="Dismiss"><X size={16} /></button>}
    </div>
  );
}

// tone: green | blue | orange | gray | red | teal (soft pastel backgrounds)
export function Badge({ tone = "gray", icon: IconC, children }) {
  return <span className={`badge badge-${tone}`}>{IconC && <IconC size={14} />}{children}</span>;
}

// ---------------------------------------------------------------- reference-look building blocks

// Square 38px icon button (#F4F4F4, 10px radius) for "+", copy, bell and similar.
// Props: icon (lucide component), label (required; used as aria-label), plus any button attributes.
export function IconButton({ icon: IconC, label, className = "", ...rest }) {
  return (
    <button type="button" className={`icon-square ${className}`} aria-label={label} title={label} {...rest}>
      <IconC size={18} />
    </button>
  );
}

// Pastel summary card.
// Props: tone ("lilac" | "sage" | "blush" | "sky" | "sand"), icon (lucide component), label, sub,
//        value (shown large, tabular), onClick (optional; makes the card a button).
export function StatCard({ tone = "sage", icon: IconC, label, sub, value, onClick }) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag className={`stat-card stat-${tone}`} onClick={onClick} type={onClick ? "button" : undefined}>
      <div className="stat-head">
        {IconC && <span className="stat-icon"><IconC size={16} /></span>}
        <div className="stat-text">
          <div className="stat-label">{label}</div>
          {sub && <div className="stat-sub">{sub}</div>}
        </div>
      </div>
      <div className="stat-value">{value}</div>
    </Tag>
  );
}

// Black "bank card" tile.
// Props: title, amount (big figure), footLeft, footRight (small grey footer text), chip (top-right pill).
export function InkCard({ title, amount, footLeft, footRight, chip }) {
  return (
    <section className="ink-card">
      <div className="ink-top">
        <span className="ink-title">{title}</span>
        {chip && <span className="ink-chip">{chip}</span>}
      </div>
      <div className="ink-amount">{amount}</div>
      <div className="ink-foot">
        <span>{footLeft}</span>
        <span>{footRight}</span>
      </div>
    </section>
  );
}

// Light grey rounded container for right-rail lists.
// Props: title (optional), action (optional link label, e.g. "View all"), onAction (its click handler), children.
export function Panel({ title, action, onAction, children, className = "" }) {
  return (
    <section className={`panel ${className}`}>
      {(title || action) && (
        <header className="panel-head">
          {title && <h3>{title}</h3>}
          {action && <button type="button" className="link-btn" onClick={onAction}>{action}</button>}
        </header>
      )}
      {children}
    </section>
  );
}

// One row inside a Panel: icon in a white 32px square, title, muted sub line, right-aligned value.
// Props: icon (lucide component), title, sub, value, onClick (optional; makes the row a button).
export function ListRow({ icon: IconC, title, sub, value, onClick }) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag className="list-row" onClick={onClick} type={onClick ? "button" : undefined}>
      {IconC && <span className="list-icon"><IconC size={16} /></span>}
      <span className="list-text">
        <span className="list-title">{title}</span>
        {sub && <span className="list-sub">{sub}</span>}
      </span>
      {value !== undefined && value !== null && <span className="list-value">{value}</span>}
    </Tag>
  );
}

// ---------------------------------------------------------------- controls

// variant: primary | secondary | ghost | danger
export function Button({ variant = "secondary", icon: IconC, busy, children, className = "", size, ...rest }) {
  return (
    <button className={`btn btn-${variant} ${size === "sm" ? "btn-sm" : ""} ${className}`}
      disabled={busy || rest.disabled} {...rest}>
      {busy ? <Loader2 size={16} className="spin" /> : IconC && <IconC size={16} />}
      {children && <span>{children}</span>}
    </button>
  );
}

// Field props:
//   label, hint, error   text shown above (label) and below the control (hint, or error in red)
//   variant              "box" (default: boxed input) | "line" (reference look: label on the left,
//                        a 1px ink divider, then an underline-only input)
//   trailing             optional node shown after the input, e.g. an icon (line variant)
export function Field({ label, hint, error, children, className = "", variant = "box", trailing }) {
  const bottom = error ? <span className="field-error">{error}</span> : hint && <span className="field-hint">{hint}</span>;
  if (variant === "line") {
    return (
      <label className={`field field-line ${className}`}>
        <span className="field-line-row">
          {label && <span className="field-line-label">{label}</span>}
          <span className="field-line-divider" aria-hidden="true" />
          <span className="field-line-control">{children}</span>
          {trailing && <span className="field-trailing">{trailing}</span>}
        </span>
        {bottom}
      </label>
    );
  }
  return (
    <label className={`field ${className}`}>
      {label && <span className="field-label">{label}</span>}
      {children}
      {bottom}
    </label>
  );
}

export const Input = (props) => <input className="input" {...props} />;
export const Textarea = (props) => <textarea className="input" rows={3} {...props} />;

export function MoneyInput({ value, onChange, ...rest }) {
  return (
    <div className="money-input">
      <span>£</span>
      <input className="input" type="number" min="0" step="0.01" inputMode="decimal"
        value={value ?? ""} onChange={(e) => onChange(e.target.value === "" ? "" : e.target.value)} {...rest} />
    </div>
  );
}

// options: array of strings or { value, label }
export function Select({ options, value, onChange, ...rest }) {
  return (
    <select className="input" value={value ?? ""} onChange={(e) => onChange(e.target.value)} {...rest}>
      {options.map((o) => {
        const v = typeof o === "object" ? o.value : o;
        const l = typeof o === "object" ? o.label : o;
        return <option key={v} value={v}>{l}</option>;
      })}
    </select>
  );
}

export function Toggle({ checked, onChange, label, ...rest }) {
  return (
    <label className="toggle">
      <input type="checkbox" checked={!!checked} onChange={(e) => onChange(e.target.checked)} {...rest} />
      <span className="toggle-track"><span className="toggle-thumb" /></span>
      {label && <span>{label}</span>}
    </label>
  );
}

// options: array of strings or { value, label, icon }
export function Segmented({ options, value, onChange, ariaLabel }) {
  return (
    <div className="segmented" role="tablist" aria-label={ariaLabel}>
      {options.map((o) => {
        const v = typeof o === "object" ? o.value : o;
        const l = typeof o === "object" ? o.label : o;
        const IconC = typeof o === "object" ? o.icon : null;
        return (
          <button key={v} role="tab" aria-selected={value === v} className={value === v ? "active" : ""}
            onClick={() => onChange(v)}>
            {IconC && <IconC size={16} />}{l}
          </button>
        );
      })}
    </div>
  );
}

// tabs: [{ id, label, icon, count }]
export function Tabs({ tabs, value, onChange }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((t) => (
        <button key={t.id} role="tab" aria-selected={value === t.id} className={value === t.id ? "active" : ""}
          onClick={() => onChange(t.id)}>
          {t.icon && <t.icon size={16} />}{t.label}
          {t.count ? <span className="tab-count">{t.count}</span> : null}
        </button>
      ))}
    </div>
  );
}
