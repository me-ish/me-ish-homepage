// src/app/admin/payouts/AdminPayoutsClient.tsx
"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  Check,
  Loader2,
  AlertCircle,
  Banknote,
  Download,
  CheckCheck,
  Calendar,
  AlertTriangle,
} from "lucide-react";
import type { PendingPayoutRow } from "./page";

type Props = {
  initialData: PendingPayoutRow[];
  stats: {
    totalPendingAmount: number;
    totalPendingCount: number;
    artistCount: number;
  };
};

const formatYen = (n: number) => `¥${n.toLocaleString()}`;

const toJP = (d: string | null) => {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("ja-JP", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  } catch {
    return "—";
  }
};

export default function AdminPayoutsClient({ initialData, stats }: Props) {
  const [data, setData] = useState(initialData);
  const [currentStats, setCurrentStats] = useState(stats);
  const [selectedUser, setSelectedUser] = useState<PendingPayoutRow | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // 一括処理用
  const [showBatchConfirm, setShowBatchConfirm] = useState(false);
  const [isBatchProcessing, setIsBatchProcessing] = useState(false);
  const [batchResult, setBatchResult] = useState<{
    processedCount: number;
    totalAmount: number;
    failedCount: number;
  } | null>(null);
  const [csvWarnings, setCsvWarnings] = useState<string[] | null>(null);

  // 締め日情報の計算
  const now = new Date();
  const currentMonth = now.toLocaleDateString("ja-JP", { year: "numeric", month: "long" });
  const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const daysUntilClose = Math.ceil((lastDayOfMonth.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  const payoutDate = 25;
  const isPayoutMonth = now.getDate() >= 1 && now.getDate() <= payoutDate;

  const handleMarkPaid = useCallback(async () => {
    if (!selectedUser) return;

    setIsProcessing(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/payouts/mark-paid", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-requested-with": "me-ish" },
        body: JSON.stringify({ userId: selectedUser.user_id }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "振込処理に失敗しました");
      }

      // 成功：リストから削除
      setData((prev) => prev.filter((r) => r.user_id !== selectedUser.user_id));
      setCurrentStats((prev) => ({
        totalPendingAmount: prev.totalPendingAmount - (selectedUser.pending_amount ?? 0),
        totalPendingCount: prev.totalPendingCount - (selectedUser.pending_count ?? 0),
        artistCount: prev.artistCount - 1,
      }));

      setSuccessMessage(
        `${selectedUser.display_name || "アーティスト"} への振込を完了としてマークしました（${json.updatedCount}件, ${formatYen(json.totalAmount)}）`
      );
      setSelectedUser(null);

      // 3秒後にメッセージをクリア
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      setError(message || "エラーが発生しました");
    } finally {
      setIsProcessing(false);
    }
  }, [selectedUser]);

  // CSVダウンロード
  const handleDownloadCsv = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/payouts/export-csv");

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || "CSVのダウンロードに失敗しました");
      }

      // 警告チェック
      const warningsHeader = res.headers.get("X-Payout-Warnings");
      if (warningsHeader) {
        const warnings = decodeURIComponent(warningsHeader).split("; ");
        setCsvWarnings(warnings);
        setTimeout(() => setCsvWarnings(null), 10000);
      }

      // ダウンロード
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const disposition = res.headers.get("Content-Disposition");
      const filenameMatch = disposition?.match(/filename="(.+)"/);
      a.download = filenameMatch?.[1] || "payout.csv";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      setError(message || "CSVダウンロードエラー");
    }
  }, []);

  // 一括振込完了
  const handleBatchMarkPaid = useCallback(async () => {
    setIsBatchProcessing(true);
    setError(null);
    setBatchResult(null);

    try {
      const res = await fetch("/api/admin/payouts/mark-batch-paid", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-requested-with": "me-ish" },
        body: JSON.stringify({}),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "一括処理に失敗しました");
      }

      setBatchResult({
        processedCount: json.processedCount,
        totalAmount: json.totalAmount,
        failedCount: json.failedCount,
      });

      // 成功した場合はリストをクリア
      if (json.processedCount > 0) {
        setData([]);
        setCurrentStats({
          totalPendingAmount: 0,
          totalPendingCount: 0,
          artistCount: 0,
        });
      }

      setShowBatchConfirm(false);
      setSuccessMessage(
        `${json.processedCount}名への振込を完了としてマークしました（${formatYen(json.totalAmount)}）`
      );
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      setError(message || "エラーが発生しました");
    } finally {
      setIsBatchProcessing(false);
    }
  }, []);

  return (
    <main className="min-h-screen bg-gradient-to-b from-white to-[#f6fbff] pt-[70px]">
      <div className="mx-auto max-w-6xl px-6 py-8">
        {/* ヘッダー */}
        <div className="flex items-center gap-4 mb-6">
          <Link
            href="/admin"
            className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            ダッシュボード
          </Link>
        </div>

        <div className="flex items-end justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">振込管理</h1>
            <p className="text-sm text-gray-600 mt-1">
              アーティストへの入金待ち一覧と振込完了処理
            </p>
          </div>
        </div>

        {/* 成功メッセージ */}
        {successMessage && (
          <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 flex items-center gap-3">
            <Check className="h-5 w-5 text-emerald-600" />
            <span className="text-emerald-800">{successMessage}</span>
          </div>
        )}

        {/* CSV警告 */}
        {csvWarnings && csvWarnings.length > 0 && (
          <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <div className="flex items-center gap-2 text-amber-800 font-medium mb-2">
              <AlertTriangle className="h-5 w-5" />
              口座未登録のアーティストがいます
            </div>
            <ul className="text-sm text-amber-700 list-disc list-inside">
              {csvWarnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </div>
        )}

        {/* 締め日情報カード */}
        <div className="mb-6 rounded-2xl border bg-gradient-to-r from-sky-50 to-indigo-50 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Calendar className="h-5 w-5 text-sky-600" />
              <div>
                <div className="text-sm font-medium text-gray-900">{currentMonth}分</div>
                <div className="text-xs text-gray-500">
                  締め日まであと{daysUntilClose}日 ・ 振込予定日: 25日
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadCsv}
                disabled={data.length === 0}
                className="rounded-full"
              >
                <Download className="h-4 w-4 mr-1" />
                CSV出力
              </Button>
              <Button
                size="sm"
                onClick={() => setShowBatchConfirm(true)}
                disabled={data.length === 0}
                className="rounded-full bg-emerald-600 hover:bg-emerald-700"
              >
                <CheckCheck className="h-4 w-4 mr-1" />
                一括振込完了
              </Button>
            </div>
          </div>
        </div>

        {/* 統計カード */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="rounded-2xl border bg-white p-4">
            <div className="text-xs text-gray-500">振込待ち総額</div>
            <div className="text-2xl font-bold text-gray-900 mt-1">
              {formatYen(currentStats.totalPendingAmount)}
            </div>
          </div>
          <div className="rounded-2xl border bg-white p-4">
            <div className="text-xs text-gray-500">振込待ち件数</div>
            <div className="text-2xl font-bold text-gray-900 mt-1">
              {currentStats.totalPendingCount}件
            </div>
          </div>
          <div className="rounded-2xl border bg-white p-4">
            <div className="text-xs text-gray-500">対象アーティスト数</div>
            <div className="text-2xl font-bold text-gray-900 mt-1">
              {currentStats.artistCount}名
            </div>
          </div>
        </div>

        {/* テーブル */}
        <div className="rounded-2xl border bg-white overflow-hidden">
          {data.length === 0 ? (
            <div className="py-16 text-center text-gray-500">
              <Banknote className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>振込待ちのアーティストはいません</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[300px]">アーティスト</TableHead>
                  <TableHead className="text-right">件数</TableHead>
                  <TableHead className="text-right">振込待ち金額</TableHead>
                  <TableHead>最古購入日</TableHead>
                  <TableHead>最新購入日</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((row) => (
                  <TableRow key={row.user_id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="relative w-10 h-10 rounded-full overflow-hidden bg-gray-100 flex-shrink-0">
                          {row.avatar_url ? (
                            <Image
                              src={row.avatar_url}
                              alt={row.display_name || ""}
                              fill
                              className="object-cover"
                              unoptimized
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-400 text-lg">
                              👤
                            </div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="font-medium text-gray-900 truncate">
                            {row.display_name || "(名前未設定)"}
                          </div>
                          <div className="text-xs text-gray-500 truncate">
                            {row.user_id.slice(0, 8)}...
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {row.pending_count}件
                    </TableCell>
                    <TableCell className="text-right font-bold text-emerald-600">
                      {formatYen(row.pending_amount)}
                    </TableCell>
                    <TableCell className="text-gray-600">
                      {toJP(row.oldest_purchase_at)}
                    </TableCell>
                    <TableCell className="text-gray-600">
                      {toJP(row.latest_purchase_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedUser(row)}
                        className="rounded-full"
                      >
                        <Check className="h-4 w-4 mr-1" />
                        振込済み
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        {/* 確認ダイアログ */}
        <Dialog open={!!selectedUser} onOpenChange={() => !isProcessing && setSelectedUser(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>振込完了の確認</DialogTitle>
              <DialogDescription>
                以下のアーティストへの振込を完了としてマークしますか？
              </DialogDescription>
            </DialogHeader>

            {selectedUser && (
              <div className="py-4 space-y-3">
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                  <div className="relative w-12 h-12 rounded-full overflow-hidden bg-gray-200 flex-shrink-0">
                    {selectedUser.avatar_url ? (
                      <Image
                        src={selectedUser.avatar_url}
                        alt={selectedUser.display_name || ""}
                        fill
                        className="object-cover"
                        unoptimized
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400 text-xl">
                        👤
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="font-medium">
                      {selectedUser.display_name || "(名前未設定)"}
                    </div>
                    <div className="text-sm text-gray-500">
                      {selectedUser.pending_count}件 ・{" "}
                      <span className="font-bold text-emerald-600">
                        {formatYen(selectedUser.pending_amount)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="text-sm text-gray-600 bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <strong>注意:</strong> この操作を実行すると、該当アーティストの全ての「入金待ち」売上が「入金済み」に更新されます。
                  実際の銀行振込が完了してから実行してください。
                </div>

                {error && (
                  <div className="flex items-center gap-2 text-red-600 text-sm">
                    <AlertCircle className="h-4 w-4" />
                    {error}
                  </div>
                )}
              </div>
            )}

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setSelectedUser(null)}
                disabled={isProcessing}
              >
                キャンセル
              </Button>
              <Button
                onClick={handleMarkPaid}
                disabled={isProcessing}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    処理中...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    振込完了としてマーク
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* 一括振込完了の確認ダイアログ */}
        <Dialog open={showBatchConfirm} onOpenChange={() => !isBatchProcessing && setShowBatchConfirm(false)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>一括振込完了の確認</DialogTitle>
              <DialogDescription>
                全アーティストへの振込を一括で完了としてマークしますか？
              </DialogDescription>
            </DialogHeader>

            <div className="py-4 space-y-3">
              <div className="p-4 bg-gray-50 rounded-xl space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">対象アーティスト数</span>
                  <span className="font-bold">{currentStats.artistCount}名</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">振込対象件数</span>
                  <span className="font-bold">{currentStats.totalPendingCount}件</span>
                </div>
                <div className="flex justify-between text-sm border-t pt-2 mt-2">
                  <span className="text-gray-600">振込総額</span>
                  <span className="font-bold text-emerald-600 text-lg">
                    {formatYen(currentStats.totalPendingAmount)}
                  </span>
                </div>
              </div>

              <div className="text-sm text-gray-600 bg-amber-50 border border-amber-200 rounded-lg p-3">
                <strong>注意:</strong> この操作を実行すると、全アーティストの「入金待ち」売上が「入金済み」に更新されます。
                実際の銀行振込が完了してから実行してください。
              </div>

              {error && (
                <div className="flex items-center gap-2 text-red-600 text-sm">
                  <AlertCircle className="h-4 w-4" />
                  {error}
                </div>
              )}
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowBatchConfirm(false)}
                disabled={isBatchProcessing}
              >
                キャンセル
              </Button>
              <Button
                onClick={handleBatchMarkPaid}
                disabled={isBatchProcessing}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                {isBatchProcessing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    処理中...
                  </>
                ) : (
                  <>
                    <CheckCheck className="h-4 w-4 mr-2" />
                    一括振込完了
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </main>
  );
}
