import { requireAdmin } from "@/lib/adminAuth";
import LoginForm from "./LoginForm";
import AdminApp from "./AdminApp";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  // requireAdmin ще й звіряє сесію з моментом останнього виходу (R-01).
  const admin = await requireAdmin();
  if (!admin) return <LoginForm />;
  return <AdminApp user={admin} />;
}
