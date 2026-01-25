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
import { ArrowLeft, Check, Loader2, AlertCircle, Banknote } from "lucide-react";
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

  const handleMarkPaid = useCallback(async () => {
    if (!selectedUser) return;

    setIsProcessing(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/payouts/mark-paid", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
    } catch (e: any) {
      setError(e.message || "エラーが発生しました");
    } finally {
      setIsProcessing(false);
    }
  }, [selectedUser]);

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
      </div>
    </main>
  );
}
