import Link from "next/link";

export default function Home() {
  return (
    <main>
      <span className="badge">hewa</span>
      <h1>ISP Partner Portal</h1>
      <p className="subtitle">Where ISPs track their own subscriber base, usage, and payouts.</p>
      <p>
        This is a generated shell. It exists so the workspace shape, build, and deploy path are
        proven before the real surface is built.
      </p>
      <dl>
        <dt>Package</dt>
        <dd>@hewa/isp-partner-portal</dd>
        <dt>Development port</dt>
        <dd>3007</dd>
        <dt>Health</dt>
        <dd>
          <Link href="/health">/health</Link>
        </dd>
      </dl>
    </main>
  );
}
