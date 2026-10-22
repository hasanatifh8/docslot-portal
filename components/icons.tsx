// App icon set: Phosphor Icons, duotone by default (outline + soft tinted fill).
// Exported under the names the app already used, so screens only change their
// import path. Tiny inline glyphs (×, ✓, chevrons, arrows) stay on lucide-react.
//
// Uses Phosphor's SSR build: no React context, safe in server and client components.
import type { ComponentType } from "react";
import type { IconProps, IconWeight } from "@phosphor-icons/react/dist/lib/types";
import * as Ph from "@phosphor-icons/react/dist/ssr";

export type { IconWeight };
export type AppIcon = ComponentType<{ className?: string; weight?: IconWeight }>;

function duo(Icon: ComponentType<IconProps>, name: string): AppIcon {
  const C = ({ weight = "duotone", ...props }: { className?: string; weight?: IconWeight }) => <Icon weight={weight} {...props} />;
  C.displayName = name;
  return C;
}

// Navigation & pages
export const LayoutDashboard = duo(Ph.SquaresFour, "LayoutDashboard");
export const ClipboardPlus = duo(Ph.ClipboardText, "ClipboardPlus");
export const ClipboardList = duo(Ph.Clipboard, "ClipboardList");
export const ClipboardCheck = duo(Ph.ListChecks, "ClipboardCheck");
export const CalendarHeart = duo(Ph.CalendarHeart, "CalendarHeart");
export const CalendarSync = duo(Ph.ClockCounterClockwise, "CalendarSync");
export const CalendarClock = duo(Ph.CalendarDots, "CalendarClock");
export const CalendarPlus = duo(Ph.CalendarPlus, "CalendarPlus");
export const CalendarCheck2 = duo(Ph.CalendarCheck, "CalendarCheck2");
export const CalendarDays = duo(Ph.CalendarBlank, "CalendarDays");
export const CalendarOff = duo(Ph.CalendarSlash, "CalendarOff");
export const CalendarRange = duo(Ph.Calendar, "CalendarRange");
export const UsersRound = duo(Ph.UsersThree, "UsersRound");
export const UserRound = duo(Ph.UserCircle, "UserRound");
export const UserRoundPlus = duo(Ph.UserPlus, "UserRoundPlus");
export const UserRoundCog = duo(Ph.UserGear, "UserRoundCog");
export const BadgePlus = duo(Ph.UserCirclePlus, "BadgePlus");
export const IndianRupee = duo(Ph.CurrencyInr, "IndianRupee");
export const BarChart3 = duo(Ph.ChartBar, "BarChart3");
export const ScrollText = duo(Ph.Scroll, "ScrollText");
export const Stethoscope = duo(Ph.Stethoscope, "Stethoscope");
export const Settings = duo(Ph.GearSix, "Settings");
export const Hospital = duo(Ph.Hospital, "Hospital");
export const Building2 = duo(Ph.Buildings, "Building2");
export const Monitor = duo(Ph.Monitor, "Monitor");
export const KeyRound = duo(Ph.Key, "KeyRound");
export const LogOut = duo(Ph.SignOut, "LogOut");
export const Menu = duo(Ph.List, "Menu");
export const Search = duo(Ph.MagnifyingGlass, "Search");

// Clinical
export const HeartPulse = duo(Ph.Heartbeat, "HeartPulse");
export const Activity = duo(Ph.Pulse, "Activity");
export const Pill = duo(Ph.Pill, "Pill");
export const Siren = duo(Ph.Siren, "Siren");
export const Thermometer = duo(Ph.Thermometer, "Thermometer");
export const Droplet = duo(Ph.Drop, "Droplet");
export const Gauge = duo(Ph.Gauge, "Gauge");
export const Wind = duo(Ph.Wind, "Wind");
export const Ruler = duo(Ph.Ruler, "Ruler");
export const Scale = duo(Ph.Scales, "Scale");
export const Weight = duo(Ph.Barbell, "Weight");
export const ShieldCheck = duo(Ph.ShieldCheck, "ShieldCheck");
export const ShieldAlert = duo(Ph.ShieldWarning, "ShieldAlert");
export const FileText = duo(Ph.FileText, "FileText");
export const FileCheck2 = duo(Ph.Notepad, "FileCheck2");
export const NotebookPen = duo(Ph.NotePencil, "NotebookPen");
export const ListChecks = duo(Ph.ListChecks, "ListChecks");
export const History = duo(Ph.ClockCounterClockwise, "History");
export const LayoutTemplate = duo(Ph.Cards, "LayoutTemplate");
export const BookmarkPlus = duo(Ph.BookmarkSimple, "BookmarkPlus");
export const Sparkles = duo(Ph.Sparkle, "Sparkles");
export const Mic = duo(Ph.Microphone, "Mic");
export const MicOff = duo(Ph.MicrophoneSlash, "MicOff");

// Money
export const ReceiptText = duo(Ph.Receipt, "ReceiptText");
export const Wallet = duo(Ph.Wallet, "Wallet");
export const Banknote = duo(Ph.Money, "Banknote");
export const CreditCard = duo(Ph.CreditCard, "CreditCard");
export const Smartphone = duo(Ph.QrCode, "Smartphone");
export const Percent = duo(Ph.Percent, "Percent");
export const Undo2 = duo(Ph.ArrowUUpLeft, "Undo2");
export const Ban = duo(Ph.Prohibit, "Ban");
export const SlidersHorizontal = duo(Ph.Sliders, "SlidersHorizontal");
export const Printer = duo(Ph.Printer, "Printer");
export const Download = duo(Ph.DownloadSimple, "Download");

// People & contact
export const IdCard = duo(Ph.IdentificationCard, "IdCard");
export const Phone = duo(Ph.Phone, "Phone");
export const MessageCircle = duo(Ph.ChatCircleText, "MessageCircle");
export const BellRing = duo(Ph.BellRinging, "BellRing");

// Status
export const BadgeCheck = duo(Ph.SealCheck, "BadgeCheck");
export const CheckCircle2 = duo(Ph.CheckCircle, "CheckCircle2");
export const CircleX = duo(Ph.XCircle, "CircleX");
export const AlertTriangle = duo(Ph.Warning, "AlertTriangle");
export const TriangleAlert = AlertTriangle;
export const Info = duo(Ph.Info, "Info");
export const Clock = duo(Ph.Clock, "Clock");
export const Timer = duo(Ph.Timer, "Timer");
export const Hourglass = duo(Ph.HourglassMedium, "Hourglass");
export const Repeat2 = duo(Ph.ArrowsClockwise, "Repeat2");
export const RotateCcw = duo(Ph.ArrowCounterClockwise, "RotateCcw");
export const Trash2 = duo(Ph.Trash, "Trash2");
