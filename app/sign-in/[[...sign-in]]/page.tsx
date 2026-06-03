import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center pacioli-bg-base">
      <div className="flex flex-col items-center gap-8">
        <div className="text-center">
          <h1 className="text-2xl font-semibold pacioli-text-primary mb-1">Welcome back</h1>
          <p className="text-sm pacioli-text-muted">Sign in to your Pacioli account</p>
        </div>
        <SignIn />
      </div>
    </div>
  );
}
