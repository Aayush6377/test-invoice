import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { transporter } from "@/lib/email";

export async function POST(req: Request) {
  try {
    const { user, error } = await getUser();
    if (error || !user) {
      return NextResponse.json({ success: false, message: error || "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const toEmail = formData.get("toEmail") as string | null;
    const clientName = formData.get("clientName") as string | "Client";
    const invoiceNumber = formData.get("invoiceNumber") as string | "Invoice";
    const pdfFile = formData.get("pdf") as File | null;

    if (!toEmail || toEmail === "null" || toEmail.trim() === "") {
      return NextResponse.json( { success: false, message: "Recipient email is required." }, { status: 400 } );
    }

    if (!pdfFile) {
      return NextResponse.json( { success: false, message: "PDF file is required." }, { status: 400 } );
    }

    const bytes = await pdfFile.arrayBuffer();
    const buffer = Buffer.from(bytes);

    await transporter.sendMail({
      from: `"${user.companyName || user.name}" <${process.env.EMAIL_USER}>`,
      replyTo: `"${user.companyName || user.name}" <${user.email}>`,
      to: toEmail,
      subject: `Invoice ${invoiceNumber} from ${user.companyName || user.name}`,
      text: `Hello ${clientName},\n\nPlease find attached your invoice (${invoiceNumber}).\n\nThank you for your business!\n\nBest regards,\n${user.companyName || user.name}`,
      attachments: [
        {
          filename: `Invoice_${invoiceNumber}.pdf`,
          content: buffer,
          contentType: "application/pdf",
        },
      ],
    });

    return NextResponse.json({ success: true, message: "Invoice sent successfully" }, { status: 200 });

  } catch {
    return NextResponse.json({ success: false, message: "Internal Server Error" }, { status: 500 });
  }
}