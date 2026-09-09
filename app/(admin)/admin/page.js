import { getSession } from "@/lib/adminAuth";
import LoginForm from "./LoginForm";
import AdminApp from "./AdminApp";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const session = await getSession();
  if (!session.login) return <LoginForm />;
  return <AdminApp user={{ login: session.login, name: session.name }} />;
}
