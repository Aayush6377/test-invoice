import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUser } from "@/lib/auth";
import { deleteImage, uploadImage } from "@/lib/uploads";

export async function GET() {
  try {
    const { user, error } = await getUser();
    if (error || !user) {
      return NextResponse.json({ success: false, message: error || "Unauthorized" }, { status: 401 });
    }

    const profileData = {
      name: user.name,
      email: user.email,
      companyName: user.companyName,
      companyAddress: user.companyAddress,
      city: user.city,
      state: user.state,
      zip: user.zip,
      country: user.country,
      logoUrl: user.logoUrl,
    };

    return NextResponse.json({ success: true, profile: profileData }, { status: 200 });
  } catch {
    return NextResponse.json({ success: false, message: "Internal Server Error" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const { user, error } = await getUser();
    if (error || !user) {
      return NextResponse.json({ success: false, message: error || "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    
    const companyName = formData.get("companyName") as string | null;
    const companyAddress = formData.get("companyAddress") as string | null;
    const city = formData.get("city") as string | null;
    const state = formData.get("state") as string | null;
    const zip = formData.get("zip") as string | null;
    const country = formData.get("country") as string | null;

    const logoFile = formData.get("logo") as File | null;
    let logoUrl = user.logoUrl; 

    if (logoFile && logoFile.size > 0) {
      const { url, error: uploadError } = await uploadImage(logoFile, "logos");
      
      if (uploadError || !url) {
        return NextResponse.json({ success: false, message: uploadError }, { status: 500 });
      }

      if (user.logoUrl) {
        await deleteImage(user.logoUrl);
      }
      
      logoUrl = url;
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        ...(companyName !== null && { companyName }),
        ...(companyAddress !== null && { companyAddress }),
        ...(city !== null && { city }),
        ...(state !== null && { state }),
        ...(zip !== null && { zip }),
        ...(country !== null && { country }),
        logoUrl,
      }
    });

    return NextResponse.json({ success: true, message: "Profile updated successfully" }, { status: 200 });

  } catch {
    return NextResponse.json({ success: false, message: "Internal Server Error" }, { status: 500 });
  }
}