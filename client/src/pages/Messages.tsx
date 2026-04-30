import { useQuery, useMutation } from "@tanstack/react-query";
import { EmailLink, PhoneActions } from "@/components/ContactLinks";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { MessageSquare, Loader2, CheckCircle, X } from "lucide-react";

export default function Messages() {
  const { toast } = useToast();
  const { data: messages = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/contact-messages"] });

  const updateMutation = useMutation({
    mutationFn: ({ id, status }: any) => apiRequest("PUT", `/api/contact-messages/${id}`, { status }).then(r => r.json()),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/contact-messages"] }); toast({ title: "Message updated" }); },
  });

  const statusColors: Record<string, string> = {
    new: "bg-blue-100 text-blue-700",
    reviewed: "bg-yellow-100 text-yellow-700",
    closed: "bg-gray-100 text-gray-600",
  };

  return (
    <DashboardLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Contact Messages</h1>
        <p className="text-gray-500 text-sm mt-1">{(messages as any[]).filter((m: any) => m.status === "new").length} new messages</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
      ) : (
        <div className="space-y-3">
          {(messages as any[]).length === 0 ? (
            <div className="bg-white rounded-xl border border-border p-10 text-center text-gray-400">No messages yet</div>
          ) : (messages as any[]).map((m: any) => (
            <div key={m.id} data-testid={`message-card-${m.id}`} className="bg-white rounded-xl border border-border p-5 shadow-sm">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="font-medium text-gray-900">{m.name}</div>
                  <div className="mt-1 flex flex-col gap-1 text-xs text-gray-500">
                    <EmailLink email={m.email} className="text-gray-500" />
                    <PhoneActions phone={m.phone} className="text-gray-500" phoneClassName="text-gray-500" />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[m.status]}`}>{m.status}</span>
                  <span className="text-xs text-gray-400">{m.createdAt ? new Date(m.createdAt).toLocaleDateString() : ""}</span>
                </div>
              </div>
              {m.subject && <div className="text-sm font-medium text-gray-700 mb-1">{m.subject}</div>}
              <p className="text-sm text-gray-600 mb-3">{m.message}</p>
              <div className="flex gap-2">
                {m.status === "new" && (
                  <button onClick={() => updateMutation.mutate({ id: m.id, status: "reviewed" })}
                    className="flex items-center gap-1 text-xs text-yellow-600 hover:text-yellow-700 border border-yellow-200 px-2 py-1 rounded-lg hover:bg-yellow-50 transition-colors">
                    <CheckCircle className="w-3.5 h-3.5" /> Mark Reviewed
                  </button>
                )}
                {m.status !== "closed" && (
                  <button onClick={() => updateMutation.mutate({ id: m.id, status: "closed" })}
                    className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 border border-gray-200 px-2 py-1 rounded-lg hover:bg-gray-50 transition-colors">
                    <X className="w-3.5 h-3.5" /> Close
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </DashboardLayout>
  );
}
