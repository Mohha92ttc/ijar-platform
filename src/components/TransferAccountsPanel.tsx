import React, { useState } from 'react';
import { Copy, Check, CreditCard, Smartphone, Building2, Info } from 'lucide-react';

export type TransferAccountInfo = {
  title?: string;
  subtitle?: string;
  bank_name?: string | null;
  bank_account?: string | null;
  mastercard?: string | null;
  zain_cash?: string | null;
  phone?: string | null;
  account_holder?: string | null;
  instructions?: string | null;
};

function CopyRow({
  label,
  value,
  testId,
}: {
  label: string;
  value: string;
  testId?: string;
}) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  };
  return (
    <div
      className="flex items-center justify-between gap-3 p-3 bg-white rounded-xl border border-slate-100"
      data-testid={testId}
    >
      <div className="min-w-0 text-right">
        <div className="text-[10px] font-bold text-slate-400 mb-0.5">{label}</div>
        <div className="font-mono text-sm font-bold text-slate-800 break-all dir-ltr text-left">{value}</div>
      </div>
      <button
        type="button"
        onClick={copy}
        className="shrink-0 p-2 rounded-lg bg-slate-50 hover:bg-blue-50 text-slate-500 hover:text-blue-600 transition-colors"
        title="نسخ"
      >
        {copied ? <Check size={16} className="text-green-600" /> : <Copy size={16} />}
      </button>
    </div>
  );
}

/** عرض موحّد لحسابات التحويل (منصة ← شريك، أو شريك ← زبون) */
export default function TransferAccountsPanel({
  info,
  className = '',
  testId = 'transfer-accounts-panel',
}: {
  info: TransferAccountInfo;
  className?: string;
  testId?: string;
}) {
  const hasAny =
    info.bank_name ||
    info.bank_account ||
    info.mastercard ||
    info.zain_cash ||
    info.phone ||
    info.account_holder ||
    info.instructions;

  return (
    <div className={`rounded-2xl border border-slate-200 bg-slate-50/80 p-5 ${className}`} data-testid={testId}>
      <div className="flex items-start gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
          <CreditCard size={20} />
        </div>
        <div>
          <h3 className="font-bold text-slate-800">{info.title || 'حسابات التحويل'}</h3>
          {info.subtitle && <p className="text-xs text-slate-500 mt-0.5">{info.subtitle}</p>}
        </div>
      </div>

      {!hasAny ? (
        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-100 rounded-xl p-3">
          لم تُضف حسابات التحويل بعد. أضف رقم ماستركارد و/أو زين كاش من الإعدادات.
        </p>
      ) : (
        <div className="space-y-2">
          {info.account_holder && (
            <div className="flex items-center gap-2 text-sm text-slate-700 px-1">
              <Info size={14} className="text-slate-400" />
              <span>
                باسم: <span className="font-bold">{info.account_holder}</span>
              </span>
            </div>
          )}
          {info.mastercard && (
            <div className="flex items-start gap-2">
              <CreditCard size={16} className="text-slate-400 mt-3 shrink-0" />
              <div className="flex-1">
                <CopyRow label="ماستركارد / فيزا" value={info.mastercard} testId="transfer-mastercard" />
              </div>
            </div>
          )}
          {info.zain_cash && (
            <div className="flex items-start gap-2">
              <Smartphone size={16} className="text-slate-400 mt-3 shrink-0" />
              <div className="flex-1">
                <CopyRow label="زين كاش" value={info.zain_cash} testId="transfer-zain-cash" />
              </div>
            </div>
          )}
          {(info.bank_name || info.bank_account) && (
            <div className="flex items-start gap-2">
              <Building2 size={16} className="text-slate-400 mt-3 shrink-0" />
              <div className="flex-1 space-y-2">
                {info.bank_name && (
                  <div className="px-3 py-2 text-sm">
                    <span className="text-slate-400 text-[10px] font-bold">البنك</span>
                    <div className="font-bold">{info.bank_name}</div>
                  </div>
                )}
                {info.bank_account && (
                  <CopyRow label="رقم الحساب / الآيبان" value={info.bank_account} testId="transfer-bank" />
                )}
              </div>
            </div>
          )}
          {info.phone && !info.zain_cash && (
            <CopyRow label="هاتف للتواصل / التحويل" value={info.phone} testId="transfer-phone" />
          )}
          {info.instructions && (
            <p className="text-xs text-slate-600 whitespace-pre-wrap mt-3 p-3 bg-white rounded-xl border border-slate-100">
              {info.instructions}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
