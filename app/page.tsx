import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { ArrowRight, Check } from "lucide-react";
import {
  BarChart3,
  CalendarHeart,
  ClipboardPlus,
  HeartPulse,
  IndianRupee,
  MessageCircle,
  Monitor,
  Pill,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  UserRoundPlus,
  UsersRound,
  Wallet,
} from "@/components/icons";
import { getCurrentUser } from "@/lib/auth";
import { Logo } from "@/components/brand";
import { DemoForm } from "@/components/demo-form";

export const metadata: Metadata = {
  title: "DocSlot HMS — Hospital management that your staff will love",
  description:
    "OPD, appointments, WhatsApp booking, doctor consultation, billing, finance and forecasting for Indian hospitals and clinics — in one simple app.",
};

// ── Edit these to match your commercial plans ──────────────────────────────
const PLANS = [
  {
    name: "Clinic",
    price: "₹2,499",
    per: "/month",
    tagline: "For clinics with up to 3 doctors",
    features: ["Registration, OPD queue & tokens", "Appointments + WhatsApp booking", "Doctor consultation & e-prescriptions", "Billing, receipts & day-end cash", "Up to 3 doctors · unlimited staff"],
    cta: "Start with Clinic",
  },
  {
    name: "Hospital",
    price: "₹6,999",
    per: "/month",
    tagline: "For multispecialty hospitals",
    features: ["Everything in Clinic", "Finance, expenses & P&L", "Forecasting & revenue targets", "Reports, CSV export & audit log", "Up to 15 doctors · token display screen"],
    cta: "Start with Hospital",
    featured: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    per: "",
    tagline: "Hospital groups & chains",
    features: ["Everything in Hospital", "Unlimited doctors & branches", "Your own WhatsApp number", "Priority onboarding & training", "Dedicated success manager"],
    cta: "Talk to us",
  },
];

const FEATURES = [
  { icon: UserRoundPlus, title: "5-step registration", text: "Families on one phone number, duplicate check, UHID in seconds.", tone: "from-sky-400 to-sky-600" },
  { icon: ClipboardPlus, title: "OPD in one flow", text: "Check-in, token, triage, consultation, prescription — no paper.", tone: "from-brand-400 to-brand-700" },
  { icon: Stethoscope, title: "Built for doctors", text: "Templates, dictation, drug & ICD-10 auto-complete, allergy alerts.", tone: "from-rose-400 to-rose-600" },
  { icon: MessageCircle, title: "WhatsApp booking", text: "Patients book, reschedule and get reminders right in WhatsApp.", tone: "from-emerald-400 to-emerald-600" },
  { icon: IndianRupee, title: "Billing that adds up", text: "Auto consultation bills, UPI/cash/card, receipts, day-end cash.", tone: "from-amber-400 to-amber-600" },
  { icon: BarChart3, title: "Finance & forecasting", text: "Profit & loss, expenses, targets and next-30-day forecasts.", tone: "from-indigo-400 to-indigo-600" },
  { icon: Monitor, title: "Waiting-room display", text: "TV screen with tokens and rooms — calmer waiting areas.", tone: "from-slate-500 to-slate-700" },
  { icon: ShieldCheck, title: "Safe by design", text: "Role-based access, audit log, signed prescriptions, addenda.", tone: "from-violet-400 to-violet-600" },
];

const STEPS = [
  { n: "1", title: "We set you up in a day", text: "Your departments, doctors, fees, hours and staff logins — ready before your first patient." },
  { n: "2", title: "Your team learns in an hour", text: "Guided screens and one-tap choices mean receptionists and nurses are productive on day one." },
  { n: "3", title: "Patients book on WhatsApp", text: "Share your booking link; reminders go out automatically and no-shows drop." },
];

const FAQ = [
  ["Do I need to install anything?", "No. DocSlot runs in the browser on any computer, tablet or phone. The waiting-room display works on any smart TV or monitor with a browser."],
  ["Can family members share one phone number?", "Yes. Each person gets their own UHID and history, and the WhatsApp bot asks who the booking is for."],
  ["How do prescriptions reach the patient?", "Doctors finalize in one click; the signed PDF can be printed or sent to the patient on WhatsApp as a secure link."],
  ["Is our data separate from other hospitals?", "Yes. Every hospital's data is isolated, staff only see what their role allows, and every change is recorded in the audit log."],
  ["Can we try it first?", "Yes — book a demo and we'll show it with your own departments and doctors."],
];

