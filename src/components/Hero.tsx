import { ShieldCheck, WifiOff, Zap } from 'lucide-react';

const TRUST_POINTS = [
  {
    icon: ShieldCheck,
    title: 'Your files never leave your device',
    body: 'Conversion runs inside your browser with WebAssembly. Nothing is uploaded, logged or stored.',
    tone: 'text-emerald-500 bg-emerald-500/10',
  },
  {
    icon: WifiOff,
    title: 'Works offline',
    body: 'Once the page has loaded you can pull the plug. The converters are cached for next time.',
    tone: 'text-sky-500 bg-sky-500/10',
  },
  {
    icon: Zap,
    title: 'No sign-up, no limits',
    body: 'Batch-convert as many files as your machine can handle. No accounts, no queues, no watermarks.',
    tone: 'text-amber-500 bg-amber-500/10',
  },
];

export function Hero({ compact }: { compact: boolean }) {
  if (compact) {
    return (
      <p className="muted flex items-center justify-center gap-2 py-5 text-center text-sm">
        <ShieldCheck size={16} className="shrink-0 text-emerald-500" />
        Everything happens in your browser. Your files never leave your device.
      </p>
    );
  }

  return (
    <section className="pb-8 pt-12 text-center sm:pt-16">
      <span className="badge border border-indigo-500/20 bg-indigo-500/10 text-indigo-600 dark:text-indigo-300">
        <ShieldCheck size={12} /> 100% client-side
      </span>
      <h1 className="mt-5 text-4xl font-bold tracking-tight sm:text-5xl">
        Convert any file.
        <br />
        <span className="gradient-text">Without uploading it.</span>
      </h1>
      <p className="muted mx-auto mt-4 max-w-xl text-base sm:text-lg">
        Images, video, audio and documents converted right here in your browser. Drop a file, pick a
        format, download the result.
      </p>

      <ul className="mt-10 grid gap-3 text-left sm:grid-cols-3">
        {TRUST_POINTS.map(({ icon: Icon, title, body, tone }) => (
          <li key={title} className="card p-4">
            <span className={`grid h-9 w-9 place-items-center rounded-lg ${tone}`}>
              <Icon size={18} />
            </span>
            <h2 className="mt-3 text-sm font-semibold">{title}</h2>
            <p className="muted mt-1 text-sm leading-relaxed">{body}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
