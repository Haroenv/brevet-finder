import { useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthState } from './auth-state';
import { ROUTES } from './routes';
import { supabase } from './supabase';

function buildAppUrl(path: string) {
  return new URL(
    path.startsWith('/') ? path.slice(1) : path,
    `${window.location.origin}${import.meta.env.BASE_URL}`
  ).href;
}

function getSupabaseClient() {
  if (!supabase) {
    throw new Error(
      'Supabase auth routes require VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY'
    );
  }
  return supabase;
}

async function maybeStorePasswordCredential({
  email,
  password,
  name,
}: {
  email: string;
  password: string;
  name?: string;
}) {
  try {
    if (
      typeof window === 'undefined' ||
      typeof navigator === 'undefined' ||
      !('credentials' in navigator) ||
      !('PasswordCredential' in window)
    ) {
      return;
    }

    const PasswordCredentialCtor = (
      window as Window & {
        PasswordCredential?: new (data: {
          id: string;
          password: string;
          name?: string;
        }) => Credential;
      }
    ).PasswordCredential;

    if (!PasswordCredentialCtor) {
      return;
    }

    const credential = new PasswordCredentialCtor({
      id: email,
      password,
      name,
    });

    await navigator.credentials.store(credential);
  } catch {
    // ignore unsupported browser behavior
  }
}

export function LoginPage() {
  const { user } = useAuthState();
  const [searchParams] = useSearchParams();

  const initialEmail = searchParams.get('email') || '';
  const showCheckEmailNotice = searchParams.get('checkEmail') === '1';

  if (user) {
    return <Navigate to={ROUTES.account} replace />;
  }

  return (
    <AuthLayout
      title="Log in"
      subtitle="Sign in to save plans and sync them across devices."
      footer={
        <>
          New here? <Link to={ROUTES.signup}>Create an account</Link>.
        </>
      }
    >
      <AuthForm
        mode="login"
        submitLabel="Log in"
        initialEmail={initialEmail}
        initialNotice={
          showCheckEmailNotice
            ? 'If this email can be registered, check your inbox to confirm. Then log in.'
            : ''
        }
      />
    </AuthLayout>
  );
}

export function SignupPage() {
  const { user } = useAuthState();

  if (user) {
    return <Navigate to={ROUTES.account} replace />;
  }

  return (
    <AuthLayout
      title="Create account"
      subtitle="Set up your account to keep your brevet plans in one place."
      footer={
        <>
          Already have an account? <Link to={ROUTES.login}>Log in</Link>.
        </>
      }
    >
      <AuthForm mode="signup" submitLabel="Create account" includeName />
    </AuthLayout>
  );
}

export function ForgotPasswordPage() {
  const { user } = useAuthState();
  const supabaseClient = getSupabaseClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  if (user) {
    return <Navigate to={ROUTES.account} replace />;
  }

  return (
    <AuthLayout
      title="Forgot password"
      subtitle="Enter your email and we will send a reset link."
      footer={
        <>
          Remembered it? <Link to={ROUTES.login}>Back to log in</Link>.
        </>
      }
    >
      <form
        className="auth-form"
        autoComplete="on"
        onSubmit={async (e) => {
          e.preventDefault();

          setIsSubmitting(true);
          setError('');
          setNotice('');

          const formData = new FormData(e.currentTarget);
          const email = (formData.get('email') || '').toString().trim();

          const { error } = await supabaseClient.auth.resetPasswordForEmail(
            email,
            {
              redirectTo: buildAppUrl(ROUTES.resetPassword),
            }
          );

          setIsSubmitting(false);

          if (error) {
            setError(error.message);
            return;
          }

          setNotice('If this email exists, we sent a password reset link.');
        }}
      >
        <label className="auth-label">
          Email
          <input
            className="input auth-input"
            type="email"
            name="email"
            autoComplete="username"
            required
            disabled={isSubmitting}
          />
        </label>
        {error && <p className="auth-error">{error}</p>}
        {notice && <p className="auth-notice">{notice}</p>}
        <button
          className="btn auth-submit"
          type="submit"
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Working…' : 'Send reset link'}
        </button>
      </form>
    </AuthLayout>
  );
}

export function ResetPasswordPage() {
  const { user } = useAuthState();
  const supabaseClient = getSupabaseClient();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!user) {
    return (
      <AuthLayout
        title="Reset password"
        subtitle="Open this page from the reset link in your email."
        footer={
          <>
            Need another link?{' '}
            <Link to={ROUTES.forgotPassword}>Request one</Link>.
          </>
        }
      >
        <p className="auth-notice">
          We could not verify your reset session yet. Open the latest link from
          your email.
        </p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Set new password"
      subtitle="Choose a strong new password for your account."
      footer={
        <>
          Back to <Link to={ROUTES.account}>account</Link>.
        </>
      }
    >
      <form
        className="auth-form"
        autoComplete="on"
        onSubmit={async (e) => {
          e.preventDefault();
          setIsSubmitting(true);
          setError('');

          const formData = new FormData(e.currentTarget);
          const password = (formData.get('password') || '').toString();
          const confirmPassword = (
            formData.get('confirmPassword') || ''
          ).toString();

          if (password !== confirmPassword) {
            setIsSubmitting(false);
            setError('Passwords do not match.');
            return;
          }

          const { error } = await supabaseClient.auth.updateUser({ password });
          setIsSubmitting(false);

          if (error) {
            setError(error.message);
            return;
          }

          navigate(ROUTES.account, { replace: true });
        }}
      >
        <label className="auth-label">
          New password
          <input
            className="input auth-input"
            type="password"
            name="password"
            autoComplete="new-password"
            minLength={8}
            required
            disabled={isSubmitting}
          />
        </label>
        <label className="auth-label">
          Confirm new password
          <input
            className="input auth-input"
            type="password"
            name="confirmPassword"
            autoComplete="new-password"
            minLength={8}
            required
            disabled={isSubmitting}
          />
        </label>
        {error && <p className="auth-error">{error}</p>}
        <button
          className="btn auth-submit"
          type="submit"
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Working…' : 'Update password'}
        </button>
      </form>
    </AuthLayout>
  );
}

