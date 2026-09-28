import Link from "next/link";

export default function Home() {
  return (
    <main>
      <span className="badge">hewa</span>
      <h1>Customer Service Portal</h1>
      <p className="subtitle">Support tickets and order enquiries for customers.</p>
      <p>
        This is a generated shell. It exists so the workspace shape, build, and deploy path are
        proven before the real surface is built.
      </p>
      <dl>
        <dt>Package</dt>
        <dd>@hewa/customer-service-portal</dd>
        <dt>Development port</dt>
        <dd>3003</dd>
        <dt>Health</dt>
        <dd>
          <Link href="/health">/health</Link>
        </dd>
      </dl>
    </main>
  );
}
