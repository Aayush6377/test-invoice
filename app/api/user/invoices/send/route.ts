import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { transporter } from "@/lib/email";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const { user } = await getUser();

    const formData = await req.formData();
    const toEmail = formData.get("toEmail") as string | null;
    const clientName = formData.get("clientName") as string | "Client";
    const invoiceNumber = formData.get("invoiceNumber") as string | "Invoice";
    const senderNameStr = formData.get("senderName") as string | null;
    const pdfFile = formData.get("pdf") as File | null;
    const invoiceId = formData.get("invoiceId") as string | null;

    if (!toEmail || toEmail === "null" || toEmail.trim() === "") {
      return NextResponse.json({ success: false, message: "Recipient email is required." }, { status: 400 });
    }

    if (!pdfFile) {
      return NextResponse.json({ success: false, message: "PDF file is required." }, { status: 400 });
    }

    const bytes = await pdfFile.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const senderName = user?.companyName || user?.name || senderNameStr || "Invoice Generator";
    const replyToEmail = user?.email || undefined;

    const mailOptions: any = {
      from: `"${senderName}" <${process.env.EMAIL_USER}>`,
      to: toEmail,
      subject: `Invoice ${invoiceNumber} from ${senderName}`,
      text: `Hello ${clientName},\n\nPlease find attached your invoice (${invoiceNumber}).\n\nThank you for your business!\n\nBest regards,\n${senderName}`,
      attachments: [
        {
          filename: `Invoice_${invoiceNumber}.pdf`,
          content: buffer,
          contentType: "application/pdf",
        },
      ],
    };

    if (replyToEmail) {
      mailOptions.replyTo = `"${senderName}" <${replyToEmail}>`;
    }

    await transporter.sendMail(mailOptions);

    if (user && invoiceId) {
      try {
        await prisma.invoice.update({
          where: { id: invoiceId, userId: user.id }, 
          data: { status: "SENT" }
        });
      } catch (dbError) {
        console.warn("Failed to update invoice status in DB:", dbError);
      }
    }

    return NextResponse.json({ success: true, message: "Invoice sent successfully" }, { status: 200 });

  } catch {
    return NextResponse.json({ success: false, message: "Internal Server Error" }, { status: 500 });
  }
}