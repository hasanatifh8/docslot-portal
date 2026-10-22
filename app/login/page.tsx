import { HeartPulse, KeyRound, MessageCircle, Pill, ShieldCheck, Sparkles, Stethoscope, UsersRound } from "@/components/icons";
import { Logo } from "@/components/brand";
import { LoginForm } from "@/components/login-form";

const features = [
  {
    icon: Stethoscope,
    tone: "bg-teal-500/20 text-teal-300 border-teal-500/30 group-hover:text-teal-300",
    title: "OPD in one flow",
    text: "Check-in, triage, consultation and prescription — no paperwork.",
  },
  {
    icon: HeartPulse,
    tone: "bg-rose-500/20 text-rose-300 border-rose-500/30 group-hover:text-rose-300",
    title: "Vitals at a glance",
    text: "Triage captures BP, pulse, SpO₂ and temperature for the doctor.",
  },
  {
    icon: Pill,
    tone: "bg-amber-500/20 text-amber-300 border-amber-500/30 group-hover:text-amber-300",
    title: "Clean prescriptions",
    text: "A printable PDF prescription the moment the visit is finalized.",
  },
  {
    icon: MessageCircle,
    tone: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30 group-hover:text-emerald-300",
    title: "WhatsApp booking",
    text: "Patients book appointments and get reminders right in chat.",
  },
];

// Spiky trace drawn across the mini monitor in the hero.
const ECG_PATH =
  "M0,25 L120,25 L135,10 L145,42 L160,5 L175,38 L185,25 L230,25 L245,8 L255,40 L270,4 L285,39 L295,25 L380,25 L395,12 L405,40 L418,6 L432,36 L442,25 L500,25";

