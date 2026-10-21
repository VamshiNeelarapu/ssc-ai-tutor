import { Logo } from "@/components/ui/Logo";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Logo size={64} className="mx-auto" />
          <h1 className="mt-3 text-2xl font-bold text-[#0f2447]">SSC AI Study App</h1>
          <p className="mt-1 text-sm text-gray-500">
            Your AI-powered SSC CGL preparation workspace
          </p>
        </div>
        {children}
      </div>
    </div>
  );
}
