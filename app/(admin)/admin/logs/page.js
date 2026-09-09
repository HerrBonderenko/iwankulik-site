import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/adminAuth";
import { readLogs, listMonths, ACTIONS } from "@/lib/auditLog";

export const dynamic = "force-dynamic";

const ACTION_LABELS = {
  login_ok: "Вхід",
  login_fail: "Невдалий вхід",
  logout: "Вихід",
  upload: "Завантаження фото",
  delete: "Видалення",
  edit: "Редагування",
  save_rejected: "Збереження відхилено",
  save_failed: "Не вдалося зберегти",
  inquiry: "Заявка з сайту",
  spam_blocked: "Заблоковано як спам",
  mail_failed: "Заявка не надійшла листом",
  storage_error: "Збій читання сховища",
};

function formatTs(iso) {
  try {
    return new Date(iso).toLocaleString("uk-UA", {
      timeZone: "Europe/Kyiv",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export default async function LogsPage({ searchParams }) {
  const session = await getSession();
  if (!session.login) redirect("/admin");

  const sp = (await searchParams) || {};
  const months = await listMonths();
  const month = months.includes(sp.month) ? sp.month : months[0];
  const action = ACTIONS.includes(sp.action) ? sp.action : "";
  const logs = await readLogs({ month, action: action || undefined });

  return (
    <div className="admin">
      <div className="admin-top">
        <h1 style={{ fontSize: 18, fontWeight: 500 }}>Журнал подій</h1>
        <Link className="link small" href="/admin">← до адмінки</Link>
      </div>

      <form className="admin-logs-filter" method="get">
        <label>
          місяць
          <select name="month" defaultValue={month}>
            {months.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </label>
        <label>
          дія
          <select name="action" defaultValue={action}>
            <option value="">усі</option>
            {ACTIONS.map((a) => (
              <option key={a} value={a}>{ACTION_LABELS[a] || a}</option>
            ))}
          </select>
        </label>
        <button className="admin-save" type="submit">Показати</button>
      </form>

      <div className="admin-logs-table-wrap">
        <table className="admin-logs-table">
          <thead>
            <tr>
              <th>Час</th>
              <th>Дія</th>
              <th>Користувач</th>
              <th>IP</th>
              <th>Деталі</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((entry, i) => (
              <tr key={i}>
                <td>{formatTs(entry.ts)}</td>
                <td>{ACTION_LABELS[entry.action] || entry.action}</td>
                <td>{entry.user || "—"}</td>
                <td>{entry.ip || "—"}</td>
                <td>{entry.detail || "—"}</td>
              </tr>
            ))}
            {!logs.length && (
              <tr>
                <td colSpan={5} className="muted">Немає записів за обраний період</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