export default async function Home() {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");

  return (
    <div className="min-h-dvh bg-white text-slate-800">
      {/* ── Nav ── */}
      <header className="sticky top-0 z-30 border-b border-slate-100 bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4 sm:px-8">
          <Logo className="h-7" />
          <nav className="ml-6 hidden gap-6 text-sm font-medium text-slate-600 md:flex">
            <a href="#features" className="hover:text-brand-700">Features</a>
            <a href="#product" className="hover:text-brand-700">Product</a>
            <a href="#pricing" className="hover:text-brand-700">Pricing</a>
            <a href="#faq" className="hover:text-brand-700">FAQ</a>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <Link href="/login" className="hidden h-10 items-center rounded-lg px-4 text-sm font-semibold text-slate-700 hover:bg-slate-100 sm:inline-flex">
              Sign in
            </Link>
            <a href="#demo" className="inline-flex h-10 items-center gap-2 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white shadow-md shadow-brand-700/25 hover:bg-brand-700">
              Book a demo
            </a>
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden bg-[#061a1e] text-white">
        <div aria-hidden className="absolute inset-0">
          <div className="absolute -top-40 -left-32 h-[36rem] w-[36rem] rounded-full bg-teal-500/25 blur-[120px]" />
          <div className="absolute top-20 right-0 h-[30rem] w-[30rem] rounded-full bg-emerald-400/15 blur-[120px]" />
          <div className="absolute inset-0 opacity-[0.07]" style={{ backgroundImage: "url(/brand/medical-pattern.svg)", backgroundSize: "320px", filter: "invert(1)" }} />
        </div>
        <div className="relative mx-auto grid max-w-7xl gap-12 px-4 pt-16 pb-10 sm:px-8 lg:grid-cols-[1fr_1.15fr] lg:pt-24">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-teal-300/30 bg-teal-400/10 px-3 py-1 text-xs font-semibold text-teal-200">
              <Sparkles className="h-3.5 w-3.5 text-amber-300" /> Hospital management, simplified
            </span>
            <h1 className="mt-5 text-4xl leading-[1.08] font-extrabold tracking-tight sm:text-5xl lg:text-6xl">
              The hospital app your{" "}
              <span className="bg-gradient-to-r from-teal-300 via-emerald-300 to-amber-200 bg-clip-text text-transparent">staff will love</span>.
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-slate-300">
              Registration, OPD queue, doctor consultation, WhatsApp booking, billing, finance and forecasting — in one calm, beautiful app built for Indian hospitals and clinics.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href="#demo" className="inline-flex h-12 items-center gap-2 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 px-6 font-semibold text-white shadow-lg shadow-teal-600/30 hover:from-teal-600 hover:to-emerald-600">
                Book a free demo <ArrowRight className="h-4 w-4" />
              </a>
              <a href="#product" className="inline-flex h-12 items-center rounded-xl border border-white/20 px-6 font-semibold text-white hover:bg-white/10">
                See it in action
              </a>
            </div>
            <ul className="mt-8 grid max-w-md grid-cols-2 gap-x-6 gap-y-2 text-sm text-slate-300">
              {["No installation — runs in the browser", "UPI, cash & card billing", "WhatsApp booking & reminders", "Works on tablets & phones"].map((t) => (
                <li key={t} className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-emerald-400" /> {t}
                </li>
              ))}
            </ul>
          </div>
          <div className="relative">
            <BrowserFrame src="/marketing/dashboard.png" alt="DocSlot dashboard" priority />
            <div className="absolute -bottom-6 -left-4 hidden rounded-2xl bg-white p-4 text-slate-800 shadow-2xl ring-1 ring-slate-900/5 sm:block">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 flex-col items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white">
                  <span className="text-[8px] font-semibold uppercase opacity-80">Token</span>
                  <span className="text-lg leading-none font-extrabold">14</span>
                </div>
                <div>
                  <div className="text-sm font-semibold">Checked in · Room 3</div>
                  <div className="text-xs text-emerald-600">₹600 collected by UPI</div>
                </div>
              </div>
            </div>
            <div className="absolute -top-5 -right-3 hidden rounded-2xl bg-white px-4 py-3 text-slate-800 shadow-2xl ring-1 ring-slate-900/5 md:block">
              <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700">
                <MessageCircle className="h-4 w-4" /> WhatsApp
              </div>
              <div className="mt-1 text-sm">✅ Booked: Dr. Mehra · Fri 10:15 AM</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" className="mx-auto max-w-7xl scroll-mt-20 px-4 py-20 sm:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">Everything a busy OPD needs</h2>
          <p className="mt-3 text-slate-500">From the front desk to the doctor&apos;s chair to the owner&apos;s P&amp;L — every screen designed for speed.</p>
        </div>
        <div className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map(({ icon: Icon, title, text, tone }) => (
            <div key={title} className="group rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 transition-all hover:-translate-y-1 hover:shadow-xl">
              <div className={`relative mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-lg ${tone}`}>
                <div aria-hidden className="absolute inset-0 rounded-xl bg-gradient-to-b from-white/30 to-transparent" />
                <Icon className="relative h-6 w-6" />
              </div>
              <h3 className="font-semibold text-slate-900">{title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-slate-500">{text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Product showcase ── */}
      <section id="product" className="scroll-mt-20 bg-gradient-to-b from-slate-50 to-white py-20">
        <div className="mx-auto max-w-7xl space-y-24 px-4 sm:px-8">
          <Showcase
            kicker="For the front desk"
            title="Check in a patient, issue a token and collect the fee — in one panel"
            points={["Smart defaults: last doctor, new vs follow-up fee", "Emergency and priority patients go first", "Live waiting counts per doctor", "Token display for the waiting room"]}
            icon={UsersRound}
            src="/marketing/opd.png"
          />
          <Showcase
            kicker="For doctors"
            title="Complete, legible prescriptions with far less typing"
            points={["One-tap templates and common phrases", "Voice dictation on every field", "Drug & ICD-10 auto-complete with your favourites", "Allergy alerts, auto clinical summary, signed PDF"]}
            icon={Pill}
            src="/marketing/consult.png"
            flip
          />
          <Showcase
            kicker="For owners"
            title="Know your numbers — today, this month and next month"
            points={["Profit & loss with expenses by category", "Revenue by doctor, service and payment mode", "Forecast of visits and collections with targets", "Printable daily and monthly reports"]}
            icon={Wallet}
            src="/marketing/finance.png"
          />
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-8">
        <h2 className="text-center text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">Live in days, not months</h2>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {STEPS.map((s) => (
            <div key={s.n} className="relative rounded-2xl bg-gradient-to-br from-brand-50 to-white p-6 ring-1 ring-brand-100">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-600 text-lg font-bold text-white">{s.n}</span>
              <h3 className="mt-4 font-semibold text-slate-900">{s.title}</h3>
              <p className="mt-1 text-sm text-slate-500">{s.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Pricing ── */}
      <section id="pricing" className="scroll-mt-20 bg-[#061a1e] py-20 text-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Simple pricing</h2>
            <p className="mt-3 text-slate-300">No setup fee. Unlimited patients and staff logins on every plan.</p>
          </div>
          <div className="mt-12 grid gap-6 lg:grid-cols-3">
            {PLANS.map((p) => (
              <div
                key={p.name}
                className={`relative flex flex-col rounded-3xl p-7 ${p.featured ? "bg-white text-slate-800 shadow-2xl shadow-teal-500/20 ring-2 ring-teal-400" : "bg-white/5 ring-1 ring-white/10"}`}
              >
                {p.featured && <span className="absolute -top-3 left-7 rounded-full bg-gradient-to-r from-teal-500 to-emerald-500 px-3 py-1 text-xs font-bold text-white">Most popular</span>}
                <h3 className="text-lg font-bold">{p.name}</h3>
                <p className={`text-sm ${p.featured ? "text-slate-500" : "text-slate-400"}`}>{p.tagline}</p>
                <div className="mt-5 flex items-baseline gap-1">
                  <span className="text-4xl font-extrabold">{p.price}</span>
                  <span className={p.featured ? "text-slate-500" : "text-slate-400"}>{p.per}</span>
                </div>
                <ul className="mt-6 flex-1 space-y-2.5 text-sm">
                  {p.features.map((f) => (
                    <li key={f} className="flex gap-2">
                      <Check className={`mt-0.5 h-4 w-4 shrink-0 ${p.featured ? "text-brand-600" : "text-emerald-400"}`} /> {f}
                    </li>
                  ))}
                </ul>
                <a
                  href="#demo"
                  className={`mt-7 inline-flex h-11 items-center justify-center rounded-xl font-semibold ${p.featured ? "bg-brand-600 text-white hover:bg-brand-700" : "bg-white/10 text-white hover:bg-white/20"}`}
                >
                  {p.cta}
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ + Demo ── */}
      <section className="mx-auto grid max-w-7xl gap-12 px-4 py-20 sm:px-8 lg:grid-cols-2">
        <div id="faq" className="scroll-mt-20">
          <h2 className="text-3xl font-extrabold tracking-tight text-slate-900">Questions</h2>
          <div className="mt-6 divide-y divide-slate-200">
            {FAQ.map(([q, a]) => (
              <details key={q} className="group py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold text-slate-900">
                  {q}
                  <span className="text-brand-600 transition group-open:rotate-45">+</span>
                </summary>
                <p className="mt-2 text-sm leading-relaxed text-slate-500">{a}</p>
              </details>
            ))}
          </div>
        </div>
        <div id="demo" className="scroll-mt-20 rounded-3xl bg-white p-6 shadow-xl ring-1 ring-slate-200 sm:p-8">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-lg">
              <CalendarHeart className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Book a free demo</h2>
              <p className="text-sm text-slate-500">30 minutes, with your own departments and doctors.</p>
            </div>
          </div>
          <DemoForm />
        </div>
      </section>

      <footer className="border-t border-slate-100 bg-slate-50">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-8 text-sm text-slate-500 sm:px-8">
          <div className="flex items-center gap-3">
            <Logo className="h-6" />
            <span>Built for hospitals and clinics by Cliccx</span>
          </div>
          <div className="flex gap-5">
            <a href="#pricing" className="hover:text-slate-800">Pricing</a>
            <a href="#demo" className="hover:text-slate-800">Contact</a>
            <Link href="/login" className="hover:text-slate-800">Staff sign-in</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function BrowserFrame({ src, alt, priority }: { src: string; alt: string; priority?: boolean }) {
  return (
    <div className="overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 shadow-black/40 ring-white/10">
      <div className="flex h-8 items-center gap-1.5 bg-slate-100 px-3">
        <span className="h-2.5 w-2.5 rounded-full bg-rose-400" />
        <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
        <span className="ml-3 h-4 flex-1 rounded bg-white text-[9px] leading-4 text-slate-400">&nbsp;app.docslot.health</span>
      </div>
      <Image src={src} alt={alt} width={1440} height={900} priority={priority} className="h-auto w-full" />
    </div>
  );
}

function Showcase({
  kicker,
  title,
  points,
  icon: Icon,
  src,
  flip,
}: {
  kicker: string;
  title: string;
  points: string[];
  icon: typeof HeartPulse;
  src: string;
  flip?: boolean;
}) {
  return (
    <div className="grid items-center gap-10 lg:grid-cols-2">
      <div className={flip ? "lg:order-2" : ""}>
        <span className="inline-flex items-center gap-2 text-sm font-semibold text-brand-700">
          <Icon className="h-5 w-5" /> {kicker}
        </span>
        <h3 className="mt-3 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">{title}</h3>
        <ul className="mt-6 space-y-3">
          {points.map((p) => (
            <li key={p} className="flex gap-3 text-slate-600">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-700">
                <Check className="h-3 w-3" />
              </span>
              {p}
            </li>
          ))}
        </ul>
      </div>
      <div className={flip ? "lg:order-1" : ""}>
        <BrowserFrame src={src} alt={title} />
      </div>
    </div>
  );
}

