import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const verifyOtpSchema = z.object({
  email: z.string().email("Invalid email address"),
  code: z.string().length(6, "OTP must be exactly 6 digits"),
  type: z.enum(["VERIFY_EMAIL", "RESET_PASSWORD"]),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validation = verifyOtpSchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json({ success: false, message: validation.error.issues[0].message }, { status: 400 });
    }

    const { email, code, type } = validation.data;

    const otpRecord = await prisma.otp.findUnique({ 
      where: { email_type: { email, type } } 
    });

    if (!otpRecord || otpRecord.code !== code) {
      return NextResponse.json({ success: false, message: "Invalid OTP" }, { status: 400 });
    }

    if (new Date() > otpRecord.expiresAt) {
      await prisma.otp.delete({ where: { email_type: { email, type } } });
      return NextResponse.json({ success: false, message: "OTP has expired" }, { status: 400 });
    }

    if (type === "VERIFY_EMAIL") {
      const existingUser = await prisma.user.findUnique({ where: { email } });
      
      if (!existingUser) {
        await prisma.otp.delete({ where: { email_type: { email, type } } });
        return NextResponse.json({ success: false, message: "Account not found. Please register first" }, { status: 404 });
      }

      await prisma.user.update({
        where: { email },
        data: { emailVerified: new Date() }
      });
    }

    await prisma.otp.delete({ where: { email_type: { email, type } } });

    return NextResponse.json({ success: true, message: "OTP verified successfully" }, { status: 200 });

  } catch {
    return NextResponse.json({ success: false, message: "Internal server error" }, { status: 500 });
  }
}