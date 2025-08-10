import React, { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
// استبدلنا Broom غير الموجودة، وأيقونات قد تكون غير متاحة في بعض نسخ lucide-react
import { CheckCircle2, Sparkles, Wrench, Plug, ShowerHead, Car, MapPin, Clock, CreditCard, ShieldCheck } from "lucide-react";

// ————————————————————————————————————————————
// ملاحظات سريعة للناشر (اقرأ التعليقات):
// 1) هذا ملف React واحد جاهز للمعاينة. ارفعه على Vercel أو Netlify كمشروع React (Create React App أو Next.js).
// 2) الدفع الحقيقي (Apple Pay / Mada / Mastercard) يحتاج باك-إند بسيط (Stripe Checkout)
//    — راجع الدالة createCheckoutSession (أسفل) لتوصيلها بسيرفرليس فانكشن.
// 3) حالياً "وضع التجربة" مفعّل: زر الدفع سيحاكي النجاح ويُظهر رقم حجز.
// 4) أضفنا "اختبارات دخانية" (Smoke Tests) تظهر في أسفل الصفحة لتضمن أن الأقسام والأسعار مضبوطة.
// ————————————————————————————————————————————

const SERVICES = [
  { id: "maintenance", name: "خدمات صيانة", icon: Wrench, desc: "فنيون مختصون لصيانة كهرباء/سباكة/نجارة وأعمال منزلية" },
  { id: "cleaning", name: "خدمات تنظيف", icon: Sparkles, desc: "تنظيف منازل، مفروشات، تعقيم، وتنظيف بعد الصيانة" },
  { id: "electrician", name: "عامل كهربائي", icon: Plug, desc: "تمديدات وفحص أعطال وتركيب وحدات إنارة وأجهزة" },
  { id: "plumber", name: "عامل سباكة", icon: ShowerHead, desc: "كشف تسريبات، تركيب خلاطات وسخانات، صيانة خطوط" },
  { id: "carwash", name: "تنظيف سيارات", icon: Car, desc: "غسيل وتلميع متنقل أمام باب منزلك" },
];

const SERVICE_TIERS: Record<string, {label: string; price: number}[]> = {
  maintenance: [
    { label: "زيارة فحص سريعة", price: 69 },
    { label: "ساعة عمل", price: 149 },
    { label: "باقة يوم عمل", price: 699 },
  ],
  cleaning: [
    { label: "غرفة واحدة", price: 99 },
    { label: "شقة صغيرة", price: 199 },
    { label: "فيلا كاملة", price: 499 },
  ],
  electrician: [
    { label: "كشف عطل", price: 99 },
    { label: "تركيب وحدة إنارة", price: 129 },
    { label: "باقة تمديدات", price: 399 },
  ],
  plumber: [
    { label: "كشف تسريب", price: 99 },
    { label: "تركيب سخان/خلاط", price: 149 },
    { label: "تنظيف مجرى", price: 179 },
  ],
  carwash: [
    { label: "غسيل خارجي", price: 59 },
    { label: "خارجي + داخلي", price: 89 },
    { label: "تلميع سريع", price: 149 },
  ],
};

const PAYMENT_METHODS = [
  { id: "applepay", label: "Apple Pay" },
  { id: "mada", label: "مدى" },
  { id: "mastercard", label: "Mastercard" },
];

function formatSAR(amount: number) {
  return new Intl.NumberFormat("ar-SA", { style: "currency", currency: "SAR", maximumFractionDigits: 0 }).format(amount);
}

// ——— اختبارات بسيطة ———
function runSmokeTests() {
  const results: { name: string; pass: boolean; details?: string }[] = [];

  // 1) كل خدمة لها باقات
  for (const s of SERVICES) {
    const tiers = SERVICE_TIERS[s.id];
    results.push({ name: `tiers for ${s.id}`, pass: Array.isArray(tiers) && tiers.length > 0, details: JSON.stringify(tiers) });
  }

  // 2) تنسيق العملة يعيد نص
  const money = formatSAR(123);
  results.push({ name: "formatSAR returns string", pass: typeof money === "string", details: money });

  // 3) طرق الدفع موجودة
  results.push({ name: "payment methods count", pass: PAYMENT_METHODS.length >= 3, details: PAYMENT_METHODS.map(m=>m.id).join(",") });

  // 4) القيم الافتراضية قابلة للاختيار
  const defaultServiceOk = SERVICES[0] && SERVICE_TIERS[SERVICES[0].id]?.[0]?.label;
  results.push({ name: "default tier exists", pass: !!defaultServiceOk, details: String(defaultServiceOk) });

  return results;
}

export default function App() {
  const [activeService, setActiveService] = useState<string>(SERVICES[0].id);
  const [tier, setTier] = useState<string>(SERVICE_TIERS[SERVICES[0].id][0].label);
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [time, setTime] = useState<string>("");
  const [address, setAddress] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [phone, setPhone] = useState<string>("");
  const [payment, setPayment] = useState<string>(PAYMENT_METHODS[0].id);
  const [loading, setLoading] = useState(false);
  const [bookingId, setBookingId] = useState<string | null>(null);

  const tiers = SERVICE_TIERS[activeService] ?? [];
  const selectedTier = useMemo(() => tiers.find(t => t.label === tier) ?? tiers[0], [tiers, tier]);

  // ———— نموذج إنشاء جلسة دفع Stripe (للتوصيل لاحقًا) ————
  async function createCheckoutSession() {
    // ملاحظة مهمة: Stripe يحتاج باك-إند (مفتاح سري).
    // هنا تستدعي endpoint عندك (سيرفرليس على Vercel/Netlify) يعيد checkoutUrl.
    // مثال:
    // const res = await fetch("/api/create-checkout-session", {
    //   method: "POST",
    //   headers: { "Content-Type": "application/json" },
    //   body: JSON.stringify({
    //     service: activeService,
    //     tier,
    //     price: selectedTier?.price,
    //     date: date?.toISOString(),
    //     time,
    //     address,
    //     phone,
    //     notes,
    //     payment,
    //   }),
    // });
    // const { checkoutUrl } = await res.json();
    // window.location.href = checkoutUrl; // يفتح Stripe Checkout (يدعم Apple Pay/بطاقات مدى/ماستر).

    // حالياً: وضع تجربة — نحاكي نجاح الدفع فورًا.
    await new Promise(r => setTimeout(r, 900));
    const fakeId = Math.random().toString(36).slice(2, 10).toUpperCase();
    setBookingId(`BK-${fakeId}`);
  }

  async function handlePay() {
    if (!date || !time || !address || !phone) {
      alert("رجاءً أكمل البيانات: التاريخ، الوقت، العنوان، ورقم الجوال.");
      return;
    }
    setLoading(true);
    try {
      await createCheckoutSession();
    } finally {
      setLoading(false);
    }
  }

  const smoke = runSmokeTests();

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white text-slate-900 antialiased">
      {/* Hero */}
      <section className="px-4 md:px-8 py-8 md:py-12">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
          className="max-w-6xl mx-auto grid md:grid-cols-2 gap-6 items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-slate-600 text-sm">
              <Sparkles className="w-4 h-4" />
              <span>خدمة عند باب بيتك</span>
            </div>
            <h1 className="mt-3 text-3xl md:text-5xl font-extrabold leading-tight tracking-tight">
              احجز أي خدمة منزلية <span className="text-slate-500">بضغطة زر</span>
            </h1>
            <p className="mt-3 text-slate-600 md:text-lg">
              صيانة • تنظيف • كهرباء • سباكة • غسيل سيارات — ادفع عبر <b>Apple Pay</b> أو بطاقات <b>مدى/ماستر كارد</b> واستقبل الفني أمام منزلك.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Badge variant="secondary" className="text-slate-700">دعم المدن الرئيسية</Badge>
              <Badge variant="secondary" className="text-slate-700">أسعار ثابتة واضحة</Badge>
              <Badge variant="secondary" className="text-slate-700">دفع آمن مشفر <ShieldCheck className="inline w-4 h-4" /></Badge>
            </div>
          </div>
          <Card className="border-slate-200 shadow-sm">
            <CardContent className="p-4 md:p-6">
              <div className="space-y-3">
                <Label className="text-slate-700">اختر نوع الخدمة</Label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {SERVICES.map(s => (
                    <button key={s.id} onClick={() => { setActiveService(s.id); setTier(SERVICE_TIERS[s.id][0].label); }}
                      className={`group rounded-2xl border p-3 text-start hover:shadow transition ${activeService === s.id ? "border-slate-900 bg-slate-50" : "border-slate-200"}`}>
                      <s.icon className="w-6 h-6 mb-1" />
                      <div className="font-semibold text-sm leading-snug">{s.name}</div>
                      <div className="text-xs text-slate-600 line-clamp-2">{s.desc}</div>
                    </button>
                  ))}
                </div>
                <div className="grid sm:grid-cols-2 gap-3 pt-2">
                  <div>
                    <Label>الباقة</Label>
                    <Select value={tier} onValueChange={setTier}>
                      <SelectTrigger className="mt-1"><SelectValue placeholder="اختر" /></SelectTrigger>
                      <SelectContent>
                        {tiers.map(t => <SelectItem key={t.label} value={t.label}>{t.label} — {formatSAR(t.price)}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>التاريخ</Label>
                    <div className="mt-1 rounded-2xl border border-slate-200 p-2">
                      <Calendar mode="single" selected={date} onSelect={setDate} className="rounded-md"/>
                    </div>
                  </div>
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <Label>الوقت</Label>
                    <Input placeholder="مثال: 5:30 م" value={time} onChange={(e) => setTime(e.target.value)} className="mt-1" />
                  </div>
                  <div>
                    <Label>جوال للتواصل (واتساب/اتصال)</Label>
                    <Input placeholder="05xxxxxxxx" value={phone} onChange={(e) => setPhone(e.target.value)} className="mt-1" />
                  </div>
                </div>
                <div>
                  <Label>العنوان</Label>
                  <div className="mt-1 flex items-center gap-2">
                    <Input placeholder="المدينة، الحي، الشارع، رقم المنزل" value={address} onChange={(e) => setAddress(e.target.value)} />
                    <Button variant="secondary" type="button"><MapPin className="w-4 h-4 mr-1"/> تحديد</Button>
                  </div>
                </div>
                <div>
                  <Label>ملاحظات إضافية</Label>
                  <Textarea placeholder="أي تفاصيل تساعد الفني (مثلاً: نوع المشكلة أو ملاحظات الدخول)" value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-1" />
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-slate-200 p-3">
                    <div className="text-sm text-slate-700 mb-2 font-semibold">طريقة الدفع</div>
                    <RadioGroup value={payment} onValueChange={setPayment} className="space-y-2">
                      {PAYMENT_METHODS.map(m => (
                        <div key={m.id} className="flex items-center gap-2">
                          <RadioGroupItem id={m.id} value={m.id} />
                          <Label htmlFor={m.id}>{m.label}</Label>
                        </div>
                      ))}
                    </RadioGroup>
                  </div>
                  <div className="rounded-2xl border border-slate-200 p-3">
                    <div className="text-sm text-slate-700 mb-2 font-semibold">ملخص الطلب</div>
                    <div className="text-sm flex items-center gap-2 text-slate-700"><Clock className="w-4 h-4"/> {date ? date.toLocaleDateString("ar-SA") : "—"} • {time || "—"}</div>
                    <div className="text-sm text-slate-700 mt-1">{SERVICES.find(s=>s.id===activeService)?.name} — {tier}</div>
                    <div className="mt-2 font-extrabold text-xl">{selectedTier ? formatSAR(selectedTier.price) : "—"}</div>
                  </div>
                </div>

                {bookingId ? (
                  <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="w-6 h-6 text-emerald-600"/>
                      <div>
                        <div className="font-bold text-emerald-700">تم حجز طلبك بنجاح</div>
                        <div className="text-emerald-700/90 text-sm mt-1">رقم الحجز: <b>{bookingId}</b>. سنرسل رسالة تأكيد إلى رقم الجوال المدخل.</div>
                      </div>
                    </div>
                  </motion.div>
                ) : (
                  <Button onClick={handlePay} disabled={loading} className="w-full text-base h-11">
                    {loading ? "جارٍ معالجة الدفع …" : (
                      <span className="inline-flex items-center gap-2"><CreditCard className="w-4 h-4"/> ادفع الآن وأكمل الحجز</span>
                    )}
                  </Button>
                )}

                <div className="text-xs text-slate-500 text-center pt-1">
                  بالضغط على الدفع فأنت توافق على الشروط وسياسة الخصوصية. الدفع الحقيقي يحتاج تفعيل Stripe Checkout (تعليمات داخل الكود).
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </section>

      {/* Services showcase */}
      <section className="px-4 md:px-8 pb-14">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-extrabold mb-4">الأقسام المتاحة</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {SERVICES.map((s) => (
              <Card key={s.id} className="hover:shadow-md transition border-slate-200">
                <CardContent className="p-5">
                  <div className="flex items-start gap-3">
                    <s.icon className="w-6 h-6"/>
                    <div>
                      <div className="font-bold">{s.name}</div>
                      <div className="text-sm text-slate-600">{s.desc}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-4 md:px-8 py-10 border-t border-slate-200 bg-white">
        <div className="max-w-6xl mx-auto grid md:grid-cols-3 gap-6 items-center">
          <div>
            <div className="font-extrabold text-xl">خدمات — عند باب بيتك</div>
            <div className="text-slate-600 text-sm mt-1">حجوزات سريعة ودفع آمن. نخدم المدن الرئيسية داخل المملكة.</div>
          </div>
          <div className="text-sm text-slate-600">
            <div className="font-semibold mb-1">روابط مهمة</div>
            <ul className="space-y-1 list-disc list-inside">
              <li>سياسة الخصوصية</li>
              <li>الشروط والأحكام</li>
              <li>الدعم الفني</li>
            </ul>
          </div>
          <div className="text-sm text-slate-600">
            <div className="font-semibold mb-1">الدفع المدعوم</div>
            <div className="flex flex-wrap gap-2 items-center">
              <Badge>Apple Pay</Badge>
              <Badge>مدى</Badge>
              <Badge>Mastercard</Badge>
            </div>
          </div>
        </div>

        {/* لوحة فحص سريعة */}
        <div className="max-w-6xl mx-auto mt-8">
          <Card className="border-slate-200 bg-slate-50">
            <CardContent className="p-4">
              <div className="font-semibold mb-2">اختبارات دخانية (للمطور):</div>
              <ul className="text-sm text-slate-700 list-disc list-inside">
                {smoke.map((t, i) => (
                  <li key={i}>
                    <span className={t.pass ? "text-emerald-600" : "text-red-600"}>
                      {t.pass ? "✔" : "✘"}
                    </span>{" "}
                    {t.name} — <span className="text-slate-500">{t.details}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </footer>
    </div>
  );
}
