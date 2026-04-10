import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";

export async function getUser() {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user || !(session.user as any).id) {
      return { user: null, error: "Unauthorized" };
    }

    const userId = (session.user as any).id;

    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      return { user: null, error: "User not found" };
    }

    return { user, error: null };
  } catch {
    return { user: null, error: "Unauthorized" };
  }
}