export function AccountPage() {
  const { user } = useAuthState();
  const supabaseClient = getSupabaseClient();
  const [error, setError] = useState('');
  const [isSigningOut, setIsSigningOut] = useState(false);

  if (!user) {
    return <Navigate to={ROUTES.login} replace />;
  }

  const createdAt = user.created_at
    ? new Intl.DateTimeFormat(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }).format(new Date(user.created_at))
    : 'Unknown';

  return (
    <main className="auth-page">
      <section className="auth-card auth-card--wide">
        <h1 className="auth-title">Account</h1>
        <div className="account-grid">
          <div className="account-item">
            <span className="account-item__label">Email</span>
            <span className="account-item__value">
              {user.email || 'Unknown'}
            </span>
          </div>
          <div className="account-item">
            <span className="account-item__label">Joined</span>
            <span className="account-item__value">{createdAt}</span>
          </div>
        </div>
        {error && <p className="auth-error">{error}</p>}
        <div className="auth-actions">
          <button
            className="btn"
            type="button"
            disabled={isSigningOut}
            onClick={async () => {
              setIsSigningOut(true);
              setError('');
              const { error } = await supabaseClient.auth.signOut();
              setIsSigningOut(false);
              if (error) {
                setError(error.message);
              }
            }}
          >
            {isSigningOut ? 'Signing out…' : 'Sign out'}
          </button>
          <Link className="btn" to={ROUTES.home}>
            Back to search
          </Link>
        </div>
      </section>
    </main>
  );
}

function AuthLayout({
  title,
  subtitle,
  footer,
  children,
}: {
  title: string;
  subtitle: string;
  footer: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <main className="auth-page">
      <section className="auth-card">
        <p className="auth-brand">
          <Link to={ROUTES.home}>Brevet Finder</Link>
        </p>
        <h1 className="auth-title">{title}</h1>
        <p className="auth-subtitle">{subtitle}</p>
        {children}
        <p className="auth-footer">{footer}</p>
      </section>
    </main>
  );
}

function AuthForm({
  mode,
  submitLabel,
  includeName = false,
  initialEmail = '',
  initialNotice = '',
}: {
  mode: 'login' | 'signup';
  submitLabel: string;
  includeName?: boolean;
  initialEmail?: string;
  initialNotice?: string;
}) {
  const supabaseClient = getSupabaseClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(initialNotice);
  const navigate = useNavigate();

  const isSignup = mode === 'signup';

  return (
    <form
      className="auth-form"
      autoComplete="on"
      onSubmit={async (e) => {
        e.preventDefault();

        setError('');
        setNotice('');
        setIsSubmitting(true);

        const formData = new FormData(e.currentTarget);
        const name = (formData.get('name') || '').toString().trim();
        const email = (formData.get('email') || '').toString().trim();
        const password = (formData.get('password') || '').toString();
        const confirmPassword = (
          formData.get('confirmPassword') || ''
        ).toString();

        if (isSignup && password !== confirmPassword) {
          setIsSubmitting(false);
          setError('Passwords do not match.');
          return;
        }

        if (mode === 'login') {
          const { error } = await supabaseClient.auth.signInWithPassword({
            email,
            password,
          });
          setIsSubmitting(false);

          if (error) {
            setError(error.message);
            return;
          }

          await maybeStorePasswordCredential({ email, password });

          navigate(ROUTES.account, { replace: true });
          return;
        }

        const { data, error } = await supabaseClient.auth.signUp({
          email,
          password,
          options: {
            data: name ? { name } : undefined,
            emailRedirectTo: buildAppUrl(ROUTES.account),
          },
        });

        setIsSubmitting(false);

        if (error) {
          setError(error.message);
          return;
        }

        if (data.session) {
          await maybeStorePasswordCredential({ email, password, name });
          navigate(ROUTES.account, { replace: true });
          return;
        }

        await maybeStorePasswordCredential({ email, password, name });

        navigate(
          `${ROUTES.login}?checkEmail=1&email=${encodeURIComponent(email)}`,
          { replace: true }
        );
      }}
    >
      {includeName && (
        <label className="auth-label">
          Name
          <input className="input auth-input" name="name" autoComplete="name" />
        </label>
      )}
      <label className="auth-label">
        Email
        <input
          className="input auth-input"
          type="email"
          name="email"
          autoComplete="username"
          defaultValue={initialEmail}
          required
          disabled={isSubmitting}
        />
      </label>
      <label className="auth-label">
        Password
        <input
          className="input auth-input"
          type="password"
          name="password"
          autoComplete={includeName ? 'new-password' : 'current-password'}
          minLength={8}
          required
          disabled={isSubmitting}
        />
      </label>
      {!isSignup && (
        <p className="auth-inline-note">
          <Link to={ROUTES.forgotPassword}>Forgot password?</Link>
        </p>
      )}
      {isSignup && (
        <label className="auth-label">
          Confirm password
          <input
            className="input auth-input"
            type="password"
            name="confirmPassword"
            autoComplete="new-password"
            minLength={8}
            required
            disabled={isSubmitting}
          />
        </label>
      )}
      {error && <p className="auth-error">{error}</p>}
      {notice && <p className="auth-notice">{notice}</p>}
      <button className="btn auth-submit" type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Working…' : submitLabel}
      </button>
    </form>
  );
}
