"use client";

import { useEffect, useState } from "react";
import InvoiceLayout from "@/components/Invoice";
import { useParams } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function UpdateInvoicePage() {
  const { id } = useParams();
  const [data, setData] = useState(null);

  useEffect(() => {
    if (!id) return;
    
    fetch(`/api/user/invoices/${id}`)
      .then((res) => res.json())
      .then((json) => {
        if (json.success && json.invoice) {
          const raw = json.invoice;
          
          const formattedData = {
            ...raw,
            issueDate: raw.issueDate ? raw.issueDate.split("T")[0] : "",
            dueDate: raw.dueDate ? raw.dueDate.split("T")[0] : "",
            logoUrl: raw.senderLogoUrl || null,
          };
          
          setData(formattedData);
        }
      })
      .catch((err) => console.error("Error fetching invoice:", err));
  }, [id]);

  if (!data) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center text-slate-500 gap-4">
        <Loader2 className="animate-spin w-8 h-8 text-blue-600" />
        <span className="font-medium">Loading Invoice Data...</span>
      </div>
    );
  }

  return <InvoiceLayout mode="update" initialData={data} invoiceId={id as string} />;
}