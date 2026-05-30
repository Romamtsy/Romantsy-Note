import { AlertTriangle, Database, RefreshCw, X } from "lucide-react";
import { useFileStore } from "@/stores/useFileStore";
import { useNoteIndexStore } from "@/stores/useNoteIndexStore";
import { cn } from "@/lib/utils";

export function IndexDiagnosticsSection() {
  const vaultPath = useFileStore((s) => s.vaultPath);
  const {
    isIndexing,
    totalNotes,
    indexedCount,
    lastIndexTime,
    truncated,
    failedFiles,
    allTags,
    buildIndex,
    cancelIndex,
  } = useNoteIndexStore();

  const progress =
    totalNotes > 0 ? Math.min(100, Math.round((indexedCount / totalNotes) * 100)) : 0;
  const lastIndexed = lastIndexTime
    ? new Date(lastIndexTime).toLocaleString()
    : "尚未完成索引";

  return (
    <section className="space-y-4" data-testid="settings-section-index">
      <div className="flex items-center gap-2">
        <Database className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          RAG 索引诊断
        </h3>
      </div>

      <div className="space-y-4 rounded-xl border border-border/60 bg-background/60 p-4">
        <div className="grid gap-3 sm:grid-cols-4">
          <Metric label="文件数" value={String(totalNotes)} />
          <Metric label="已索引" value={`${indexedCount}/${totalNotes || 0}`} />
          <Metric label="标签数" value={String(allTags.length)} />
          <Metric
            label="状态"
            value={isIndexing ? "索引中" : lastIndexTime ? "已完成" : "待构建"}
            tone={isIndexing ? "info" : "default"}
          />
        </div>

        <div className="space-y-2">
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                "h-full rounded-full bg-primary transition-all",
                isIndexing && "animate-pulse",
              )}
              style={{ width: `${isIndexing ? progress : totalNotes ? 100 : 0}%` }}
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>最近完成：{lastIndexed}</span>
            {truncated ? (
              <span className="inline-flex items-center gap-1 text-warning">
                <AlertTriangle className="h-3.5 w-3.5" />
                文件数量过多，索引已截断
              </span>
            ) : null}
          </div>
        </div>

        {failedFiles.length > 0 ? (
          <div className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-xs">
            <div className="mb-2 flex items-center gap-1.5 font-medium text-warning">
              <AlertTriangle className="h-3.5 w-3.5" />
              {failedFiles.length} 个文件索引失败
            </div>
            <div className="max-h-24 space-y-1 overflow-auto text-muted-foreground">
              {failedFiles.slice(0, 6).map((file) => (
                <div key={file.path} className="truncate" title={file.reason}>
                  {file.path}
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => vaultPath && void buildIndex(vaultPath)}
            disabled={!vaultPath || isIndexing}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", isIndexing && "animate-spin")} />
            手动重建索引
          </button>
          {isIndexing ? (
            <button
              type="button"
              onClick={cancelIndex}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted"
            >
              <X className="h-3.5 w-3.5" />
              取消
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function Metric({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "info";
}) {
  return (
    <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div
        className={cn(
          "mt-1 text-lg font-semibold",
          tone === "info" ? "text-primary" : "text-foreground",
        )}
      >
        {value}
      </div>
    </div>
  );
}
