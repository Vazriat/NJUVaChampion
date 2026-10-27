"use client";

/**
 * 全局对话框基础设施。
 *
 * 目的：替代 window.confirm() / window.alert()。原生对话框由浏览器绘制，
 * CSS 完全无法干预（标题是「域名 + 显示」、按钮文案固定、移动端走系统弹窗），
 * 与本项目的深色 + 红色主题完全割裂。
 *
 * 用法：
 *   在组件内 const ask = useConfirm(); const notify = useNotify();
 *   if (!(await ask("确定删除？"))) return;
 *   notify("删除成功", "success");
 *
 * 语义对齐原生：
 *   - ask() 返回 Promise<boolean>，确认 true，取消 / ESC / 点遮罩 false
 *   - 多处同时发起时排队，逐个显示，不会互相覆盖（原生 confirm 是阻塞的）
 *   - 默认焦点在确定按钮上，回车即确认（与浏览器原生行为一致）
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";

export interface ConfirmOptions {
  /** 卡片标题，不传则显示「提示」 */
  title?: string;
  /** 正文，字符串里的 \n 会保留换行 */
  message: ReactNode;
  /** 主按钮文案，默认「确定」 */
  okText?: string;
  /** 次按钮文案，默认「取消」 */
  cancelText?: string;
  /** 危险操作：主按钮改用深红实心 */
  danger?: boolean;
}

export type ToastKind = "success" | "error" | "info";

interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
}

interface PendingConfirm {
  options: ConfirmOptions;
  resolve: (value: boolean) => void;
}

interface DialogContextValue {
  confirm: (options: ConfirmOptions | string) => Promise<boolean>;
  notify: (message: string, kind?: ToastKind) => void;
}

const DialogContext = createContext<DialogContextValue | null>(null);

const TOAST_STYLE: Record<ToastKind, string> = {
  success: "border-l-emerald-500",
  error: "border-l-red-500",
  info: "border-l-zinc-500",
};

export function DialogProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState<PendingConfirm | null>(null);
  const activeRef = useRef<PendingConfirm | null>(null);
  const queueRef = useRef<PendingConfirm[]>([]);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const toastSeq = useRef(0);

  const confirm = useCallback((options: ConfirmOptions | string) => {
    const opts: ConfirmOptions =
      typeof options === "string" ? { message: options } : options;
    return new Promise<boolean>((resolve) => {
      // 原生 confirm 是阻塞的，双击按钮不可能弹出两个框；改成 Promise 之后
      // 按钮在等待期间仍可点击，所以这里挡掉「文案完全相同」的重复请求，
      // 直接按取消处理，避免重复提交。
      const key = typeof opts.message === "string" ? opts.message : null;
      if (key !== null) {
        const sameActive =
          activeRef.current && activeRef.current.options.message === key;
        const sameQueued = queueRef.current.some(
          (q) => q.options.message === key
        );
        if (sameActive || sameQueued) {
          resolve(false);
          return;
        }
      }
      const item: PendingConfirm = { options: opts, resolve };
      if (activeRef.current) {
        queueRef.current.push(item);
      } else {
        activeRef.current = item;
        setActive(item);
      }
    });
  }, []);

  const close = useCallback((result: boolean) => {
    const current = activeRef.current;
    if (current) current.resolve(result);
    const next = queueRef.current.shift() ?? null;
    activeRef.current = next;
    setActive(next);
  }, []);

  const notify = useCallback((message: string, kind: ToastKind = "info") => {
    const id = ++toastSeq.current;
    setToasts((prev) => [...prev, { id, kind, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3200);
  }, []);

  useEffect(() => {
    if (!active) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [active, close]);

  const opts = active?.options;
  const danger = opts?.danger ?? false;

  return (
    <DialogContext.Provider value={{ confirm, notify }}>
      {children}

      {active && opts && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 max-md:items-end"
          onClick={() => close(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={opts.title ?? "提示"}
            className="w-full max-w-sm rounded-xl border border-zinc-800 bg-zinc-900 p-6 text-white max-md:p-4 safe-bottom max-md:max-h-[92dvh] max-md:overflow-y-auto max-md:rounded-b-none max-md:rounded-t-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold">{opts.title ?? "提示"}</h3>
            <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-zinc-400">
              {opts.message}
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => close(false)}
                className="rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-300 transition hover:border-zinc-600 hover:text-white max-md:min-h-11"
              >
                {opts.cancelText ?? "取消"}
              </button>
              <button
                type="button"
                autoFocus
                onClick={() => close(true)}
                className={`rounded-lg px-4 py-2 text-sm font-medium text-white outline-none transition focus:ring-2 focus:ring-offset-2 focus:ring-offset-zinc-900 max-md:min-h-11 ${
                  danger
                    ? "bg-red-700 hover:bg-red-600 focus:ring-red-700"
                    : "bg-red-600 hover:bg-red-500 focus:ring-red-500"
                }`}
              >
                {opts.okText ?? "确定"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="pointer-events-none fixed left-1/2 top-4 z-[110] flex w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={`rounded-lg border border-zinc-800 border-l-2 bg-zinc-900 px-4 py-2.5 text-sm text-zinc-200 shadow-lg ${TOAST_STYLE[t.kind]}`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </DialogContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error("useConfirm 必须在 DialogProvider 内使用");
  return ctx.confirm;
}

export function useNotify() {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error("useNotify 必须在 DialogProvider 内使用");
  return ctx.notify;
}
