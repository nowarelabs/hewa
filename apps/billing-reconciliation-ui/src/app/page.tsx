import Link from "next/link";

export default function Home() {
  return (
    <main>
      <span className="badge">hewa</span>
      <h1>Billing Reconciliation UI</h1>
      <p className="subtitle">
        Breaks, discrepancies, and one-click matching for disputed invoices.
      </p>
      <p>
        This is a generated shell. It exists so the workspace shape, build, and deploy path are
        proven before the real surface is built.
      </p>
      <dl>
        <dt>Package</dt>
        <dd>@hewa/billing-reconciliation-ui</dd>
        <dt>Development port</dt>
        <dd>3010</dd>
        <dt>Health</dt>
        <dd>
          <Link href="/health">/health</Link>
        </dd>
      </dl>
    </main>
  );
}
