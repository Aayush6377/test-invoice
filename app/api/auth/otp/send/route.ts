import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import sendEmail from "@/lib/email";
import { otpTemplate } from "@/lib/templates";
import { z } from "zod";

const sendOtpSchema = z.object({
  email: z.string().email("Invalid email address"),
  type: z.enum(["VERIFY_EMAIL", "RESET_PASSWORD"]),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validation = sendOtpSchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json({ success: false, message: validation.error.issues[0].message }, { status: 400 });
    }

    const { email, type } = validation.data;

    if (type === "RESET_PASSWORD") {
      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        return NextResponse.json({ success: false, message: "User not found" }, { status: 404 });
      }
    }

    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 min

    await prisma.otp.upsert({
      where: { email_type: { email, type } },
      update: { code: otpCode, expiresAt },
      create: { email, code: otpCode, type, expiresAt },
    });

    const subject = type === "RESET_PASSWORD" ? "Reset Your Password" : "Your Verification Code";
    const htmlContent = otpTemplate(otpCode); 
    
    const emailSent = await sendEmail(email, subject, htmlContent);

    if (!emailSent) {
      return NextResponse.json({ success: false, message: "Failed to send email" }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: "OTP sent successfully" }, { status: 200 });

  } catch {
    return NextResponse.json({ success: false, message: "Internal server error" }, { status: 500 });
  }
}