export default function LoginPage() {
  return (
    <main
      className={`grid min-h-dvh w-full flex-1 grid-cols-1 grid-rows-[auto_1fr] overflow-x-hidden bg-slate-50 text-slate-800 antialiased selection:bg-teal-500 selection:text-white lg:grid-cols-12 lg:grid-rows-1`}
    >
      {/* ─── Brand panel (compact banner on phones, full panel on desktop) ─── */}
      <section className="relative flex flex-col justify-between overflow-hidden bg-[#091E28] px-5 py-6 text-white sm:px-10 sm:py-8 lg:col-span-7 lg:p-10 2xl:p-14">
        <div aria-hidden className="absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-tr from-[#021814] via-[#042820]/95 to-[#0c3f35]/90" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#091E28] via-transparent to-[#091E28]/60" />
          <div className="login-dots absolute inset-0 opacity-40" />
          <div className="login-glow absolute -top-32 -left-20 h-96 w-96 rounded-full bg-teal-500/20 blur-[100px]" />
          <div className="absolute right-10 -bottom-20 h-96 w-96 rounded-full bg-emerald-500/15 blur-[120px]" />
        </div>

        <div className="relative flex h-full w-full flex-col justify-between gap-5 sm:gap-8">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-white px-3 py-2 shadow-lg shadow-teal-500/20 ring-2 ring-white/20">
              <Logo className="h-6 sm:h-7" />
            </div>
            <span className="rounded-md border border-teal-400/30 bg-teal-400/20 px-2 py-0.5 text-[10px] font-bold tracking-wider text-teal-300 uppercase">
              HMS
            </span>
          </div>

          <div className="space-y-6 lg:my-auto">
            <div className="max-w-xl space-y-3 sm:space-y-4">
              <div className="hidden items-center gap-2 rounded-lg border border-teal-400/30 bg-teal-900/60 px-3 py-1 text-xs font-semibold text-teal-300 backdrop-blur-sm sm:inline-flex">
                <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                Hospital management, simplified
              </div>
              <h1 className="text-3xl leading-[1.12] font-extrabold tracking-tight sm:text-5xl 2xl:[@media(min-height:960px)]:text-6xl">
                Calmer clinics. <br />
                <span className="bg-gradient-to-r from-teal-300 via-emerald-300 to-amber-200 bg-clip-text text-transparent">
                  Better care.
                </span>
              </h1>
              <p className="hidden text-base leading-relaxed text-slate-300/90 sm:block sm:text-lg">
                One digital workflow for your hospital: patient registration, the OPD queue, vitals, consultations,
                prescriptions and WhatsApp appointment booking.
              </p>
            </div>

            <div aria-hidden className="hidden max-w-lg sm:block">
              <div className="mb-1.5 flex items-center justify-between font-mono text-xs text-teal-300/70">
                <span className="flex items-center gap-1.5">
                  <HeartPulse className="h-3.5 w-3.5 animate-pulse text-rose-400" /> CLINICAL FLOW
                </span>
                <span className="font-semibold tracking-wider text-emerald-400">74 BPM</span>
              </div>
              <div className="flex h-14 items-center overflow-hidden rounded-xl border border-teal-500/20 bg-black/40 px-3 shadow-inner">
                <svg className="h-10 w-full overflow-visible" viewBox="0 0 500 50" fill="none" preserveAspectRatio="none">
                  <line x1="0" y1="25" x2="500" y2="25" stroke="rgba(20,184,166,0.15)" strokeDasharray="2,4" />
                  <path
                    d={ECG_PATH}
                    stroke="#14B8A6"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="login-ecg opacity-50 blur-sm"
                  />
                  <path
                    d={ECG_PATH}
                    stroke="#5EEAD4"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="login-ecg"
                  />
                </svg>
              </div>
            </div>

            <ul className="hidden max-w-2xl grid-cols-2 gap-3.5 lg:[@media(min-height:840px)]:grid">
              {features.map(({ icon: Icon, tone, title, text }) => (
                <li
                  key={title}
                  className="group flex items-start gap-3.5 rounded-2xl border border-white/10 bg-white/5 p-3.5 backdrop-blur-sm transition-all duration-300 hover:border-teal-400/50 hover:bg-white/[0.08]"
                >
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition-transform group-hover:scale-110 ${tone}`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-white">{title}</h2>
                    <p className="mt-0.5 text-xs leading-normal text-slate-300/80">{text}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="hidden flex-wrap items-center gap-x-6 gap-y-3 border-t border-white/10 pt-6 text-xs text-slate-300 lg:flex">
            <div className="flex items-center gap-2">
              <UsersRound className="h-4 w-4 text-emerald-400" />
              <span className="font-medium text-slate-200">Role-based access for every staff member</span>
            </div>
            <div className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-teal-400" />
              <span>Encrypted connection (HTTPS)</span>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Sign-in panel ─── */}
      <section className="relative isolate flex flex-col justify-between gap-6 bg-gradient-to-br from-slate-50 via-teal-50/30 to-emerald-50/20 px-4 py-6 sm:px-10 sm:py-8 lg:col-span-5 lg:p-10">
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute top-1/4 right-0 h-80 w-80 rounded-full bg-teal-200/40 blur-3xl" />
          <div className="absolute bottom-10 left-10 h-72 w-72 rounded-full bg-emerald-200/30 blur-3xl" />
        </div>

        <header className="hidden items-center sm:flex">
          <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
            Secure staff sign-in
          </div>
        </header>

        <div className="mx-auto w-full max-w-md lg:my-auto">
          <div className="mb-6 text-center">
            <div className="mb-3 hidden h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-600 text-white shadow-xl ring-4 shadow-teal-600/20 ring-teal-50 sm:inline-flex">
              <Stethoscope className="h-6 w-6" />
            </div>
            <h2 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">Welcome back</h2>
            <p className="mt-1 text-sm text-slate-500">Sign in to access your hospital console</p>
          </div>

          <div className="login-glass rounded-3xl p-5 shadow-xl sm:p-8">
            <LoginForm />
          </div>

          <p className="mt-6 text-center text-sm font-medium text-slate-500">
            Need an account? Ask your hospital administrator.
          </p>
        </div>

        <footer className="border-t border-slate-200/60 pt-4 text-center text-xs text-slate-400 sm:text-left">
          Built for hospitals and clinics by <span className="font-semibold text-slate-600">Cliccx</span>
        </footer>
      </section>
    </main>
  );
}
