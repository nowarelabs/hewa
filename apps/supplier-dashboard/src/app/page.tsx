import Link from "next/link";

export default function Home() {
  return (
    <main>
      <span className="badge">hewa</span>
      <h1>Supplier Dashboard</h1>
      <p className="subtitle">Supply-side view of fulfilment, capacity, and settlement.</p>
      <p>
        This is a generated shell. It exists so the workspace shape, build, and deploy path are
        proven before the real surface is built.
      </p>
      <dl>
        <dt>Package</dt>
        <dd>@hewa/supplier-dashboard</dd>
        <dt>Development port</dt>
        <dd>3008</dd>
        <dt>Health</dt>
        <dd>
          <Link href="/health">/health</Link>
        </dd>
      </dl>
    </main>
  );
}
