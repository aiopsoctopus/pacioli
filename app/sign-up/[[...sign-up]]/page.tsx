import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <div className="min-h-screen flex items-center justify-center pacioli-bg-base">
      <div className="flex flex-col items-center gap-8">
        <div className="text-center">
          <h1 className="text-2xl font-semibold pacioli-text-primary mb-1">Create your account</h1>
          <p className="text-sm pacioli-text-muted">Your data stays on your device — we just need a way to recognize you</p>
        </div>
        <SignUp forceRedirectUrl="/zoom-out" />
      </div>
    </div>
  );
}
